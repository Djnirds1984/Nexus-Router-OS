
const express = require('express');
const { execSync, exec } = require('child_process');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Helper to get real interface stats from /proc/net/dev
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
          rx: parseInt(parts[1]) / 1024 / 1024, // MB
          tx: parseInt(parts[9]) / 1024 / 1024  // MB
        };
      }
    });
    return stats;
  } catch (e) { return {}; }
};

app.get('/api/interfaces', (req, res) => {
  try {
    // Fetch real IP and link data from the kernel
    const ipData = JSON.parse(execSync('ip -j addr show').toString());
    const traffic = getTrafficStats();
    
    const interfaces = ipData.filter(iface => iface.ifname !== 'lo').map(iface => {
      const addr = iface.addr_info[0] || {};
      return {
        id: iface.ifname,
        name: iface.ifname.toUpperCase(),
        interfaceName: iface.ifname,
        status: iface.operstate === 'UP' ? 'UP' : 'DOWN',
        ipAddress: addr.local || '0.0.0.0',
        gateway: 'Detecting...', // Simplified for this implementation
        throughput: traffic[iface.ifname] || { rx: 0, tx: 0 },
        latency: 0
      };
    });
    res.json(interfaces);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apply', (req, res) => {
  const { mode, wanInterfaces } = req.body;
  const commands = [];

  try {
    // 1. Enable IP Forwarding
    commands.push('sysctl -w net.ipv4.ip_forward=1');
    
    // 2. Clear existing multipath routes
    commands.push('ip route del default || true');

    if (mode === 'LOAD_BALANCER') {
      // Build nexthop command
      let routeCmd = 'ip route add default ';
      wanInterfaces.forEach(wan => {
        if (wan.status === 'UP') {
          routeCmd += `nexthop via ${wan.gateway} dev ${wan.interfaceName} weight ${wan.weight} `;
        }
      });
      commands.push(routeCmd);
    } else {
      // Failover logic (simplified to primary)
      const primary = wanInterfaces.sort((a,b) => a.priority - b.priority)[0];
      commands.push(`ip route add default via ${primary.gateway} dev ${primary.interfaceName}`);
    }

    // Execute commands (In production, use more safety)
    commands.forEach(cmd => {
      console.log(`Executing: ${cmd}`);
      // execSync(cmd); // UNCOMMENT TO RUN REAL CMDS
    });

    res.json({ success: true, commands });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/metrics', (req, res) => {
  const load = fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0];
  const mem = fs.readFileSync('/proc/meminfo', 'utf8').split('\n');
  const totalMem = parseInt(mem[0].replace(/\D/g, '')) / 1024 / 1024;
  const freeMem = parseInt(mem[2].replace(/\D/g, '')) / 1024 / 1024;
  
  res.json({
    cpuUsage: parseFloat(load) * 10, // Normalized for UI
    memoryUsage: (totalMem - freeMem).toFixed(1),
    uptime: execSync('uptime -p').toString().trim(),
    activeSessions: parseInt(execSync('ss -t | wc -l').toString())
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Nexus Core Agent running on port ${PORT}`));
