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

log('>>> NEXUS AGENT STARTING UP <<<');

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

  const getGateways = () => {
    try {
      const routes = execSync('ip route show').toString();
      const gatewayMap = {};
      routes.split('\n').forEach(line => {
        if (line.includes('default via')) {
          const parts = line.split(/\s+/);
          const devIndex = parts.indexOf('dev');
          if (devIndex !== -1 && parts[devIndex + 1]) {
            gatewayMap[parts[devIndex + 1]] = parts[2];
          }
        }
      });
      return gatewayMap;
    } catch (e) { return {}; }
  };

  const getTrafficStats = () => {
    try {
      if (!fs.existsSync('/proc/net/dev')) return {};
      const data = fs.readFileSync('/proc/net/dev', 'utf8');
      const lines = data.split('\n').slice(2);
      const stats = {};
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 1) {
          const name = parts[0].replace(':', '');
          stats[name] = {
            rx: parseInt(parts[1]) / 1024 / 1024,
            tx: parseInt(parts[9]) / 1024 / 1024
          };
        }
      });
      return stats;
    } catch (e) { return {}; }
  };

  app.get('/api/interfaces', (req, res) => {
    try {
      if (process.platform !== 'linux') {
        return res.json([{ id: 'eth0', name: 'WAN1', interfaceName: 'eth0', status: 'UP', ipAddress: '127.0.0.1', gateway: '1.1.1.1', throughput: { rx: 0, tx: 0 }, weight: 1, priority: 1 }]);
      }
      let interfaces = [];
      const traffic = getTrafficStats();
      const gateways = getGateways();

      if (supportsJson) {
        const ipData = JSON.parse(execSync('ip -j addr show').toString());
        interfaces = ipData.filter(iface => iface.ifname !== 'lo' && !iface.ifname.startsWith('br-') && !iface.ifname.startsWith('docker')).map(iface => {
          const addr = (iface.addr_info && iface.addr_info[0]) ? iface.addr_info[0] : {};
          return {
            id: iface.ifname,
            name: iface.ifname.toUpperCase(),
            interfaceName: iface.ifname,
            status: iface.operstate === 'UP' ? 'UP' : 'DOWN',
            ipAddress: addr.local || 'N/A',
            gateway: gateways[iface.ifname] || 'None',
            throughput: traffic[iface.ifname] || { rx: 0, tx: 0 },
            weight: 1, priority: 1 
          };
        });
      } else {
        const output = execSync('ip addr show').toString();
        const names = output.match(/^\d+: ([^:@\s]+)/gm);
        if (names) {
          interfaces = names.map(n => {
            const name = n.split(': ')[1];
            return { id: name, name: name.toUpperCase(), interfaceName: name, status: 'UP', ipAddress: 'N/A', gateway: gateways[name] || 'None', throughput: traffic[name] || { rx: 0, tx: 0 }, weight: 1, priority: 1 };
          }).filter(i => i.id !== 'lo');
        }
      }
      res.json(interfaces);
    } catch (err) {
      log(`Error /interfaces: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/bridges', (req, res) => {
    // Return the persisted bridge configuration as the source of truth
    res.json(nexusConfig.bridges || []);
  });

  app.post('/api/bridges/apply', (req, res) => {
    const { bridges } = req.body;
    nexusConfig.bridges = bridges;
    saveConfig();

    const kernelLog = [];
    try {
      if (process.platform !== 'linux') return res.json({ success: true, log: ['Dev-Mode: Config Saved'] });

      // Clean up deleted bridges (simplified: we just re-create everything based on current state)
      // In a real production environment, you would diff the bridges
      
      for(const bridge of bridges) {
        // Create bridge if not exists
        try { 
          execSync(`ip link add name ${bridge.name} type bridge`, { stdio: 'ignore' }); 
          kernelLog.push(`Created bridge ${bridge.name}`); 
        } catch(e) {}
        
        // Ensure bridge is UP
        execSync(`ip link set ${bridge.name} up`);

        // Assign IP (Flush existing first to avoid duplicate errors)
        if (bridge.ipAddress) {
           try { 
             execSync(`ip addr flush dev ${bridge.name}`);
             execSync(`ip addr add ${bridge.ipAddress}/${bridge.netmask || '24'} dev ${bridge.name}`); 
             kernelLog.push(`Assigned IP ${bridge.ipAddress}/${bridge.netmask} to ${bridge.name}`);
           } catch(e) {
             kernelLog.push(`Warning setting IP for ${bridge.name}: ${e.message}`);
           }
        }

        // Add member interfaces
        for(const iface of bridge.interfaces) {
           try { 
             execSync(`ip link set ${iface} up`);
             execSync(`ip link set ${iface} master ${bridge.name}`); 
             kernelLog.push(`Added ${iface} to ${bridge.name}`); 
           } catch(e) {
             kernelLog.push(`Error adding ${iface} to ${bridge.name}: ${e.message}`);
           }
        }

        // DHCP Logic with dnsmasq
        if (bridge.dhcpEnabled && bridge.dhcpStart && bridge.dhcpEnd) {
          const configStr = `interface=${bridge.name}\ndhcp-range=${bridge.dhcpStart},${bridge.dhcpEnd},${bridge.leaseTime || '12h'}\n`;
          const configPath = `/etc/dnsmasq.d/nexus-${bridge.name}.conf`;
          try {
            fs.writeFileSync(configPath, configStr);
            kernelLog.push(`DHCP config written for ${bridge.name}`);
          } catch(e) {
            kernelLog.push(`Error writing DHCP config for ${bridge.name}: ${e.message}`);
          }
        } else {
          try { 
            const configPath = `/etc/dnsmasq.d/nexus-${bridge.name}.conf`;
            if (fs.existsSync(configPath)) fs.unlinkSync(configPath); 
          } catch(e) {}
        }
      }
      
      try { 
        execSync('systemctl restart dnsmasq'); 
        kernelLog.push('DHCP Server (dnsmasq) Restarted'); 
      } catch(e) { 
        kernelLog.push('Error restarting dnsmasq: ' + e.message); 
      }

      res.json({ success: true, log: kernelLog });
    } catch (err) {
      log(`Error /bridges/apply: ${err.message}`);
      res.status(500).json({ error: err.message, success: false });
    }
  });

  app.get('/api/metrics', (req, res) => {
    try {
      if (process.platform !== 'linux') {
        return res.json({ cpuUsage: 0, memoryUsage: '0', temp: 'N/A', uptime: 'N/A', activeSessions: 0 });
      }
      const load = fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0];
      const mem = fs.readFileSync('/proc/meminfo', 'utf8').split('\n');
      const totalMem = parseInt((mem.find(l => l.startsWith('MemTotal:')) || "0").replace(/\D/g, '')) / 1024;
      const freeMem = parseInt((mem.find(l => l.startsWith('MemAvailable:')) || "0").replace(/\D/g, '')) / 1024;
      
      let temp = 'N/A';
      try {
        if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
          temp = (parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000).toFixed(1) + '°C';
        }
      } catch (e) {}

      let uptime = 'N/A';
      try { uptime = execSync('uptime -p').toString().trim(); } catch (e) {}

      res.json({
        cpuUsage: parseFloat(load) * 10,
        memoryUsage: ((totalMem - freeMem) / 1024).toFixed(1),
        temp,
        uptime,
        activeSessions: 0
      });
    } catch (err) {
      log(`Error /metrics: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/apply', (req, res) => {
    const { mode, wanInterfaces } = req.body;
    nexusConfig.wanConfig = { mode, interfaces: wanInterfaces };
    saveConfig();

    const kernelLog = [];
    try {
      log(`Applying Kernel Config: Mode=${mode}`);
      if (process.platform !== 'linux') return res.json({ success: true, log: ['Dev-Mode: Config Saved'] });

      execSync('sysctl -w net.ipv4.ip_forward=1');
      kernelLog.push('Kernel: IPv4 Forwarding ENABLED');

      try { execSync('ip route del default'); } catch (e) {}
      kernelLog.push('Kernel: Routing Table FLUSHED');

      if (mode === 'LOAD_BALANCER') {
        let routeCmd = 'ip route add default ';
        const validWan = wanInterfaces.filter(wan => wan.status === 'UP' && wan.gateway && wan.gateway !== 'None');
        if (validWan.length > 0) {
          validWan.forEach(wan => {
            routeCmd += `nexthop via ${wan.gateway} dev ${wan.interfaceName} weight ${wan.weight || 1} `;
          });
          execSync(routeCmd);
          kernelLog.push('Kernel: Multi-WAN Load Balancing (ECMP) ACTIVE');
        }
      } else {
        const primary = wanInterfaces.sort((a,b) => (a.priority || 1) - (b.priority || 1))[0];
        if (primary && primary.gateway && primary.gateway !== 'None') {
          execSync(`ip route add default via ${primary.gateway} dev ${primary.interfaceName}`);
          kernelLog.push(`Kernel: HA-Failover set to Primary -> ${primary.interfaceName}`);
        }
      }
      res.json({ success: true, log: kernelLog });
    } catch (err) {
      log(`Error /apply: ${err.message}`);
      res.status(500).json({ error: err.message, success: false });
    }
  });

  const PORT = 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    log(`-------------------------------------------`);
    log(` Nexus Hardware Agent Active`);
    log(` Port: ${PORT}`);
    log(` Status: LISTENING`);
    log(`-------------------------------------------`);
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      log(`CRITICAL: Port ${PORT} already in use. Run 'sudo fuser -k 3000/tcp'.`);
    } else {
      log(`FATAL: ${e.message}`);
    }
    process.exit(1);
  });

} catch (globalError) {
  log(`CRITICAL STARTUP ERROR: ${globalError.message}`);
  log(`Ensure you ran 'npm install express cors' inside /var/www/html/Nexus-Router-Os`);
  process.exit(1);
}
