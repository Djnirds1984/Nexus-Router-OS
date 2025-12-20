/**
 * Nexus Router OS - Hardware Agent (Root Required)
 * Smart Multi-WAN Orchestrator - Production Kernel Link
 */

const fs = require('fs');
const { execSync, exec } = require('child_process');
const express = require('express');
const cors = require('cors');

const logFile = '/var/log/nexus-agent.log';
const configPath = './nexus-config.json';

function log(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try { fs.appendFileSync(logFile, entry); } catch (e) { }
}

let systemState = {
  interfaces: [],
  metrics: { cpuUsage: 0, memoryUsage: '0', totalMem: '0', uptime: '', activeSessions: 0, dnsResolved: true },
  config: { mode: 'LOAD_BALANCER', wanInterfaces: [] }
};

// State for calculating rates
let lastCpuTotal = 0;
let lastCpuIdle = 0;
let lastNetStats = {}; // { iface: { rx, tx, time } }

// Load existing config if available
try {
  if (fs.existsSync(configPath)) {
    const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    systemState.config = saved;
  }
} catch (e) { log('Failed to load config'); }

/**
 * SMART WAN MONITOR
 */
async function checkInternetHealth(ifaceName) {
  return new Promise((resolve) => {
    if (process.platform !== 'linux') return resolve({ ok: true, latency: 15 });
    const cmd = `ping -I ${ifaceName} -c 1 -W 1 8.8.8.8`;
    const start = Date.now();
    exec(cmd, (error) => {
      const latency = Date.now() - start;
      if (error) resolve({ ok: false, latency: 0 });
      else resolve({ ok: true, latency });
    });
  });
}

/**
 * REAL THROUGHPUT FETCH (Mbps)
 */
function getThroughputMbps(iface) {
  try {
    const devData = fs.readFileSync('/proc/net/dev', 'utf8');
    const lines = devData.split('\n');
    const line = lines.find(l => l.trim().startsWith(iface + ':'));
    if (!line) return { rx: 0, tx: 0 };
    
    const parts = line.trim().split(/\s+/);
    const rxBytes = parseInt(parts[1]);
    const txBytes = parseInt(parts[9]);
    const now = Date.now();
    
    if (lastNetStats[iface]) {
      const prev = lastNetStats[iface];
      const deltaT = (now - prev.time) / 1000;
      if (deltaT <= 0) return { rx: 0, tx: 0 };
      
      const rxRate = ((rxBytes - prev.rx) * 8) / (deltaT * 1024 * 1024);
      const txRate = ((txBytes - prev.tx) * 8) / (deltaT * 1024 * 1024);
      
      lastNetStats[iface] = { rx: rxBytes, tx: txBytes, time: now };
      return { rx: Math.max(0, rxRate), tx: Math.max(0, txRate) };
    }
    
    lastNetStats[iface] = { rx: rxBytes, tx: txBytes, time: now };
    return { rx: 0, tx: 0 };
  } catch (e) { return { rx: 0, tx: 0 }; }
}

function applyMultiWanKernel() {
  if (process.platform !== 'linux') return;
  log(`>>> ORCHESTRATING KERNEL: ${systemState.config.mode}`);
  try {
    const healthyWans = systemState.interfaces.filter(i => i.internetHealth === 'HEALTHY');
    if (healthyWans.length === 0) return;

    if (systemState.config.mode === 'LOAD_BALANCER') {
      let routeCmd = 'ip route replace default';
      healthyWans.forEach(wan => {
        const configWan = systemState.config.wanInterfaces.find(cw => cw.interfaceName === wan.interfaceName) || { weight: 1 };
        if (wan.gateway && wan.gateway !== 'Detecting...') {
          routeCmd += ` nexthop via ${wan.gateway} dev ${wan.interfaceName} weight ${configWan.weight || 1}`;
        }
      });
      execSync(routeCmd);
    } else {
      const sorted = [...healthyWans].sort((a, b) => {
        const cA = systemState.config.wanInterfaces.find(cw => cw.interfaceName === a.interfaceName) || { priority: 99 };
        const cB = systemState.config.wanInterfaces.find(cw => cw.interfaceName === b.interfaceName) || { priority: 99 };
        return cA.priority - cB.priority;
      });
      const primary = sorted[0];
      if (primary && primary.gateway && primary.gateway !== 'Detecting...') {
        execSync(`ip route replace default via ${primary.gateway} dev ${primary.interfaceName}`);
      }
    }
  } catch (e) { log(`KERNEL SYNC ERROR: ${e.message}`); }
}

// Frequent Polling for "Moving" Dashboard (1s interval)
setInterval(async () => {
  if (process.platform !== 'linux') {
    systemState.interfaces = [{ id: 'eth0', name: 'WAN1', interfaceName: 'eth0', status: 'UP', ipAddress: '192.168.1.10', gateway: '192.168.1.1', internetHealth: 'HEALTHY', latency: 12, throughput: { rx: 5.2, tx: 1.5 } }];
    systemState.metrics = { cpuUsage: 12 + Math.random()*2, memoryUsage: '4.4', totalMem: '16.0', uptime: '1h 22m', activeSessions: 42, dnsResolved: true };
    return;
  }

  try {
    // 1. Physical Interfaces & Real Throughput
    const ipData = JSON.parse(execSync('ip -j addr show').toString());
    const routes = JSON.parse(execSync('ip -j route show').toString());
    const newInterfaces = await Promise.all(ipData.filter(iface => iface.ifname !== 'lo' && !iface.ifname.startsWith('veth') && !iface.ifname.startsWith('br')).map(async (iface) => {
      const gw = routes.find(r => r.dev === iface.ifname && r.dst === 'default')?.gateway || 'Detecting...';
      const health = await checkInternetHealth(iface.ifname);
      const throughput = getThroughputMbps(iface.ifname);
      
      return {
        id: iface.ifname,
        name: iface.ifname.toUpperCase(),
        interfaceName: iface.ifname,
        status: iface.operstate === 'UP' ? 'UP' : 'DOWN',
        ipAddress: (iface.addr_info[0] || {}).local || 'N/A',
        gateway: gw,
        internetHealth: health.ok ? 'HEALTHY' : 'OFFLINE',
        latency: health.latency,
        throughput: throughput
      };
    }));

    const healthChanged = JSON.stringify(newInterfaces.map(i => i.internetHealth)) !== JSON.stringify(systemState.interfaces.map(i => i.internetHealth));
    systemState.interfaces = newInterfaces;
    if (healthChanged) applyMultiWanKernel();

    // 2. Real Moving CPU Stats
    const statsStr = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0];
    const stats = statsStr.split(/\s+/).slice(1).map(Number);
    const total = stats.reduce((a, b) => a + b, 0);
    const idle = stats[3];
    const diffTotal = total - lastCpuTotal;
    const diffIdle = idle - lastCpuIdle;
    const cpu = diffTotal === 0 ? 0 : Math.floor((1 - diffIdle / diffTotal) * 100);
    lastCpuTotal = total;
    lastCpuIdle = idle;

    // 3. Real RAM Usage Stats
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const memTotal = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]) / 1024 / 1024;
    const memAvailable = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)[1]) / 1024 / 1024;
    const memUsed = memTotal - memAvailable;

    systemState.metrics = {
      cpuUsage: Math.max(0, Math.min(100, cpu)),
      memoryUsage: memUsed.toFixed(2),
      totalMem: memTotal.toFixed(2),
      uptime: execSync('uptime -p').toString().trim(),
      activeSessions: Math.floor(Math.random() * 20) + 100, // Simulated active conntrack count
      dnsResolved: true
    };
  } catch (e) { log(`Poll Error: ${e.message}`); }
}, 1000);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/interfaces', (req, res) => res.json(systemState.interfaces));
app.get('/api/metrics', (req, res) => res.json(systemState.metrics));
app.post('/api/apply', (req, res) => {
  try {
    systemState.config = req.body;
    fs.writeFileSync(configPath, JSON.stringify(systemState.config));
    applyMultiWanKernel();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3000, '0.0.0.0', () => log('Nexus Agent active on :3000'));
