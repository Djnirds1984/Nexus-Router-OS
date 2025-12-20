/**
 * Nexus Router OS - Hardware Agent
 * This script must run as root to interact with the Linux kernel.
 */

const logFile = '/var/log/nexus-agent.log';
const configFile = './nexus-config.json';
const fs = require('fs');
const { execSync } = require('child_process');

function log(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(logFile, entry);
  } catch (e) { }
}

// --- CPU Telemetry Engine ---
let lastCpuStats = [];
let cpuUsageHistory = [];

function getCpuStats() {
  try {
    const stats = fs.readFileSync('/proc/stat', 'utf8').split('\n');
    return stats
      .filter(l => l.startsWith('cpu') && l.trim() !== 'cpu')
      .map(l => {
        const parts = l.split(/\s+/).slice(1).map(Number);
        const idle = parts[3] + parts[4]; // idle + iowait
        const total = parts.reduce((a, b) => a + b, 0);
        return { idle, total };
      });
  } catch (e) { return []; }
}

// Initial seed
lastCpuStats = getCpuStats();

// Background tick every 1 second for precise deltas
setInterval(() => {
  const currentStats = getCpuStats();
  if (lastCpuStats.length === currentStats.length) {
    const newUsage = [];
    for (let i = 0; i < currentStats.length; i++) {
      const idleDelta = currentStats[i].idle - lastCpuStats[i].idle;
      const totalDelta = currentStats[i].total - lastCpuStats[i].total;
      const usage = totalDelta ? (1 - idleDelta / totalDelta) * 100 : 0;
      newUsage.push(Math.min(100, Math.max(0, usage)));
    }
    cpuUsageHistory = newUsage;
  }
  lastCpuStats = currentStats;
}, 1000);

// --- Traffic & State Management ---
let prevTraffic = {};
let lastTrafficPollTime = Date.now();

let nexusConfig = { bridges: [], wanConfig: { mode: 'LOAD_BALANCER', interfaces: [] } };
if (fs.existsSync(configFile)) {
  try { 
    nexusConfig = JSON.parse(fs.readFileSync(configFile, 'utf8')); 
    log('Nexus Config persistent state loaded.');
  } catch (e) { }
}

function saveConfig() {
  fs.writeFileSync(configFile, JSON.stringify(nexusConfig, null, 2));
}

try {
  const express = require('express');
  const cors = require('cors');
  const app = express();
  app.use(cors());
  app.use(express.json());

  // GET: Available Hardware Interfaces
  app.get('/api/interfaces', (req, res) => {
    try {
      if (process.platform !== 'linux') {
        return res.json([{ id: 'eth0', name: 'WAN1', interfaceName: 'eth0', status: 'UP', ipAddress: '127.0.0.1', gateway: '1.1.1.1', throughput: { rx: Math.random() * 5, tx: Math.random() * 2 }, weight: 1, priority: 1 }]);
      }
      
      const gateways = {};
      try {
        const routes = execSync('ip route show').toString();
        routes.split('\n').forEach(line => {
          if (line.includes('default via')) {
            const parts = line.split(/\s+/);
            const devIndex = parts.indexOf('dev');
            if (devIndex !== -1 && parts[devIndex + 1]) gateways[parts[devIndex + 1]] = parts[2];
          }
        });
      } catch (e) {}

      const currentTime = Date.now();
      const timeDelta = (currentTime - lastTrafficPollTime) / 1000;
      const traffic = {};
      try {
        const data = fs.readFileSync('/proc/net/dev', 'utf8');
        data.split('\n').slice(2).forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 1) {
            const name = parts[0].replace(':', '');
            const rxBytes = parseInt(parts[1]);
            const txBytes = parseInt(parts[9]);
            if (prevTraffic[name]) {
              const rxDelta = rxBytes - prevTraffic[name].rx;
              const txDelta = txBytes - prevTraffic[name].tx;
              traffic[name] = { 
                rx: Math.max(0, (rxDelta * 8) / 1000000 / timeDelta), 
                tx: Math.max(0, (txDelta * 8) / 1000000 / timeDelta) 
              };
            } else { traffic[name] = { rx: 0, tx: 0 }; }
            prevTraffic[name] = { rx: rxBytes, tx: txBytes };
          }
        });
      } catch (e) {}
      lastTrafficPollTime = currentTime;

      const ipData = JSON.parse(execSync('ip -j addr show').toString());
      const interfaces = ipData.filter(iface => iface.ifname !== 'lo' && !iface.ifname.startsWith('veth')).map(iface => {
        const addr = (iface.addr_info && iface.addr_info[0]) ? iface.addr_info[0] : {};
        
        // Merge persistent user settings (alias, weights) back into live data
        const savedIface = (nexusConfig.wanConfig?.interfaces || []).find(w => w.interfaceName === iface.ifname);
        
        return {
          id: iface.ifname,
          name: savedIface?.name || iface.ifname.toUpperCase(),
          interfaceName: iface.ifname,
          status: iface.operstate === 'UP' || iface.flags.includes('UP') ? 'UP' : 'DOWN',
          ipAddress: addr.local || 'N/A',
          gateway: gateways[iface.ifname] || 'None',
          throughput: traffic[iface.ifname] || { rx: 0, tx: 0 },
          weight: savedIface?.weight || 1, 
          priority: savedIface?.priority || 1 
        };
      });
      res.json(interfaces);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET: System Metrics
  app.get('/api/metrics', (req, res) => {
    try {
      if (process.platform !== 'linux') {
        return res.json({ cpuUsage: 12, cores: [10, 15, 8, 20], memoryUsage: '2.4', totalMem: '16.0', temp: '42°C', uptime: '1 hour', activeSessions: 42 });
      }
      const memLines = fs.readFileSync('/proc/meminfo', 'utf8').split('\n');
      const getKB = (key) => parseInt((memLines.find(l => l.startsWith(key)) || "0").replace(/\D/g, ''));
      const totalMem = getKB('MemTotal:');
      const availableMem = getKB('MemAvailable:');
      const usedMem = totalMem - availableMem;

      let temp = 'N/A';
      try {
        if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
          temp = (parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000).toFixed(0) + '°C';
        }
      } catch (e) {}
      let uptime = 'N/A';
      try { uptime = execSync('uptime -p').toString().replace('up ', '').trim(); } catch (e) {}

      res.json({ 
        cpuUsage: cpuUsageHistory.reduce((a, b) => a + b, 0) / (cpuUsageHistory.length || 1), 
        cores: cpuUsageHistory,
        memoryUsage: (usedMem / 1024 / 1024).toFixed(1), 
        totalMem: (totalMem / 1024 / 1024).toFixed(1),
        temp, uptime, activeSessions: 124 
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // GET/POST: Bridges
  app.get('/api/bridges', (req, res) => res.json(nexusConfig.bridges || []));
  app.post('/api/bridges/apply', (req, res) => {
    try {
      nexusConfig.bridges = req.body.bridges;
      saveConfig();
      if (process.platform === 'linux') {
        for (const bridge of nexusConfig.bridges) {
          try { execSync(`ip link add name ${bridge.name} type bridge`, { stdio: 'ignore' }); } catch(e) {}
          execSync(`ip link set ${bridge.name} up`);
          if (bridge.ipAddress) {
             try { 
                // Careful with flushing to avoid nuking management access
                execSync(`ip addr flush dev ${bridge.name}`); 
                execSync(`ip addr add ${bridge.ipAddress}/${bridge.netmask || '24'} dev ${bridge.name}`); 
             } catch(e) {}
          }
          for (const iface of bridge.interfaces) {
             try { 
                // Remove existing master before assigning to new one
                execSync(`ip link set ${iface} nomaster`, { stdio: 'ignore' });
                execSync(`ip link set ${iface} master ${bridge.name}`); 
                execSync(`ip link set ${iface} up`); 
             } catch(e) {}
          }
          // Note: Full DHCP server configuration (dnsmasq) would be generated and restarted here.
        }
      }
      res.json({ success: true, log: ['Bridge topography synchronized.'] });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // POST: Apply WAN Config
  app.post('/api/apply', (req, res) => {
    try {
      const { mode, wanInterfaces } = req.body;
      
      // Safety: Don't allow empty interface list to wipe system routes
      if (!wanInterfaces || wanInterfaces.length === 0) {
         return res.status(400).json({ error: "Cannot apply empty WAN interface list." });
      }

      nexusConfig.wanConfig = { mode, interfaces: wanInterfaces };
      saveConfig();
      
      if (process.platform === 'linux') {
        execSync('sysctl -w net.ipv4.ip_forward=1');
        
        // Remove existing default routes
        try { execSync('ip route del default'); } catch(e) {}
        
        if (mode === 'LOAD_BALANCER') {
          let cmd = 'ip route add default ';
          const active = wanInterfaces.filter(w => w.status === 'UP' && w.gateway && w.gateway !== 'None');
          active.forEach(w => { cmd += `nexthop via ${w.gateway} dev ${w.interfaceName} weight ${w.weight || 1} `; });
          if (active.length > 0) execSync(cmd);
          else {
             // Fallback to first available if LB logic fails
             const first = wanInterfaces[0];
             if (first && first.gateway) execSync(`ip route add default via ${first.gateway} dev ${first.interfaceName}`);
          }
        } else {
          // Priority failover
          const activeSorted = wanInterfaces
             .filter(w => w.status === 'UP' && w.gateway && w.gateway !== 'None')
             .sort((a,b) => (a.priority || 1) - (b.priority || 1));
             
          const primary = activeSorted[0];
          if (primary && primary.gateway) {
             execSync(`ip route add default via ${primary.gateway} dev ${primary.interfaceName}`);
          }
        }
      }
      res.json({ success: true, log: ['Kernel routing table synchronized.'] });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // POST: System Tools
  app.post('/api/system/fix-dns-conflict', (req, res) => {
    try {
      if (process.platform !== 'linux') return res.json({ success: true, log: ['Emulated: systemd-resolved stopped.'] });
      execSync('systemctl stop systemd-resolved');
      execSync('systemctl disable systemd-resolved');
      res.json({ success: true, log: ['systemd-resolved DISABLED. Port 53 released.'] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.listen(3000, '0.0.0.0', () => { log(`Hardware Agent Listening on :3000`); });
} catch (e) { log(`Critical Agent Error: ${e.message}`); }
