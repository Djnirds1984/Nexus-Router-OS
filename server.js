/**
 * Nexus Router OS - Hardware Agent
 * This script must run as root to interact with the Linux kernel (iproute2).
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
  } catch (e) {
    // Fallback if log file is unwriteable
  }
}

// Global state for rate calculation
let prevTraffic = {};
let lastPollTime = Date.now();

// Load persisted configuration
let nexusConfig = { bridges: [], wanConfig: { mode: 'LOAD_BALANCER', interfaces: [] } };
if (fs.existsSync(configFile)) {
  try {
    nexusConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    log('Configuration loaded from disk.');
  } catch (e) {
    log('Failed to load config file: ' + e.message);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(configFile, JSON.stringify(nexusConfig, null, 2));
    log('Configuration saved to disk.');
  } catch (e) {
    log('Failed to save config file: ' + e.message);
  }
}

/**
 * Firewall & NAT Orchestrator
 */
function refreshFirewall() {
  if (process.platform !== 'linux') return ['Dev-Mode: Firewall Skip'];
  const logs = [];
  try {
    log('Refreshing Firewall Rules (NAT/Forwarding)...');
    
    // Enable IPv4 Forwarding in Kernel
    execSync('sysctl -w net.ipv4.ip_forward=1');
    
    // Flush existing NAT and Forward rules managed by Nexus to avoid duplicates
    try { execSync('iptables -t nat -F POSTROUTING'); } catch(e) {}
    try { execSync('iptables -F FORWARD'); } catch(e) {}

    // Allow established connections
    execSync('iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT');

    // Identify active WAN interfaces from config
    const activeWans = nexusConfig.wanConfig.interfaces.filter(w => w.status === 'UP');
    
    // Apply NAT (Masquerade) to each WAN interface
    activeWans.forEach(wan => {
      execSync(`iptables -t nat -A POSTROUTING -o ${wan.interfaceName} -j MASQUERADE`);
      execSync(`iptables -A FORWARD -o ${wan.interfaceName} -j ACCEPT`);
      logs.push(`NAT: Enabled Masquerade on ${wan.interfaceName}`);
    });

    // Allow traffic from Bridges to go out
    (nexusConfig.bridges || []).forEach(br => {
      execSync(`iptables -A FORWARD -i ${br.name} -j ACCEPT`);
      logs.push(`Forward: Allowed traffic from ${br.name}`);
    });

    return logs;
  } catch (err) {
    log(`Firewall Error: ${err.message}`);
    return [`Firewall Error: ${err.message}`];
  }
}

log('>>> NEXUS AGENT STARTING UP <<<');

// Attempt to re-apply last known bridge config on startup
const autoApplyBridges = () => {
  if (process.platform !== 'linux') return;
  if (nexusConfig.bridges && nexusConfig.bridges.length > 0) {
    log('Auto-applying persisted bridge configurations...');
    try {
      nexusConfig.bridges.forEach(bridge => {
        try { execSync(`ip link add name ${bridge.name} type bridge`, { stdio: 'ignore' }); } catch(e) {}
        execSync(`ip link set ${bridge.name} up`);
        if (bridge.ipAddress) {
          try {
            execSync(`ip addr flush dev ${bridge.name}`);
            execSync(`ip addr add ${bridge.ipAddress}/${bridge.netmask || '24'} dev ${bridge.name}`);
          } catch(e) {}
        }
        bridge.interfaces.forEach(iface => {
          try { execSync(`ip link set ${iface} master ${bridge.name}`); } catch(e) {}
          try { execSync(`ip link set ${iface} up`); } catch(e) {}
        });
      });
      log('Bridge auto-apply complete.');
      refreshFirewall();
    } catch (e) {
      log('Bridge auto-apply error: ' + e.message);
    }
  }
};
autoApplyBridges();

try {
  const express = require('express');
  const cors = require('cors');

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    log(`${req.method} ${req.url} from ${req.ip}`);
    next();
  });

  // Check Kernel Capabilities
  let supportsJson = false;
  try {
    execSync('ip -j addr show', { stdio: 'ignore' });
    supportsJson = true;
    log('System Check: ip-json support confirmed.');
  } catch (e) {
    log('System Check: ip-json not found. Using legacy text parsing.');
  }

  app.get('/api/interfaces', (req, res) => {
    try {
      if (process.platform !== 'linux') {
        return res.json([{ id: 'eth0', name: 'WAN1', interfaceName: 'eth0', status: 'UP', ipAddress: '127.0.0.1', gateway: '1.1.1.1', throughput: { rx: 0, tx: 0 }, weight: 1, priority: 1 }]);
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

      // Calculate traffic rates (Mbps)
      const currentTime = Date.now();
      const timeDelta = (currentTime - lastPollTime) / 1000; // seconds
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
              
              // (Bytes * 8 bits) / (1,000,000) / time = Mbps
              traffic[name] = { 
                rx: Math.max(0, (rxDelta * 8) / 1000000 / timeDelta), 
                tx: Math.max(0, (txDelta * 8) / 1000000 / timeDelta) 
              };
            } else {
              traffic[name] = { rx: 0, tx: 0 };
            }
            prevTraffic[name] = { rx: rxBytes, tx: txBytes };
          }
        });
      } catch (e) {}
      lastPollTime = currentTime;

      let interfaces = [];
      if (supportsJson) {
        const ipData = JSON.parse(execSync('ip -j addr show').toString());
        interfaces = ipData.filter(iface => iface.ifname !== 'lo' && !iface.ifname.startsWith('veth') && !iface.ifname.startsWith('docker')).map(iface => {
          const addr = (iface.addr_info && iface.addr_info[0]) ? iface.addr_info[0] : {};
          return {
            id: iface.ifname,
            name: iface.ifname.toUpperCase(),
            interfaceName: iface.ifname,
            status: iface.operstate === 'UP' || iface.flags.includes('UP') ? 'UP' : 'DOWN',
            ipAddress: addr.local || 'N/A',
            gateway: gateways[iface.ifname] || 'None',
            throughput: traffic[iface.ifname] || { rx: 0, tx: 0 },
            weight: 1, priority: 1 
          };
        });
      }
      res.json(interfaces);
    } catch (err) {
      log(`Error /interfaces: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/bridges', (req, res) => {
    res.json(nexusConfig.bridges || []);
  });

  app.post('/api/bridges/apply', (req, res) => {
    const { bridges } = req.body;
    nexusConfig.bridges = bridges;
    saveConfig();

    const kernelLog = [];
    try {
      if (process.platform !== 'linux') return res.json({ success: true, log: ['Dev-Mode: Config Saved'] });

      for(const bridge of bridges) {
        try { execSync(`ip link add name ${bridge.name} type bridge`, { stdio: 'ignore' }); kernelLog.push(`Created bridge ${bridge.name}`); } catch(e) {}
        execSync(`ip link set ${bridge.name} up`);

        if (bridge.ipAddress) {
           try { 
             execSync(`ip addr flush dev ${bridge.name}`);
             execSync(`ip addr add ${bridge.ipAddress}/${bridge.netmask || '24'} dev ${bridge.name}`); 
             kernelLog.push(`Assigned IP ${bridge.ipAddress}/${bridge.netmask} to ${bridge.name}`);
           } catch(e) { kernelLog.push(`Warning setting IP for ${bridge.name}: ${e.message}`); }
        }

        for(const iface of bridge.interfaces) {
           try { 
             execSync(`ip link set ${iface} master ${bridge.name}`); 
             execSync(`ip link set ${iface} up`);
             kernelLog.push(`Added ${iface} to ${bridge.name}`); 
           } catch(e) { kernelLog.push(`Error adding ${iface} to ${bridge.name}: ${e.message}`); }
        }

        if (bridge.dhcpEnabled && bridge.dhcpStart && bridge.dhcpEnd) {
          const configStr = `interface=${bridge.name}\ndhcp-range=${bridge.dhcpStart},${bridge.dhcpEnd},${bridge.leaseTime || '12h'}\ndhcp-option=option:dns-server,8.8.8.8,1.1.1.1\n`;
          fs.writeFileSync(`/etc/dnsmasq.d/nexus-${bridge.name}.conf`, configStr);
          kernelLog.push(`DHCP config (with DNS push) written for ${bridge.name}`);
        } else {
          try { 
            const path = `/etc/dnsmasq.d/nexus-${bridge.name}.conf`;
            if (fs.existsSync(path)) fs.unlinkSync(path); 
          } catch(e) {}
        }
      }
      
      try { execSync('systemctl restart dnsmasq'); kernelLog.push('DHCP Server (dnsmasq) Restarted'); } 
      catch(e) { kernelLog.push('DHCP Restart FAILED: Port 53 conflict.'); }

      const fwLogs = refreshFirewall();
      kernelLog.push(...fwLogs);

      res.json({ success: true, log: kernelLog });
    } catch (err) {
      log(`Error /bridges/apply: ${err.message}`);
      res.status(500).json({ error: err.message, success: false });
    }
  });

  app.post('/api/system/fix-dns-conflict', (req, res) => {
    const kernelLog = [];
    try {
      if (process.platform !== 'linux') return res.json({ success: true, log: ['Dev-Mode: Emulated Fix OK'] });
      
      log('Fixing DNS Port 53 Conflict (stopping systemd-resolved)...');
      execSync('systemctl stop systemd-resolved');
      execSync('systemctl disable systemd-resolved');
      kernelLog.push('systemd-resolved STOPPED and DISABLED.');
      
      try {
        execSync('systemctl restart dnsmasq');
        kernelLog.push('dnsmasq successfully restarted on Port 53.');
      } catch (e) {
        kernelLog.push('dnsmasq failed to restart: ' + e.message);
      }
      
      res.json({ success: true, log: kernelLog });
    } catch (err) {
      log(`Error /system/fix-dns-conflict: ${err.message}`);
      res.status(500).json({ error: err.message, success: false });
    }
  });

  app.get('/api/metrics', (req, res) => {
    try {
      if (process.platform !== 'linux') return res.json({ cpuUsage: 0, memoryUsage: '0', temp: 'N/A', uptime: 'N/A', activeSessions: 0 });
      const load = fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0];
      const mem = fs.readFileSync('/proc/meminfo', 'utf8').split('\n');
      const totalMem = parseInt((mem.find(l => l.startsWith('MemTotal:')) || "0").replace(/\D/g, '')) / 1024;
      const freeMem = parseInt((mem.find(l => l.startsWith('MemAvailable:')) || "0").replace(/\D/g, '')) / 1024;
      let temp = 'N/A';
      try { if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) temp = (parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000).toFixed(1) + '°C'; } catch (e) {}
      let uptime = 'N/A';
      try { uptime = execSync('uptime -p').toString().trim(); } catch (e) {}

      res.json({ cpuUsage: parseFloat(load) * 10, memoryUsage: ((totalMem - freeMem) / 1024).toFixed(1), temp, uptime, activeSessions: 0 });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/apply', (req, res) => {
    const { mode, wanInterfaces } = req.body;
    nexusConfig.wanConfig = { mode, interfaces: wanInterfaces };
    saveConfig();
    const kernelLog = [];
    try {
      if (process.platform !== 'linux') return res.json({ success: true, log: ['Dev-Mode: Config Saved'] });
      
      execSync('sysctl -w net.ipv4.ip_forward=1');
      try { execSync('ip route del default'); } catch (e) {}
      
      if (mode === 'LOAD_BALANCER') {
        let cmd = 'ip route add default ';
        const valid = wanInterfaces.filter(w => w.status === 'UP' && w.gateway && w.gateway !== 'None');
        if (valid.length > 0) {
          valid.forEach(w => { cmd += `nexthop via ${w.gateway} dev ${w.interfaceName} weight ${w.weight || 1} `; });
          execSync(cmd);
          kernelLog.push('Kernel: Multi-WAN Load Balancing ACTIVE');
        }
      } else {
        const primary = wanInterfaces.sort((a,b) => (a.priority || 1) - (b.priority || 1))[0];
        if (primary && primary.gateway && primary.gateway !== 'None') {
          execSync(`ip route add default via ${primary.gateway} dev ${primary.interfaceName}`);
          kernelLog.push(`Kernel: HA-Failover set to Primary -> ${primary.interfaceName}`);
        }
      }

      const fwLogs = refreshFirewall();
      kernelLog.push(...fwLogs);

      res.json({ success: true, log: kernelLog });
    } catch (err) {
      res.status(500).json({ error: err.message, success: false });
    }
  });

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => { log(`Nexus Agent Active on Port ${PORT}`); });

} catch (globalError) {
  log(`CRITICAL STARTUP ERROR: ${globalError.message}`);
  process.exit(1);
}
