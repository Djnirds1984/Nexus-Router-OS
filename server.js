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

let lastCpuStats = [];
let cpuUsageHistory = [];

function getCpuStats() {
  try {
    const stats = fs.readFileSync('/proc/stat', 'utf8').split('\n');
    return stats
      .filter(l => l.startsWith('cpu') && l.trim() !== 'cpu')
      .map(l => {
        const parts = l.split(/\s+/).slice(1).map(Number);
        const idle = parts[3] + parts[4]; 
        const total = parts.reduce((a, b) => a + b, 0);
        return { idle, total };
      });
  } catch (e) { return []; }
}

lastCpuStats = getCpuStats();

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

let prevTraffic = {};
let lastTrafficPollTime = Date.now();

let nexusConfig = { bridges: [], wanConfig: { mode: 'LOAD_BALANCER', interfaces: [] } };
if (fs.existsSync(configFile)) {
  try { nexusConfig = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch (e) { }
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

  app.get('/api/interfaces', (req, res) => {
    try {
      if (process.platform !== 'linux') {
        return res.json([{ id: 'eth0', name: 'WAN1', interfaceName: 'eth0', status: 'UP', ipAddress: '127.0.0.1', gateway: '1.1.1.1', throughput: { rx: 1.2, tx: 0.5 }, isBridgeMember: false }]);
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

      const traffic = {};
      const currentTime = Date.now();
      const timeDelta = (currentTime - lastTrafficPollTime) / 1000;
      try {
        const devData = fs.readFileSync('/proc/net/dev', 'utf8');
        devData.split('\n').slice(2).forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 1) {
            const name = parts[0].replace(':', '');
            const rxBytes = parseInt(parts[1]);
            const txBytes = parseInt(parts[9]);
            if (prevTraffic[name]) {
               traffic[name] = { 
                 rx: Math.max(0, ((rxBytes - prevTraffic[name].rx) * 8) / 1000000 / timeDelta), 
                 tx: Math.max(0, ((txBytes - prevTraffic[name].tx) * 8) / 1000000 / timeDelta) 
               };
            }
            prevTraffic[name] = { rx: rxBytes, tx: txBytes };
          }
        });
      } catch (e) {}
      lastTrafficPollTime = currentTime;

      const ipData = JSON.parse(execSync('ip -j addr show').toString());
      const interfaces = ipData.filter(iface => iface.ifname !== 'lo' && !iface.ifname.startsWith('veth')).map(iface => {
        const addr = (iface.addr_info && iface.addr_info[0]) ? iface.addr_info[0] : {};
        const savedIface = (nexusConfig.wanConfig?.interfaces || []).find(w => w.interfaceName === iface.ifname);
        
        // Detect if this interface is a slave of a bridge
        let isBridgeMember = false;
        try {
          isBridgeMember = fs.existsSync(`/sys/class/net/${iface.ifname}/master`);
        } catch(e) {}

        return {
          id: iface.ifname,
          name: savedIface?.name || iface.ifname.toUpperCase(),
          interfaceName: iface.ifname,
          status: iface.operstate === 'UP' || iface.flags.includes('UP') ? 'UP' : 'DOWN',
          ipAddress: addr.local || 'N/A',
          gateway: gateways[iface.ifname] || 'None',
          throughput: traffic[iface.ifname] || { rx: 0, tx: 0 },
          isBridgeMember
        };
      });
      res.json(interfaces);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/metrics', (req, res) => {
    try {
      if (process.platform !== 'linux') return res.json({ cpuUsage: 12, cores: [10, 15], memoryUsage: '2.4', totalMem: '16.0', temp: '42°C', uptime: '1h', activeSessions: 42 });
      const memLines = fs.readFileSync('/proc/meminfo', 'utf8').split('\n');
      const total = parseInt(memLines[0].replace(/\D/g, '')) / 1024 / 1024;
      const free = parseInt(memLines[2].replace(/\D/g, '')) / 1024 / 1024;
      let temp = 'N/A';
      try { temp = (parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000).toFixed(0) + '°C'; } catch(e) {}
      res.json({ cpuUsage: cpuUsageHistory[0] || 0, cores: cpuUsageHistory, memoryUsage: (total - free).toFixed(1), totalMem: total.toFixed(1), temp, uptime: execSync('uptime -p').toString().trim(), activeSessions: 124 });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

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
             try { execSync(`ip addr flush dev ${bridge.name}`); execSync(`ip addr add ${bridge.ipAddress}/${bridge.netmask || '24'} dev ${bridge.name}`); } catch(e) {}
          }
          for (const iface of bridge.interfaces) {
             try { execSync(`ip link set ${iface} master ${bridge.name}`); execSync(`ip link set ${iface} up`); } catch(e) {}
          }
        }
      }
      res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/apply', (req, res) => {
    try {
      const { mode, wanInterfaces } = req.body;
      if (!wanInterfaces || wanInterfaces.length === 0) return res.status(400).json({ error: "Empty interface list." });
      
      nexusConfig.wanConfig = { mode, interfaces: wanInterfaces };
      saveConfig();
      
      if (process.platform === 'linux') {
        execSync('sysctl -w net.ipv4.ip_forward=1');
        
        // Filter out any interfaces that are bridge slaves right now
        const activeWans = wanInterfaces.filter(w => {
           try { return !fs.existsSync(`/sys/class/net/${w.interfaceName}/master`); } 
           catch(e) { return true; }
        }).filter(w => w.gateway && w.gateway !== 'None');

        if (activeWans.length === 0) return res.status(400).json({ error: "No WAN-eligible interfaces (Not bridged) found with a gateway." });

        try { execSync('ip route del default'); } catch(e) {}

        if (mode === 'LOAD_BALANCER') {
          let cmd = 'ip route add default ';
          activeWans.forEach(w => { cmd += `nexthop via ${w.gateway} dev ${w.interfaceName} weight ${w.weight || 1} `; });
          execSync(cmd);
        } else {
          const primary = activeWans.sort((a,b) => (a.priority || 1) - (b.priority || 1))[0];
          execSync(`ip route add default via ${primary.gateway} dev ${primary.interfaceName}`);
        }
      }
      res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.listen(3000, '0.0.0.0', () => { log(`Hardware Agent listening on :3000`); });
} catch (e) { log(`Critical Error: ${e.message}`); }
