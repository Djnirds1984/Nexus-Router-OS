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
const backupPath = './nexus-config.backup.json';

function log(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try { fs.appendFileSync(logFile, entry); } catch (e) { }
}

let systemState = {
  interfaces: [],
  metrics: { cpuUsage: 0, cores: [], memoryUsage: '0', totalMem: '0', uptime: '', activeSessions: 0, dnsResolved: true },
  config: { mode: 'LOAD_BALANCER', wanInterfaces: [], bridges: [] }
};

// State for calculating rates per core and per interface
let lastCpuData = {}; // { coreId: { total, idle } }
let lastNetStats = {}; // { iface: { rx, tx, time } }

// Load existing config if available
try {
  let loaded = null;
  if (fs.existsSync(configPath)) {
    loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else if (fs.existsSync(backupPath)) {
    loaded = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    fs.writeFileSync(configPath, JSON.stringify(loaded));
  }
  if (loaded) {
    systemState.config = loaded;
  }
} catch (e) { log('Failed to load config'); }

try {
  applyDhcp(systemState.config.dhcp);
} catch (e) { log('Boot DHCP apply skipped'); }

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
 * REAL THROUGHPUT FETCH (Mbps) from /proc/net/dev
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

// 1s Polling for Real-Time Hardware Statistics
setInterval(async () => {
  if (process.platform !== 'linux') {
    systemState.interfaces = [{ id: 'eth0', name: 'WAN1', interfaceName: 'eth0', status: 'UP', ipAddress: '192.168.1.10', gateway: '192.168.1.1', internetHealth: 'HEALTHY', latency: 12, throughput: { rx: 5.2, tx: 1.5 } }];
    systemState.metrics = { cpuUsage: 15, cores: [10, 15, 20, 12], memoryUsage: '4.4', totalMem: '16.0', uptime: '1h 22m', activeSessions: 42, dnsResolved: true };
    return;
  }

  try {
    // 1. Interfaces & Real Throughput
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

    // 2. Real Per-Core CPU Stats
    const statsLines = fs.readFileSync('/proc/stat', 'utf8').split('\n');
    const coreMetrics = [];
    let aggregateUsage = 0;

    statsLines.forEach(line => {
      if (line.startsWith('cpu')) {
        const parts = line.trim().split(/\s+/);
        const coreId = parts[0];
        const stats = parts.slice(1).map(Number);
        const total = stats.reduce((a, b) => a + b, 0);
        const idle = stats[3];

        if (lastCpuData[coreId]) {
          const prev = lastCpuData[coreId];
          const diffTotal = total - prev.total;
          const diffIdle = idle - prev.idle;
          const usage = diffTotal === 0 ? 0 : Math.floor((1 - diffIdle / diffTotal) * 100);
          
          if (coreId === 'cpu') aggregateUsage = usage;
          else coreMetrics.push(usage);
        }
        lastCpuData[coreId] = { total, idle };
      }
    });

    // 3. Real RAM Usage Stats
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const memTotal = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]) / 1024 / 1024;
    const memAvailable = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)[1]) / 1024 / 1024;
    const memUsed = memTotal - memAvailable;

    systemState.metrics = {
      cpuUsage: aggregateUsage,
      cores: coreMetrics,
      memoryUsage: memUsed.toFixed(2),
      totalMem: memTotal.toFixed(2),
      uptime: execSync('uptime -p').toString().trim(),
      activeSessions: 0, // In real scenario, parse /proc/net/nf_conntrack_count
      dnsResolved: true
    };
  } catch (e) { log(`Poll Error: ${e.message}`); }
}, 1000);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/interfaces', (req, res) => res.json(systemState.interfaces));
app.get('/api/metrics', (req, res) => res.json(systemState.metrics));
app.get('/api/config', (req, res) => res.json(systemState.config));

function parseDhcpConfig() {
  try {
    const path = fs.existsSync('/etc/dnsmasq.d/nexus-dhcp.conf')
      ? '/etc/dnsmasq.d/nexus-dhcp.conf'
      : (fs.existsSync('/etc/dnsmasq.conf') ? '/etc/dnsmasq.conf' : null);
    if (!path) return { interfaceName: '', start: '', end: '', leaseTime: '', dnsServers: [], dhcpOnly: false, confPath: '' };
    const txt = fs.readFileSync(path, 'utf8');
    const iface = (txt.match(/^interface=(.+)$/m) || [])[1] || '';
    const range = (txt.match(/^dhcp-range=([^\n]+)$/m) || [])[1] || '';
    const dns = (txt.match(/^dhcp-option=option:dns-server,([^\n]+)$/m) || [])[1] || '';
    const parts = range ? range.split(',') : [];
    const start = parts[0] || '';
    const end = parts[1] || '';
    const lease = parts[3] || '';
    const dhcpOnly = /port=0/.test(txt);
    const dnsServers = dns ? dns.split(',').map(s => s.trim()) : [];
    return { interfaceName: iface, start, end, leaseTime: lease, dnsServers, dhcpOnly, confPath: path };
  } catch (e) { return { interfaceName: '', start: '', end: '', leaseTime: '', dnsServers: [], dhcpOnly: false, confPath: '' }; }
}

function getDhcpStatus() {
  let running = false;
  try { running = execSync('systemctl is-active dnsmasq').toString().trim() === 'active'; } catch (e) {}
  const parsed = parseDhcpConfig();
  let gateway = '';
  if (parsed.interfaceName) {
    try {
      const ipj = JSON.parse(execSync(`ip -j addr show ${parsed.interfaceName}`).toString());
      const addr = ((ipj[0] || {}).addr_info || []).find(a => a.family === 'inet');
      gateway = (addr || {}).local || '';
    } catch (e) {}
  }
  return { running, ...parsed, gateway };
}

app.get('/api/dhcp/status', (req, res) => {
  res.json(getDhcpStatus());
});

function applyDhcp(dhcp) {
  if (process.platform !== 'linux') return;
  try {
    if (!dhcp || !dhcp.enabled || !dhcp.interfaceName) return;
    const ipv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
    const iface = dhcp.interfaceName;
    const start = dhcp.start || '';
    const end = dhcp.end || '';
    if (!ipv4.test(start) || !ipv4.test(end)) { log('DHCP VALIDATION: invalid start/end'); return; }
    try { execSync(`ip link show ${iface}`); } catch (e) { log('DHCP VALIDATION: interface not found'); return; }
    const baseS = start.split('.').slice(0,3).join('.');
    const baseE = end.split('.').slice(0,3).join('.');
    if (baseS !== baseE) { log('DHCP VALIDATION: range not in same /24'); return; }
    const gw = `${baseS}.1`;
    execSync(`ip link set ${iface} up`);
    execSync(`ip addr flush dev ${iface}`);
    execSync(`ip addr add ${gw}/24 dev ${iface}`);
    const dnsOpt = (dhcp.dnsServers && (Array.isArray(dhcp.dnsServers) ? dhcp.dnsServers.join(',') : dhcp.dnsServers)) || '8.8.8.8,1.1.1.1';
    const conf = [
      `interface=${iface}`,
      `bind-interfaces`,
      `port=0`,
      `dhcp-authoritative`,
      `dhcp-range=${start},${end},255.255.255.0,${dhcp.leaseTime || '24h'}`,
      `dhcp-option=option:router,${gw}`,
      `dhcp-option=option:dns-server,${dnsOpt}`,
      `log-dhcp`
    ].join('\n');
    fs.writeFileSync('/etc/dnsmasq.d/nexus-dhcp.conf', conf);
    execSync('sysctl -w net.ipv4.ip_forward=1');
    try { execSync('sysctl --system'); } catch (e) {}
    let wan = '';
    try {
      const routes = JSON.parse(execSync('ip -j route show default').toString());
      wan = (routes[0] || {}).dev || '';
    } catch (e) {}
    if (wan) {
      execSync(`iptables -t nat -C POSTROUTING -o ${wan} -j MASQUERADE || iptables -t nat -A POSTROUTING -o ${wan} -j MASQUERADE`);
      execSync(`iptables -C FORWARD -i ${iface} -o ${wan} -j ACCEPT || iptables -A FORWARD -i ${iface} -o ${wan} -j ACCEPT`);
      execSync(`iptables -C FORWARD -i ${wan} -o ${iface} -m state --state RELATED,ESTABLISHED -j ACCEPT || iptables -A FORWARD -i ${wan} -o ${iface} -m state --state RELATED,ESTABLISHED -j ACCEPT`);
    }
    execSync('systemctl restart dnsmasq');
  } catch (e) { log(`DHCP APPLY ERROR: ${e.message}`); }
}

app.post('/api/apply', (req, res) => {
  try {
    systemState.config = req.body;
    fs.writeFileSync(configPath, JSON.stringify(systemState.config));
    fs.writeFileSync(backupPath, JSON.stringify(systemState.config));
    applyMultiWanKernel();
    applyDhcp(systemState.config.dhcp);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3000, '0.0.0.0', () => log('Nexus Agent active on :3000'));
