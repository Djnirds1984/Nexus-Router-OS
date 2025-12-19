const express = require('express');
const { execSync } = require('child_process');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

/**
 * FETCH REAL GATEWAYS
 * Uses 'ip route' to find the actual gateways for interfaces
 */
const getGateways = () => {
  try {
    const routes = execSync('ip route show').toString();
    const gatewayMap = {};
    routes.split('\n').forEach(line => {
      if (line.startsWith('default via')) {
        const parts = line.split(' ');
        const devIndex = parts.indexOf('dev');
        if (devIndex !== -1 && parts[devIndex + 1]) {
          gatewayMap[parts[devIndex + 1]] = parts[2];
        }
      }
    });
    return gatewayMap;
  } catch (e) { return {}; }
};

/**
 * FETCH TRAFFIC STATS
 */
const getTrafficStats = () => {
  try {
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
    // Check if running on Linux
    if (process.platform !== 'linux') {
      return res.json([
        { id: 'eth0', name: 'DEMO INTERFACE', interfaceName: 'eth0', status: 'UP', ipAddress: '192.168.1.10', gateway: '192.168.1.1', throughput: { rx: 1.2, tx: 0.4 }, latency: 15, weight: 50, priority: 1 }
      ]);
    }

    const ipData = JSON.parse(execSync('ip -j addr show').toString());
    const traffic = getTrafficStats();
    const gateways = getGateways();
    
    const interfaces = ipData.filter(iface => iface.ifname !== 'lo').map(iface => {
      const addr = iface.addr_info[0] || {};
      return {
        id: iface.ifname,
        name: iface.ifname.toUpperCase(),
        interfaceName: iface.ifname,
        status: iface.operstate === 'UP' ? 'UP' : 'DOWN',
        ipAddress: addr.local || 'N/A',
        gateway: gateways[iface.ifname] || 'Static/None',
        throughput: traffic[iface.ifname] || { rx: 0, tx: 0 },
        latency: 0,
        weight: 1, 
        priority: 1 
      };
    });
    res.json(interfaces);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/metrics', (req, res) => {
  try {
    if (process.platform !== 'linux') {
      return res.json({ cpuUsage: 5, memoryUsage: '1.2', temp: '42°C', uptime: 'Simulation', activeSessions: 10 });
    }

    const load = fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0];
    const mem = fs.readFileSync('/proc/meminfo', 'utf8').split('\n');
    const totalMem = parseInt(mem[0].replace(/\D/g, '')) / 1024;
    const freeMem = parseInt(mem[2].replace(/\D/g, '')) / 1024;
    
    let temp = 'N/A';
    try {
      temp = (parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000).toFixed(1) + '°C';
    } catch (e) {}

    res.json({
      cpuUsage: parseFloat(load) * 10,
      memoryUsage: ((totalMem - freeMem) / 1024).toFixed(1),
      temp,
      uptime: execSync('uptime -p').toString().trim(),
      activeSessions: parseInt(execSync('ss -t | wc -l').toString())
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apply', (req, res) => {
  const { mode, wanInterfaces } = req.body;
  const log = [];
  try {
    if (process.platform !== 'linux') {
      return res.json({ success: true, log: ['Simulation: Applied config to virtual stack.'] });
    }

    // 1. IP Forwarding
    execSync('sysctl -w net.ipv4.ip_forward=1');
    log.push('Kernel: Enabled IPv4 Forwarding');

    // 2. Clear Default Routes
    try { execSync('ip route del default'); } catch (e) {}
    log.push('Kernel: Purged existing routing cache');

    if (mode === 'LOAD_BALANCER') {
      let routeCmd = 'ip route add default ';
      wanInterfaces.forEach(wan => {
        if (wan.status === 'UP' && wan.gateway !== 'Static/None' && wan.gateway !== 'N/A') {
          routeCmd += `nexthop via ${wan.gateway} dev ${wan.interfaceName} weight ${wan.weight || 1} `;
        }
      });
      execSync(routeCmd);
      log.push('Kernel: Multipath ECMP load balancing active');
    } else {
      const primary = wanInterfaces.sort((a,b) => (a.priority || 1) - (b.priority || 1))[0];
      if (primary && primary.gateway !== 'Static/None' && primary.gateway !== 'N/A') {
        execSync(`ip route add default via ${primary.gateway} dev ${primary.interfaceName}`);
        log.push(`Kernel: Failover active - Primary route via ${primary.interfaceName}`);
      }
    }

    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Nexus Core Agent running on port ${PORT}`);
  console.log('System Status: READY');
});