/**
 * Nexus Router OS - Hardware Agent
 * This script must run as root to interact with the Linux kernel (iproute2).
 */

// Defensive module loading to catch missing dependencies
try {
  const express = require('express');
  const cors = require('cors');
  const { execSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Log all requests for debugging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  /**
   * Diagnostic Check: Ensure iproute2 supports JSON
   */
  let supportsJson = false;
  try {
    execSync('ip -j addr show', { stdio: 'ignore' });
    supportsJson = true;
    console.log('Kernel Check: ip-json support detected.');
  } catch (e) {
    console.warn('Kernel Check: ip-json NOT supported. Falling back to text parsing.');
  }

  /**
   * FETCH REAL GATEWAYS
   */
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
    } catch (e) { 
      console.error('Gateway Lookup Error:', e.message);
      return {}; 
    }
  };

  /**
   * FETCH TRAFFIC STATS
   */
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
    } catch (e) { 
      console.error('ProcNetDev Read Error:', e.message);
      return {}; 
    }
  };

  app.get('/api/interfaces', (req, res) => {
    try {
      if (process.platform !== 'linux') {
        return res.json([{ id: 'demo', name: 'DEMO', interfaceName: 'eth0', status: 'UP', ipAddress: '127.0.0.1', gateway: '127.0.0.1', throughput: { rx: 0, tx: 0 }, weight: 1, priority: 1 }]);
      }

      let interfaces = [];
      const traffic = getTrafficStats();
      const gateways = getGateways();

      if (supportsJson) {
        const ipData = JSON.parse(execSync('ip -j addr show').toString());
        interfaces = ipData.filter(iface => iface.ifname !== 'lo' && !iface.ifname.startsWith('br-')).map(iface => {
          const addr = (iface.addr_info && iface.addr_info[0]) ? iface.addr_info[0] : {};
          return {
            id: iface.ifname,
            name: iface.ifname.toUpperCase(),
            interfaceName: iface.ifname,
            status: iface.operstate === 'UP' ? 'UP' : 'DOWN',
            ipAddress: addr.local || 'N/A',
            gateway: gateways[iface.ifname] || 'None',
            throughput: traffic[iface.ifname] || { rx: 0, tx: 0 },
            weight: 1, 
            priority: 1 
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
      console.error('API Error /interfaces:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/metrics', (req, res) => {
    try {
      if (process.platform !== 'linux') {
        return res.json({ cpuUsage: 0, memoryUsage: '0', temp: 'N/A', uptime: 'N/A', activeSessions: 0 });
      }

      const load = fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0];
      const mem = fs.readFileSync('/proc/meminfo', 'utf8').split('\n');
      const totalMemLine = mem.find(l => l.startsWith('MemTotal:')) || "0";
      const freeMemLine = mem.find(l => l.startsWith('MemAvailable:')) || "0";
      
      const totalMem = parseInt(totalMemLine.replace(/\D/g, '')) / 1024;
      const freeMem = parseInt(freeMemLine.replace(/\D/g, '')) / 1024;
      
      let temp = 'N/A';
      try {
        if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
          temp = (parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000).toFixed(1) + '°C';
        }
      } catch (e) {}

      let uptime = 'N/A';
      try { uptime = execSync('uptime -p').toString().trim(); } catch (e) {}

      let sessions = 0;
      try { sessions = parseInt(execSync('ss -t | wc -l').toString()) - 1; } catch (e) {}

      res.json({
        cpuUsage: parseFloat(load) * 10,
        memoryUsage: ((totalMem - freeMem) / 1024).toFixed(1),
        temp,
        uptime,
        activeSessions: sessions
      });
    } catch (err) {
      console.error('API Error /metrics:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/apply', (req, res) => {
    const { mode, wanInterfaces } = req.body;
    const log = [];
    try {
      if (process.platform !== 'linux') {
        return res.json({ success: true, log: ['Dev Environment: Kernel calls bypassed.'] });
      }

      console.log(`Applying Configuration: Mode=${mode}`);
      
      execSync('sysctl -w net.ipv4.ip_forward=1');
      log.push('Kernel: Enabled IPv4 Forwarding');

      try { execSync('ip route del default'); } catch (e) { console.warn('Purge warning:', e.message); }
      log.push('Kernel: Flushed routing table');

      if (mode === 'LOAD_BALANCER') {
        let routeCmd = 'ip route add default ';
        const validWan = wanInterfaces.filter(wan => wan.status === 'UP' && wan.gateway && wan.gateway !== 'None');
        
        if (validWan.length > 0) {
          validWan.forEach(wan => {
            routeCmd += `nexthop via ${wan.gateway} dev ${wan.interfaceName} weight ${wan.weight || 1} `;
          });
          execSync(routeCmd);
          log.push('Kernel: Multi-WAN ECMP active');
        } else {
          log.push('Error: No valid UP interfaces with gateways found.');
          return res.status(400).json({ success: false, log });
        }
      } else {
        const primary = wanInterfaces.sort((a,b) => (a.priority || 1) - (b.priority || 1))[0];
        if (primary && primary.gateway && primary.gateway !== 'None') {
          execSync(`ip route add default via ${primary.gateway} dev ${primary.interfaceName}`);
          log.push(`Kernel: Failover active -> ${primary.interfaceName}`);
        } else {
          log.push('Error: Primary gateway not found.');
          return res.status(400).json({ success: false, log });
        }
      }

      res.json({ success: true, log });
    } catch (err) {
      console.error('API Error /apply:', err);
      res.status(500).json({ error: err.message, success: false });
    }
  });

  const PORT = 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`-------------------------------------------`);
    console.log(` Nexus Hardware Agent Active`);
    console.log(` Port: ${PORT}`);
    console.log(` Path: /var/www/html/Nexus-Router-Os`);
    console.log(`-------------------------------------------`);
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`FATAL: Port ${PORT} is already in use by another process.`);
    } else {
      console.error('FATAL: Server startup error:', e.message);
    }
    process.exit(1);
  });

} catch (globalError) {
  console.error('CRITICAL STARTUP ERROR:', globalError.message);
  console.error('This usually means dependencies (express, cors) are missing.');
  console.error('FIX: Run "cd /var/www/html/Nexus-Router-Os && npm install express cors"');
  process.exit(1);
}
