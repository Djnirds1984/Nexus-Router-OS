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

// Global state for precise CPU rate calculation
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
  } catch (e) {
    return [];
  }
}

// Initialize CPU tracking
lastCpuStats = getCpuStats();

// Background loop to keep CPU metrics "Hot" (1 second interval)
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

// Global state for traffic rate calculation
let prevTraffic = {};
let lastTrafficPollTime = Date.now();

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

try {
  const express = require('express');
  const cors = require('cors');

  const app = express();
  app.use(cors());
  app.use(express.json());

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
            } else {
              traffic[name] = { rx: 0, tx: 0 };
            }
            prevTraffic[name] = { rx: rxBytes, tx: txBytes };
          }
        });
      } catch (e) {}
      lastTrafficPollTime = currentTime;

      const ipData = JSON.parse(execSync('ip -j addr show').toString());
      const interfaces = ipData.filter(iface => iface.ifname !== 'lo' && !iface.ifname.startsWith('veth')).map(iface => {
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
      res.json(interfaces);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/metrics', (req, res) => {
    try {
      if (process.platform !== 'linux') {
        return res.json({ cpuUsage: 15, cores: [10, 20, 30, 40], memoryUsage: '2.4', totalMem: '16.0', temp: '45.0°C', uptime: 'Up 1 hour', activeSessions: 42 });
      }
      
      // Memory Logic
      const memLines = fs.readFileSync('/proc/meminfo', 'utf8').split('\n');
      const getMemKB = (key) => parseInt((memLines.find(l => l.startsWith(key)) || "0").replace(/\D/g, ''));
      const totalMem = getMemKB('MemTotal:');
      const availableMem = getMemKB('MemAvailable:');
      const usedMem = totalMem - availableMem;

      // Temp Logic
      let temp = 'N/A';
      try {
        if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
          temp = (parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000).toFixed(1) + '°C';
        }
      } catch (e) {}

      let uptime = 'N/A';
      try { uptime = execSync('uptime -p').toString().replace('up ', '').trim(); } catch (e) {}

      res.json({ 
        cpuUsage: cpuUsageHistory.reduce((a, b) => a + b, 0) / (cpuUsageHistory.length || 1), 
        cores: cpuUsageHistory,
        memoryUsage: (usedMem / 1024 / 1024).toFixed(1), 
        totalMem: (totalMem / 1024 / 1024).toFixed(1),
        temp, 
        uptime, 
        activeSessions: 124 
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => { log(`Nexus Agent Active on Port ${PORT}`); });

} catch (globalError) {
  log(`CRITICAL STARTUP ERROR: ${globalError.message}`);
  process.exit(1);
}
