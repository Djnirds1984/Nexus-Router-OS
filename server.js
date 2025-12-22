/**
 * Nexus Router OS - Hardware Agent (Root Required)
 * Smart Multi-WAN Orchestrator - Production Kernel Link
 */

const fs = require('fs');
const { execSync, exec } = require('child_process');
const express = require('express');
const cors = require('cors');
const https = require('https');

const logFile = '/var/log/nexus-agent.log';
const configPath = './nexus-config.json';
const backupPath = './nexus-config.backup.json';
const installLog = '/var/log/nexus-init.log';
const stateDir = '/var/lib/nexus';
const stampPath = '/var/lib/nexus/initialized.flag';
const tokenPath = '/etc/nexus/api.token';

function logInstall(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(installLog, entry); } catch (e) {}
}

try { fs.mkdirSync('/etc/nexus', { recursive: true }); fs.mkdirSync(stateDir, { recursive: true }); } catch (e) {}

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
let pollingBusy = false;
let healthCache = {};
let lastUptimeStr = '';
let lastUptimeAt = 0;

// Load existing config if available
try {
  let loaded = null;
  if (fs.existsSync(configPath)) {
    loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else if (fs.existsSync(backupPath)) {
    loaded = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    fs.writeFileSync(configPath, JSON.stringify(loaded));
    logInstall('restore-config-from-backup');
  }
  if (loaded) {
    systemState.config = loaded;
  }
} catch (e) { log('Failed to load config'); }

function sh(cmd) { logInstall(`run:${cmd}`); return execSync(cmd).toString(); }
function ensurePkg(pkg) { try { execSync(`dpkg -s ${pkg}`); logInstall(`pkg-ok:${pkg}`); } catch (e) { try { execSync('apt-get update -y'); execSync(`apt-get install -y ${pkg}`); logInstall(`pkg-install:${pkg}`); } catch (err) { throw new Error(`pkg-failed:${pkg}`); } } }
function validateEnvironment() { if (process.platform !== 'linux') throw new Error('os-invalid'); try { if (process.getuid && process.getuid() !== 0) throw new Error('need-root'); } catch (e) {} const meminfo = fs.readFileSync('/proc/meminfo','utf8'); const mt = parseInt((meminfo.match(/MemTotal:\s+(\d+)/)||[])[1]||'0'); if (mt < 256000) throw new Error('mem-low'); }
function applyDefaults() { try { if (!fs.existsSync('/etc/dnsmasq.d/nexus-dhcp.conf')) { fs.writeFileSync('/etc/dnsmasq.d/nexus-dhcp.conf', 'port=0\nlog-dhcp'); logInstall('write:dnsmasq-default'); } } catch (e) { logInstall('write-failed:dnsmasq'); } }
function verifyComponents() { try { execSync('systemctl is-enabled dnsmasq'); logInstall('verify:dnsmasq-enabled'); } catch (e) { logInstall('verify:dnsmasq-not-enabled'); } }
function rollbackInit() { try { logInstall('rollback-start'); } catch (e) {} }
function runInitialization() { try { validateEnvironment(); ensurePkg('dnsmasq'); ensurePkg('iproute2'); try { ensurePkg('iptables'); } catch (e) { ensurePkg('nftables'); } applyDefaults(); verifyComponents(); fs.writeFileSync(stampPath, new Date().toISOString()); logInstall('initialized'); } catch (e) { logInstall(`init-error:${e.message}`); rollbackInit(); } }

try { if (!fs.existsSync(stampPath)) { runInitialization(); } } catch (e) { logInstall('init-check-failed'); }

try { applyDhcp(systemState.config.dhcp); } catch (e) { log('Boot DHCP apply skipped'); }

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
  if (pollingBusy) return;
  pollingBusy = true;
  if (process.platform !== 'linux') {
    systemState.interfaces = [{ id: 'eth0', name: 'WAN1', interfaceName: 'eth0', status: 'UP', ipAddress: '192.168.1.10', gateway: '192.168.1.1', internetHealth: 'HEALTHY', latency: 12, throughput: { rx: 5.2, tx: 1.5 } }];
    systemState.metrics = { cpuUsage: 15, cores: [10, 15, 20, 12], memoryUsage: '4.4', totalMem: '16.0', uptime: '1h 22m', activeSessions: 42, dnsResolved: true };
    pollingBusy = false;
    return;
  }

  try {
    const ipData = JSON.parse(execSync('ip -j addr show').toString());
    const routes = JSON.parse(execSync('ip -j route show').toString());
    const newInterfaces = await Promise.all(ipData.filter(iface => iface.ifname !== 'lo' && !iface.ifname.startsWith('veth') && !iface.ifname.startsWith('br')).map(async (iface) => {
      const gw = routes.find(r => r.dev === iface.ifname && r.dst === 'default')?.gateway || 'Detecting...';

      let health = { ok: true, latency: 0 };
      const hc = healthCache[iface.ifname];
      if (!hc || (Date.now() - hc.ts) > 10000) {
        health = await checkInternetHealth(iface.ifname);
        healthCache[iface.ifname] = { data: health, ts: Date.now() };
      } else {
        health = hc.data;
      }

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

    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const memTotal = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]) / 1024 / 1024;
    const memAvailable = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)[1]) / 1024 / 1024;
    const memUsed = memTotal - memAvailable;

    if (!lastUptimeStr || (Date.now() - lastUptimeAt) > 30000) {
      try { lastUptimeStr = execSync('uptime -p').toString().trim(); lastUptimeAt = Date.now(); } catch (e) {}
    }

    systemState.metrics = {
      cpuUsage: aggregateUsage,
      cores: coreMetrics,
      memoryUsage: memUsed.toFixed(2),
      totalMem: memTotal.toFixed(2),
      uptime: lastUptimeStr || '',
      activeSessions: 0,
      dnsResolved: true
    };
  } catch (e) { log(`Poll Error: ${e.message}`); }
  finally {
    pollingBusy = false;
  }
}, 2000);

const app = express();
app.use(cors());
app.use(express.json());


app.get('/api/interfaces', (req, res) => res.json(systemState.interfaces));
app.get('/api/metrics', (req, res) => res.json(systemState.metrics));
app.get('/api/config', (req, res) => res.json(systemState.config));
app.get('/api/system/platform', (req, res) => res.json({ platform: process.platform }));

app.post('/api/system/restart', (req, res) => {
  log('System restart requested via API');
  res.json({ status: 'restarting' });
  setTimeout(() => {
    if (process.platform === 'linux') {
      exec('systemctl restart nexus-agent', (error) => {
        if (error) log(`Restart failed: ${error.message}`);
      });
    } else {
      log('Simulating restart on non-Linux platform');
      setTimeout(() => process.exit(0), 1000);
    }
  }, 2000);
});

const updateJobs = {};
const panelDeployDir = './panel-deploy';
const panelBackupDir = './panel-backups';
try { fs.mkdirSync(panelBackupDir, { recursive: true }); } catch (e) {}

app.post('/api/update/check', (req, res) => {
  try {
    const { repo, branch } = req.body || {};
    const m = (repo || '').match(/github\.com\/([^\/]+)\/([^\/.]+)/);
    if (!m) return res.status(400).json({ error: 'invalid repo url' });
    const owner = m[1], name = m[2];
    const url = `https://api.github.com/repos/${owner}/${name}/commits?sha=${branch||'main'}&per_page=5`;
    const options = { headers: { 'User-Agent': 'Nexus-Agent', 'Accept': 'application/vnd.github+json' } };
    https.get(url, options, (r) => {
      let buf = ''; r.on('data', c => buf += c);
      r.on('end', () => {
        try {
          const list = JSON.parse(buf);
          const commits = (Array.isArray(list) ? list : []).map(c => ({ sha: c.sha, message: c.commit?.message || '', date: c.commit?.author?.date || '' }));
          const head = commits[0] || null;
          res.json({ repo, branch, version: head ? { sha: head.sha, message: head.message, date: head.date } : null, commits });
        } catch { res.status(500).json({ error: 'parse-failed' }); }
      });
    }).on('error', () => res.status(500).json({ error: 'github-failed' }));
  } catch { res.status(500).json({ error: 'unexpected' }); }
});

app.post('/api/update/apply', (req, res) => {
  const { repo, branch } = req.body || {};
  const job = Math.random().toString(36).slice(2);
  updateJobs[job] = { logs: [], done: false };
  res.json({ job, status: 'started' });
  setImmediate(() => {
    const J = updateJobs[job];
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    try {
      J.logs.push('BACKUP: creating snapshot...');
      try {
        if (process.platform === 'linux') {
          execSync(`tar -czf ${panelBackupDir}/panel_backup_${stamp}.tar.gz ${configPath} ${backupPath}`, { stdio: 'pipe' });
          J.logs.push('BACKUP: snapshot created');
        } else {
          fs.writeFileSync(`${panelBackupDir}/panel_backup_${stamp}.json`, JSON.stringify(systemState.config));
          J.logs.push('BACKUP: snapshot created');
        }
      } catch (e) {
        fs.writeFileSync(`${panelBackupDir}/panel_backup_${stamp}.json`, JSON.stringify(systemState.config));
        J.logs.push('BACKUP: tar failed, wrote JSON snapshot');
      }

      if (!repo) { J.logs.push('ERROR: repo not provided'); J.done = true; return; }
      J.logs.push('UPDATE: syncing repository...');
      if (fs.existsSync(panelDeployDir)) {
        execSync(`git -C ${panelDeployDir} fetch`, { stdio: 'pipe' });
        execSync(`git -C ${panelDeployDir} checkout ${branch||'main'}`, { stdio: 'pipe' });
        execSync(`git -C ${panelDeployDir} pull origin ${branch||'main'}`, { stdio: 'pipe' });
      } else {
        execSync(`git clone --depth 1 --branch ${branch||'main'} ${repo} ${panelDeployDir}`, { stdio: 'pipe' });
      }
      const sha = execSync(`git -C ${panelDeployDir} rev-parse HEAD`).toString().trim();
      const msg = execSync(`git -C ${panelDeployDir} show -s --format=%s HEAD`).toString().trim();
      J.logs.push(`DEPLOYED: ${sha.slice(0,7)} - ${msg}`);
      J.logs.push('UPDATE COMPLETE');
    } catch (e) {
      J.logs.push(`ERROR: ${e.message}`);
    } finally { J.done = true; }
  });
});

app.get('/api/update/logs', (req, res) => {
  const job = req.query.job || '';
  const J = updateJobs[job];
  if (!J) return res.json({ logs: [], done: true });
  res.json({ logs: J.logs.slice(-50), done: J.done });
});

app.get('/api/update/version', (req, res) => {
  try {
    if (!fs.existsSync(panelDeployDir)) return res.json({ version: null });
    const sha = execSync(`git -C ${panelDeployDir} rev-parse HEAD`).toString().trim();
    const msg = execSync(`git -C ${panelDeployDir} show -s --format=%s HEAD`).toString().trim();
    res.json({ version: { sha, message: msg } });
  } catch { res.json({ version: null }); }
});

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

app.get('/api/dhcp/status', (req, res) => { res.json(getDhcpStatus()); });

function getConnectedDevices() {
  if (process.platform !== 'linux') {
    return [
      { mac: '00:11:22:33:44:55', ip: '192.168.1.101', hostname: 'My-Laptop', leaseTime: '23h 59m' },
      { mac: 'AA:BB:CC:DD:EE:FF', ip: '192.168.1.102', hostname: 'Smart-TV', leaseTime: '12h 30m' },
      { mac: '12:34:56:78:90:AB', ip: '192.168.1.103', hostname: 'IoT-Device', leaseTime: '1h 15m' }
    ];
  }

  const devices = [];
  const leasePath = '/var/lib/nexus/dhcp.leases';
  try {
    if (fs.existsSync(leasePath)) {
      const content = fs.readFileSync(leasePath, 'utf8');
      content.split('\n').forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          // dnsmasq lease file format: timestamp mac ip hostname client-id
          const expiry = parseInt(parts[0]);
          const now = Math.floor(Date.now() / 1000);
          const minutesLeft = Math.floor((expiry - now) / 60);
          const hours = Math.floor(minutesLeft / 60);
          const mins = minutesLeft % 60;
          
          devices.push({
            mac: parts[1],
            ip: parts[2],
            hostname: parts[3] === '*' ? 'Unknown' : parts[3],
            leaseTime: expiry === 0 ? 'Infinite' : (minutesLeft > 0 ? `${hours}h ${mins}m` : 'Expired')
          });
        }
      });
    }
  } catch (e) {}
  return devices;
}

app.get('/api/devices', (req, res) => res.json(getConnectedDevices()));
app.get('/api/init/status', (req, res) => { const initialized = fs.existsSync(stampPath); let tail = []; try { if (fs.existsSync(installLog)) tail = fs.readFileSync(installLog,'utf8').split('\n').slice(-50); } catch (e) {} res.json({ initialized, log: tail }); });

function zeroTierStatus() {
  let installed = false, running = false, node = '', networks = [], iface = '';
  const plat = process.platform;
  if (plat === 'win32') {
    try { const svc = execSync('powershell -NoProfile -Command "(Get-Service -Name \"ZeroTier One\").Status"').toString().trim().toLowerCase(); installed = !!svc; running = svc === 'running'; } catch (e) {}
    try { node = execSync('cmd /c zerotier-cli.bat info').toString().trim(); installed = installed || !!node; } catch (e) {}
    try {
      const out = execSync('cmd /c zerotier-cli.bat listnetworks').toString().trim().split('\n').slice(1);
      networks = out.map(l => { const p = l.trim().split(/\s+/); return { id: p[0], name: p[1], status: p[p.length-1] }; });
    } catch (e) {}
    try { iface = execSync('powershell -NoProfile -Command "(Get-NetAdapter | Where-Object {$_.Name -like \"*ZeroTier*\"} | Select-Object -First 1 -ExpandProperty Name)"').toString().trim(); } catch (e) {}
    return { installed, running, node, networks, iface };
  }
  try { execSync('command -v zerotier-cli'); installed = true; } catch (e) {}
  if (installed) { try { running = execSync('systemctl is-active zerotier-one').toString().trim() === 'active'; } catch (e) {} }
  if (installed) {
    try { node = execSync('zerotier-cli info').toString().trim(); } catch (e) {}
    try {
      const out = execSync('zerotier-cli listnetworks').toString().trim().split('\n').slice(1);
      networks = out.filter(Boolean).map(l => { const p = l.trim().split(/\s+/); return { id: p[0], name: p[1], status: p[p.length-1] }; });
    } catch (e) {}
    try { iface = execSync("ip -br link | awk '/zt/{print $1; exit}'").toString().trim(); } catch (e) {}
  }
  return { installed, running, node, networks, iface };
}

app.get('/api/zerotier/status', (req, res) => { res.json(zeroTierStatus()); });
app.post('/api/zerotier/install', (req, res) => {
  try {
    if (process.platform === 'win32') {
      try { execSync('powershell -NoProfile -Command "winget install --id ZeroTier.ZeroTierOne -e --silent"'); } catch (e) {}
      try { execSync('powershell -NoProfile -Command "Start-Service -Name \"ZeroTier One\""'); } catch (e) {}
      logInstall('zerotier-installed-win');
      return res.json(zeroTierStatus());
    }
    logInstall('zerotier-install-start');
    const cmd = "bash -lc 'command -v zerotier-cli >/dev/null 2>&1 || (curl -s https://install.zerotier.com | bash); systemctl enable --now zerotier-one'";
    exec(cmd, { maxBuffer: 10485760, timeout: 900000 }, (error, stdout, stderr) => {
      try { if (stdout) fs.appendFileSync(installLog, stdout); } catch (e) {}
      try { if (stderr) fs.appendFileSync(installLog, stderr); } catch (e) {}
      if (error) {
        logInstall(`zerotier-install-error:${error.message}`);
        return res.status(500).json({ error: 'zerotier-install-failed' });
      }
      logInstall('zerotier-install-complete');
      res.json(zeroTierStatus());
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/zerotier/networks', (req, res) => {
  try { const { id } = req.body; if (!id) return res.status(400).json({ error: 'missing id' }); execSync(`zerotier-cli join ${id}`); systemState.config.zerotier = systemState.config.zerotier || { networks: [], forward: [] }; if (!systemState.config.zerotier.networks.find(n => n.id === id)) systemState.config.zerotier.networks.push({ id }); fs.writeFileSync(configPath, JSON.stringify(systemState.config)); res.json(zeroTierStatus()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/zerotier/networks/:id', (req, res) => {
  try { const { id } = req.params; execSync(`zerotier-cli leave ${id}`); systemState.config.zerotier = systemState.config.zerotier || { networks: [], forward: [] }; systemState.config.zerotier.networks = systemState.config.zerotier.networks.filter(n => n.id !== id); fs.writeFileSync(configPath, JSON.stringify(systemState.config)); res.json(zeroTierStatus()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/zerotier/forwarding', (req, res) => { res.json((systemState.config.zerotier||{forward:[]}).forward||[]); });
app.post('/api/zerotier/forwarding', (req, res) => {
  try {
    const { proto, listenPort, destIp, destPort, enabled } = req.body;
    if (!listenPort || !destIp || !destPort) return res.status(400).json({ error: 'missing fields' });
    const zt = zeroTierStatus().iface; if (!zt) return res.status(400).json({ error: 'no zerotier iface' });
    const id = Math.random().toString(36).slice(2,9);
    systemState.config.zerotier = systemState.config.zerotier || { networks: [], forward: [] };
    systemState.config.zerotier.forward.push({ id, proto: (proto||'tcp').toLowerCase(), listenPort, destIp, destPort, enabled: !!enabled });
    fs.writeFileSync(configPath, JSON.stringify(systemState.config));
    const p = (proto||'tcp').toLowerCase();
    if (enabled) {
      execSync(`iptables -t nat -A PREROUTING -i ${zt} -p ${p} --dport ${listenPort} -j DNAT --to-destination ${destIp}:${destPort}`);
      execSync(`iptables -A FORWARD -p ${p} -d ${destIp} --dport ${destPort} -j ACCEPT`);
    }
    res.json(systemState.config.zerotier.forward);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/zerotier/forwarding/:id', (req, res) => {
  try {
    const { id } = req.params; const zt = zeroTierStatus().iface;
    systemState.config.zerotier = systemState.config.zerotier || { networks: [], forward: [] };
    const rule = systemState.config.zerotier.forward.find(r => r.id === id);
    if (rule && rule.enabled && zt) {
      execSync(`iptables -t nat -D PREROUTING -i ${zt} -p ${rule.proto} --dport ${rule.listenPort} -j DNAT --to-destination ${rule.destIp}:${rule.destPort}`);
      execSync(`iptables -D FORWARD -p ${rule.proto} -d ${rule.destIp} --dport ${rule.destPort} -j ACCEPT`);
    }
    systemState.config.zerotier.forward = systemState.config.zerotier.forward.filter(r => r.id !== id);
    fs.writeFileSync(configPath, JSON.stringify(systemState.config));
    res.json(systemState.config.zerotier.forward);
  } catch (e) { res.status(500).json({ error: e.message }); }
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
      `dhcp-leasefile=/var/lib/nexus/dhcp.leases`,
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
