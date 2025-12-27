/**
 * Nexus Router OS - Hardware Agent (Root Required)
 * Smart Multi-WAN Orchestrator - Production Kernel Link
 */

const fs = require('fs');
const { execSync, exec } = require('child_process');
const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');

const logFile = '/var/log/nexus-agent.log';
const installLog = '/var/log/nexus-init.log';
const stateDir = '/var/lib/nexus';
const stampPath = '/var/lib/nexus/initialized.flag';
const tokenPath = '/etc/nexus/api.token';
const legacyConfigPath = path.join(process.cwd(), 'nexus-config.json');
const legacyBackupPath = path.join(process.cwd(), 'nexus-config.backup.json');
const configPath = process.platform === 'linux' ? path.join(stateDir, 'nexus-config.json') : legacyConfigPath;
const backupPath = process.platform === 'linux' ? path.join(stateDir, 'nexus-config.backup.json') : legacyBackupPath;

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
  config: { mode: 'LOAD_BALANCER', wanInterfaces: [], bridges: [], interfaceCustomNames: {}, firewallRules: [] }
};

// State for calculating rates per core and per interface
let lastCpuData = {}; // { coreId: { total, idle } }
let lastNetStats = {}; // { iface: { rx, tx, time } }
let pollingBusy = false;
let healthCache = {};
let lastUptimeStr = '';
let lastUptimeAt = 0;
let dhcpSessions = {}; // { [iface]: { startedAt: number, client: string, attempts: number } }

// Start DHCP clients on WAN ports that lack IPv4 and ensure NAT
function ensureWanDhcpClients() {
  try {
    if (process.platform !== 'linux') return;
    const lan = ((systemState.config || {}).dhcp || {}).interfaceName || '';
    const links = JSON.parse(execSync('ip -j link show').toString());
    const addrs = JSON.parse(execSync('ip -j addr show').toString());
    const addrMap = {};
    addrs.forEach(a => {
      const inet = (a.addr_info || []).find(i => i.family === 'inet');
      addrMap[a.ifname] = inet ? inet.local : '';
    });
    links
      .filter(l => {
        const n = String(l.ifname);
        return n !== 'lo' && !n.startsWith('veth') && !n.startsWith('br');
      })
      .forEach(l => {
        const iface = l.ifname;
        if (iface === lan) return;
        const hasIPv4 = !!addrMap[iface];
        const isUp = (l.operstate || '') === 'UP';
        let hasMac = true, hasCarrier = true;
        try {
          const mac = fs.readFileSync(`/sys/class/net/${iface}/address`, 'utf8').trim();
          hasMac = !!mac && mac !== '00:00:00:00:00:00';
        } catch (e) { hasMac = false; }
        try {
          const carrier = fs.readFileSync(`/sys/class/net/${iface}/carrier`, 'utf8').trim();
          hasCarrier = carrier === '1';
        } catch (e) { hasCarrier = true; }
        if (isUp && !hasIPv4) {
          try {
            let running = false;
            try {
              const p = execSync(`pgrep -a dhclient || true`).toString();
              running = p.split('\n').some(line => line.includes(` ${iface}`));
            } catch (e) {}
            execSync(`ip link set ${iface} up`);
            if (hasMac && hasCarrier) {
              const sess = dhcpSessions[iface] || { startedAt: 0, client: '', attempts: 0 };
              if (running && (!sess.startedAt || (Date.now() - sess.startedAt) > 15000)) {
                try { execSync(`bash -lc 'dhclient -r ${iface} || true'`); } catch (e) {}
                try { execSync(`bash -lc 'pkill -f "dhclient.*${iface}" || true'`); } catch (e) {}
                try { execSync(`bash -lc 'pkill -f "udhcpc.*${iface}" || true'`); } catch (e) {}
                try { execSync(`bash -lc 'pkill -f "dhcpcd.*${iface}" || true'`); } catch (e) {}
                try { fs.unlinkSync(`/var/run/dhclient-${iface}.pid`); } catch (e) {}
                try { fs.unlinkSync(`/var/lib/nexus/dhclient-${iface}.lease`); } catch (e) {}
                running = false;
              }
              if (!running) {
                let cmd = '';
                const preferOrder = ['dhclient', 'udhcpc', 'dhcpcd'];
                const prevIdx = preferOrder.indexOf(sess.client);
                const tryOrder = prevIdx >= 0 ? [...preferOrder.slice(prevIdx + 1), ...preferOrder.slice(0, prevIdx + 1)] : preferOrder;
                for (const c of tryOrder) {
                  try {
                    execSync(`command -v ${c}`);
                    if (c === 'dhclient') cmd = `nohup dhclient -4 -nw -pf /var/run/dhclient-${iface}.pid -lf /var/lib/nexus/dhclient-${iface}.lease ${iface} >/dev/null 2>&1 &`;
                    if (c === 'udhcpc') cmd = `nohup udhcpc -q -R -i ${iface} >/dev/null 2>&1 &`;
                    if (c === 'dhcpcd') cmd = `nohup dhcpcd -4 -q ${iface} >/dev/null 2>&1 &`;
                    if (cmd) { dhcpSessions[iface] = { startedAt: Date.now(), client: c, attempts: (sess.attempts || 0) + 1 }; break; }
                  } catch (e) {}
                }
                if (!cmd) {
                  try { ensurePkg('isc-dhcp-client'); cmd = `nohup dhclient -4 -nw -pf /var/run/dhclient-${iface}.pid -lf /var/lib/nexus/dhclient-${iface}.lease ${iface} >/dev/null 2>&1 &`; dhcpSessions[iface] = { startedAt: Date.now(), client: 'dhclient', attempts: (sess.attempts || 0) + 1 }; } catch (e) {}
                }
                if (cmd) exec(`bash -lc '${cmd}'`);
                log(`DHCP CLIENT STARTED: ${iface}`);
              }
            }
          } catch (e) { log(`DHCP CLIENT ERROR (${iface}): ${e.message}`); }
        } else if (!isUp) {
          try {
            execSync(`bash -lc 'dhclient -r ${iface} || true'`);
            execSync(`bash -lc 'pkill -f "dhclient.*${iface}" || true'`);
            log(`DHCP CLIENT STOPPED: ${iface}`);
          } catch (e) {}
        }
      });
  } catch (e) { log(`ensureWanDhcpClients error: ${e.message}`); }
}

function ensureMasqueradeAllWan() {
  try {
    if (process.platform !== 'linux') return;
    const lan = ((systemState.config || {}).dhcp || {}).interfaceName || '';
    const routes = JSON.parse(execSync('ip -j route show default').toString());
    const wanIfaces = [];
    routes.forEach(r => { if (r.dev && !wanIfaces.includes(r.dev)) wanIfaces.push(r.dev); });
    wanIfaces.forEach(wan => {
      try {
        execSync(`iptables -t nat -C POSTROUTING -o ${wan} -j MASQUERADE || iptables -t nat -A POSTROUTING -o ${wan} -j MASQUERADE`);
        if (lan) {
          execSync(`iptables -C FORWARD -i ${lan} -o ${wan} -j ACCEPT || iptables -A FORWARD -i ${lan} -o ${wan} -j ACCEPT`);
          execSync(`iptables -C FORWARD -i ${wan} -o ${lan} -m state --state RELATED,ESTABLISHED -j ACCEPT || iptables -A FORWARD -i ${wan} -o ${lan} -m state --state RELATED,ESTABLISHED -j ACCEPT`);
        }
      } catch (e) {}
    });
  } catch (e) { log(`ensureMasqueradeAllWan error: ${e.message}`); }
}

function applyFirewallRules() {
  try {
    if (process.platform !== 'linux') return;
    
    // Create NEXUS_FW chain if not exists
    try { execSync('iptables -N NEXUS_FW'); } catch (e) {}
    
    // Flush it
    execSync('iptables -F NEXUS_FW');
    
    // Ensure it's jumped to from INPUT and FORWARD
    try { execSync('iptables -C INPUT -j NEXUS_FW || iptables -I INPUT -j NEXUS_FW'); } catch (e) {}
    try { execSync('iptables -C FORWARD -j NEXUS_FW || iptables -I FORWARD -j NEXUS_FW'); } catch (e) {}

    const rules = systemState.config.firewallRules || [];
    rules.forEach(rule => {
      let cmd = 'iptables -A NEXUS_FW';
      if (rule.proto && rule.proto !== 'any') cmd += ` -p ${rule.proto}`;
      if (rule.src && rule.src.trim()) cmd += ` -s ${rule.src.trim()}`;
      if (rule.port && rule.port.trim()) cmd += ` --dport ${rule.port.trim()}`;
      if (rule.action) cmd += ` -j ${rule.action}`;
      
      try { execSync(cmd); } catch (e) { log(`FW Rule Fail: ${cmd} - ${e.message}`); }
    });
    
    log(`Applied ${rules.length} firewall rules`);
  } catch (e) { log(`applyFirewallRules error: ${e.message}`); }
}

// Load existing config if available
try {
  let loaded = null;
  // Migrate legacy config to persistent location on Linux
  try {
    if (process.platform === 'linux') {
      if (!fs.existsSync(configPath) && fs.existsSync(legacyConfigPath)) {
        const data = fs.readFileSync(legacyConfigPath, 'utf8');
        fs.writeFileSync(configPath, data);
        logInstall('migrate-config-to-stateDir');
      }
      if (!fs.existsSync(backupPath) && fs.existsSync(legacyBackupPath)) {
        const data = fs.readFileSync(legacyBackupPath, 'utf8');
        fs.writeFileSync(backupPath, data);
        logInstall('migrate-backup-to-stateDir');
      }
    }
  } catch (e) { }
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

function restorePersistentNaming() {
  if (process.platform !== 'linux') return;
  const map = systemState.config.persistentInterfaceMap || {};
  if (Object.keys(map).length === 0) return;
  
  try {
    let rules = [];
    if (fs.existsSync(udevRulesPath)) {
      rules = fs.readFileSync(udevRulesPath, 'utf8').split('\n').filter(l => l.trim());
    }
    
    let changed = false;
    Object.entries(map).forEach(([mac, name]) => {
      if (!rules.some(r => r.includes(mac) && r.includes(name))) {
        // Remove conflicting rules for this MAC
        rules = rules.filter(r => !r.includes(mac));
        rules.push(`SUBSYSTEM=="net", ACTION=="add", ATTR{address}=="${mac}", NAME="${name}"`);
        changed = true;
      }
    });

    if (changed) {
      fs.writeFileSync(udevRulesPath, rules.join('\n') + '\n');
      try { execSync('udevadm control --reload-rules && udevadm trigger'); } catch (e) {}
      log('Restored persistent interface naming rules from config');
    }
  } catch (e) { log(`RESTORE NAMING ERROR: ${e.message}`); }
}

restorePersistentNaming();

function sh(cmd) { logInstall(`run:${cmd}`); return execSync(cmd).toString(); }
function ensurePkg(pkg) { try { execSync(`dpkg -s ${pkg}`); logInstall(`pkg-ok:${pkg}`); } catch (e) { try { execSync('apt-get update -y'); execSync(`apt-get install -y ${pkg}`); logInstall(`pkg-install:${pkg}`); } catch (err) { throw new Error(`pkg-failed:${pkg}`); } } }
function validateEnvironment() { if (process.platform !== 'linux') throw new Error('os-invalid'); try { if (process.getuid && process.getuid() !== 0) throw new Error('need-root'); } catch (e) {} const meminfo = fs.readFileSync('/proc/meminfo','utf8'); const mt = parseInt((meminfo.match(/MemTotal:\s+(\d+)/)||[])[1]||'0'); if (mt < 256000) throw new Error('mem-low'); }
function applyDefaults() { try { if (!fs.existsSync('/etc/dnsmasq.d/nexus-dhcp.conf')) { fs.writeFileSync('/etc/dnsmasq.d/nexus-dhcp.conf', 'port=0\nlog-dhcp'); logInstall('write:dnsmasq-default'); } } catch (e) { logInstall('write-failed:dnsmasq'); } }
function verifyComponents() { 
  try { 
    execSync('systemctl is-enabled dnsmasq'); 
    logInstall('verify:dnsmasq-enabled'); 
  } catch (e) { 
    try { 
      execSync('systemctl enable dnsmasq'); 
      logInstall('verify:dnsmasq-enabled-now'); 
    } catch (err) { 
      logInstall('verify:dnsmasq-not-enabled'); 
    } 
  } 
}
function rollbackInit() { try { logInstall('rollback-start'); } catch (e) {} }
function runInitialization() { try { validateEnvironment(); ensurePkg('dnsmasq'); ensurePkg('iproute2'); ensurePkg('isc-dhcp-client'); try { ensurePkg('iptables'); } catch (e) { ensurePkg('nftables'); } applyDefaults(); verifyComponents(); fs.writeFileSync(stampPath, new Date().toISOString()); logInstall('initialized'); } catch (e) { logInstall(`init-error:${e.message}`); rollbackInit(); } }

try { if (!fs.existsSync(stampPath)) { runInitialization(); } } catch (e) { logInstall('init-check-failed'); }

// Initial DHCP/NAT setup on boot
ensureWanDhcpClients();
ensureMasqueradeAllWan();
ensureDhcpServerApplied();
applyFirewallRules();



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
      const customName = (systemState.config.interfaceCustomNames || {})[iface.ifname];
      const ipv4Addr = ((iface.addr_info || []).find(a => a.family === 'inet') || {}).local || 'N/A';
      return {
        id: iface.ifname,
        name: customName || iface.ifname.toUpperCase(),
        interfaceName: iface.ifname,
        customName: customName || undefined,
        status: iface.operstate === 'UP' ? 'UP' : 'DOWN',
        ipAddress: ipv4Addr,
        gateway: gw,
        internetHealth: health.ok ? 'HEALTHY' : 'OFFLINE',
        latency: health.latency,
        throughput: throughput
      };
    }));

    const healthChanged = JSON.stringify(newInterfaces.map(i => i.internetHealth)) !== JSON.stringify(systemState.interfaces.map(i => i.internetHealth));
    systemState.interfaces = newInterfaces;
    if (healthChanged) applyMultiWanKernel();
    ensureWanDhcpClients();
    ensureMasqueradeAllWan();
    ensureDhcpServerApplied();

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

// Firewall APIs
app.get('/api/firewall/rules', (req, res) => {
  res.json(systemState.config.firewallRules || []);
});

app.post('/api/firewall/rules', (req, res) => {
  const { rules } = req.body;
  if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules must be an array' });
  
  systemState.config.firewallRules = rules;
  try {
    fs.writeFileSync(configPath, JSON.stringify(systemState.config, null, 2));
    applyFirewallRules();
    res.json({ status: 'ok', rules: systemState.config.firewallRules });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save rules' });
  }
});

app.get('/api/firewall/nat', (req, res) => {
  try {
    if (process.platform !== 'linux') return res.json({ rules: [] });
    const output = execSync('iptables -t nat -S').toString();
    const rules = output.split('\n').filter(l => l.trim());
    res.json({ rules });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve built panel statically for LAN/offline access
try {
  const staticDir = path.join(__dirname, 'dist');
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('/', (req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }
} catch (e) { log(`Static serve init failed: ${e.message}`); }

app.get('/api/interfaces', (req, res) => res.json(systemState.interfaces));
app.get('/api/metrics', (req, res) => res.json(systemState.metrics));
app.get('/api/config', (req, res) => res.json(systemState.config));
app.get('/api/system/platform', (req, res) => res.json({ platform: process.platform }));

app.get('/api/netdevs', (req, res) => {
  try {
    if (process.platform !== 'linux') {
      const customNames = systemState.config.interfaceCustomNames || {};
      return res.json({
        interfaces: [
          { name: 'eth0', customName: customNames['eth0'], type: 'physical', state: 'UP', mac: '00:11:22:33:44:55', mtu: 1500, ipAddress: '192.168.1.10', speed: 1000, master: null, members: [] },
          { name: 'br0', customName: customNames['br0'], type: 'bridge', state: 'UP', mac: '02:00:00:00:00:01', mtu: 1500, ipAddress: '192.168.1.1', speed: null, master: null, members: ['eth0'] }
        ]
      });
    }
    const links = JSON.parse(execSync('ip -j link show').toString());
    const addrs = JSON.parse(execSync('ip -j addr show').toString());
    const addrMap = {};
    addrs.forEach(a => {
      const inet = (a.addr_info || []).find(i => i.family === 'inet');
      addrMap[a.ifname] = inet ? inet.local : '';
    });
    const masterMap = {};
    links.forEach(l => { if (l.master) { masterMap[l.master] = masterMap[l.master] || []; masterMap[l.master].push(l.ifname); } });
    const list = [];
    for (const l of links) {
      if (l.ifname === 'lo' || (l.ifname || '').startsWith('veth')) continue;
      const isBridge = (l.linkinfo && l.linkinfo.info_kind === 'bridge') || (l.ifname || '').startsWith('br');
      let speed = null;
      if (!isBridge) {
        try {
          const out = execSync(`ethtool ${l.ifname}`, { stdio: 'pipe' }).toString();
          const m = out.match(/Speed:\s*(\d+)/);
          if (m) speed = parseInt(m[1], 10);
        } catch (e) {}
      }
      const customName = (systemState.config.interfaceCustomNames || {})[l.ifname];
      list.push({
        name: l.ifname,
        customName: customName || undefined,
        type: isBridge ? 'bridge' : 'physical',
        state: l.operstate || 'UNKNOWN',
        mac: l.address || '',
        mtu: l.mtu || 1500,
        ipAddress: addrMap[l.ifname] || '',
        speed: isBridge ? null : speed,
        master: l.master || null,
        members: isBridge ? (masterMap[l.ifname] || []) : []
      });
    }
    res.json({ interfaces: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const udevRulesPath = '/etc/udev/rules.d/99-nexus-net.rules';

function isValidKernelName(name) {
  return /^[a-zA-Z0-9]+$/.test(name) && !name.includes(' ');
}

function updatePersistentNetRules(mac, name) {
  if (process.platform !== 'linux') return;
  try {
    let rules = [];
    if (fs.existsSync(udevRulesPath)) {
      rules = fs.readFileSync(udevRulesPath, 'utf8').split('\n').filter(l => l.trim());
    }
    // Remove existing rule for this MAC
    rules = rules.filter(l => !l.includes(mac));
    // Add new rule
    rules.push(`SUBSYSTEM=="net", ACTION=="add", ATTR{address}=="${mac}", NAME="${name}"`);
    fs.writeFileSync(udevRulesPath, rules.join('\n') + '\n');
    try { execSync('udevadm control --reload-rules && udevadm trigger'); } catch (e) {}
  } catch (e) { log(`UDEV UPDATE ERROR: ${e.message}`); }
}

app.post('/api/interfaces/rename', (req, res) => {
  const { interfaceName, customName } = req.body;
  if (!interfaceName) return res.status(400).json({ error: 'Missing interfaceName' });
  
  const safeName = (customName || '').trim();
  const isKernelRename = isValidKernelName(safeName);

  // 1. Handle Display Name (Custom Name)
  if (!systemState.config.interfaceCustomNames) systemState.config.interfaceCustomNames = {};

  if (safeName && safeName !== interfaceName) {
    systemState.config.interfaceCustomNames[interfaceName] = safeName;
  } else {
    delete systemState.config.interfaceCustomNames[interfaceName];
  }

  // 2. Handle Persistent Kernel Rename (if valid and requested)
  let kernelRenamed = false;
  let rebootRequired = false;
  
  if (isKernelRename && process.platform === 'linux' && safeName && safeName !== interfaceName) {
    try {
      // Find MAC address
      const links = JSON.parse(execSync('ip -j link show').toString());
      const link = links.find(l => l.ifname === interfaceName);
      
      if (link && link.address) {
        // Update Persistent Map
        if (!systemState.config.persistentInterfaceMap) systemState.config.persistentInterfaceMap = {};
        systemState.config.persistentInterfaceMap[link.address] = safeName;

        // Update UDEV
        updatePersistentNetRules(link.address, safeName);
        
        // Update Internal Config References
        // WAN Interfaces
        systemState.config.wanInterfaces = systemState.config.wanInterfaces.map(w => {
            if (w.interfaceName === interfaceName) return { ...w, interfaceName: safeName };
            return w;
        });
        
        // DHCP
        if (systemState.config.dhcp && systemState.config.dhcp.interfaceName === interfaceName) {
            systemState.config.dhcp.interfaceName = safeName;
        }
        
        // Bridges
        systemState.config.bridges = systemState.config.bridges.map(b => {
             if (b.name === interfaceName) return { ...b, name: safeName }; // If renaming the bridge itself
             b.members = b.members.map(m => m === interfaceName ? safeName : m);
             return b;
        });

        // Clean up old custom name mapping since the system name is now the custom name
        // actually, we might want to keep it if the user wants to see "LAN" instead of "lan" (case sensitivity)
        // but if they provided "lan1", it matches.
        if (safeName === systemState.config.interfaceCustomNames[interfaceName]) {
             // If we successfully rename kernel to "lan1", we don't need a map eth0->lan1 anymore.
             // We need a map lan1->lan1 (redundant) or nothing.
             // But wait, the frontend sends "interfaceName" as the OLD name.
             // After this request, the frontend needs to know the ID changed.
             delete systemState.config.interfaceCustomNames[interfaceName]; 
        }

        // Attempt Runtime Rename
        try {
            execSync(`ip link set ${interfaceName} down`);
            execSync(`ip link set ${interfaceName} name ${safeName}`);
            execSync(`ip link set ${safeName} up`);
            kernelRenamed = true;
            
            // Re-apply DHCP if it was on this interface
            if (systemState.config.dhcp.interfaceName === safeName) {
                applyDhcp(systemState.config.dhcp);
            }
        } catch (e) {
            log(`RUNTIME RENAME FAILED (Scheduled for reboot): ${e.message}`);
            rebootRequired = true;
        }
      }
    } catch (e) {
      log(`KERNEL RENAME ERROR: ${e.message}`);
    }
  }

  try {
    fs.writeFileSync(configPath, JSON.stringify(systemState.config, null, 2));
    res.json({ 
        status: 'ok', 
        customName: systemState.config.interfaceCustomNames[interfaceName] || safeName,
        kernelRenamed,
        rebootRequired,
        newInterfaceName: kernelRenamed ? safeName : interfaceName
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

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

app.post('/api/system/reboot', (req, res) => {
  log('Full system reboot requested via API');
  res.json({ status: 'rebooting' });
  setTimeout(() => {
    try {
      if (process.platform === 'win32') {
        exec('shutdown /r /t 0', (error) => { if (error) log(`Reboot failed: ${error.message}`); });
      } else if (process.platform === 'linux') {
        exec('systemctl reboot || reboot || shutdown -r now', (error) => { if (error) log(`Reboot failed: ${error.message}`); });
      } else {
        log('Simulating reboot on unsupported platform');
        setTimeout(() => process.exit(0), 1000);
      }
    } catch (e) { log(`Reboot exception: ${e.message}`); }
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
    let dir = panelDeployDir;
    // If panel-deploy doesn't exist, try current directory if it's a git repo
    if (!fs.existsSync(dir) && fs.existsSync(path.join(process.cwd(), '.git'))) {
       dir = process.cwd();
    }
    
    if (!fs.existsSync(dir)) return res.json({ version: null });
    
    const sha = execSync(`git -C "${dir}" rev-parse HEAD`).toString().trim();
    const msg = execSync(`git -C "${dir}" show -s --format=%s HEAD`).toString().trim();
    res.json({ version: { sha, message: msg } });
  } catch { res.json({ version: null }); }
});

app.get('/api/update/backups', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    
    // Dynamic discovery of project root to handle casing issues
    let projectRoots = [process.cwd()];
    const www = '/var/www/html';
    if (fs.existsSync(www)) {
      try {
        const dirs = fs.readdirSync(www).filter(n => n.toLowerCase().includes('nexus-router'));
        dirs.forEach(d => projectRoots.push(path.join(www, d)));
      } catch (e) {}
    }
    
    // Potential backup directories
    const candidates = [];
    projectRoots.forEach(root => {
        candidates.push(path.join(root, 'panel-backups'));
    });
    // Add explicitly known paths just in case
    candidates.push('/var/www/html/Nexus-Router-Os/panel-backups');
    candidates.push('/var/www/html/Nexus-Router-OS/panel-backups');
    candidates.push(panelBackupDir);

    const uniqueCandidates = [...new Set(candidates)];
    
    let allFiles = [];
    
    uniqueCandidates.forEach(dir => {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          files.forEach(n => {
            if (n.includes('panel_backup') || n.endsWith('.json') || n.endsWith('.tar.gz')) {
                const p = path.join(dir, n);
                try {
                    const st = fs.statSync(p);
                    allFiles.push({ name: n, size: st.size, mtime: st.mtimeMs }); 
                } catch(e) {}
            }
          });
        } catch(e) { log(`Error reading backup dir ${dir}: ${e.message}`); }
      }
    });

    // Remove duplicates by name (keeping newest mtime if duplicates exist)
    const uniqueFiles = [];
    const seen = new Set();
    // Sort by mtime desc first so we keep the newest if dupes
    allFiles.sort((a,b) => b.mtime - a.mtime);
    
    allFiles.forEach(f => {
        if (!seen.has(f.name)) {
            seen.add(f.name);
            uniqueFiles.push(f);
        }
    });

    res.json({ files: uniqueFiles });
  } catch (e) { 
      log(`Backup list error: ${e.message}`);
      res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/update/restore', (req, res) => {
  try {
    const name = (req.body && req.body.name) || '';
    if (!name || name.includes('/') || name.includes('\\')) return res.status(400).json({ error: 'invalid name' });
    
    // Dynamic discovery for restore as well
    let projectRoots = [process.cwd()];
    const www = '/var/www/html';
    if (fs.existsSync(www)) {
      try {
        const dirs = fs.readdirSync(www).filter(n => n.toLowerCase().includes('nexus-router'));
        dirs.forEach(d => projectRoots.push(path.join(www, d)));
      } catch (e) {}
    }
    
    const candidates = [];
    projectRoots.forEach(root => candidates.push(path.join(root, 'panel-backups')));
    candidates.push('/var/www/html/Nexus-Router-Os/panel-backups');
    candidates.push('/var/www/html/Nexus-Router-OS/panel-backups');
    candidates.push(panelBackupDir);

    const dir = candidates.find(d => fs.existsSync(path.join(d, name)));
    if (!dir) return res.status(404).json({ error: 'not found' });
    const full = path.join(dir, name);

    if (name.includes('.json')) {
      const cfg = JSON.parse(fs.readFileSync(full, 'utf8'));
      systemState.config = cfg;
      fs.writeFileSync(configPath, JSON.stringify(systemState.config));
      fs.writeFileSync(backupPath, JSON.stringify(systemState.config));
      applyMultiWanKernel();
      applyDhcp(systemState.config.dhcp);
      return res.json({ ok: true });
    }

    if (name.includes('.tar.gz')) {
      if (process.platform === 'linux') {
        execSync(`tar -xzf "${full}" -C .`);
        try { systemState.config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) {}
        applyMultiWanKernel();
        applyDhcp(systemState.config.dhcp);
        return res.json({ ok: true });
      } else {
        return res.status(400).json({ error: 'tar restore only on linux' });
      }
    }

    return res.status(400).json({ error: 'unsupported file type' });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  if (!running) {
    try {
      const p = execSync('pgrep -x dnsmasq || true').toString().trim();
      running = !!p;
    } catch (e) {}
  }
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

function ensureDhcpServerApplied() {
  try {
    if (process.platform !== 'linux') return;
    const desired = (systemState.config && systemState.config.dhcp) || {};
    const status = getDhcpStatus();
    if (desired && desired.enabled && desired.interfaceName) {
      const mismatch = (!status.running) ||
        (status.interfaceName !== desired.interfaceName) ||
        (status.start !== (desired.start || '')) ||
        (status.end !== (desired.end || '')) ||
        (status.leaseTime !== (desired.leaseTime || ''));
      if (mismatch) applyDhcp(desired);
    } else {
      if (status.running) {
        try { execSync('systemctl stop dnsmasq'); } catch (e) {}
        try { fs.unlinkSync('/etc/dnsmasq.d/nexus-dhcp.conf'); } catch (e) {}
      }
    }
  } catch (e) {}
}

app.get('/api/dhcp/status', (req, res) => { res.json(getDhcpStatus()); });
app.delete('/api/dhcp', (req, res) => {
  try {
    const status = getDhcpStatus();
    if (status.interfaceName) {
      try { execSync(`ip addr flush dev ${status.interfaceName}`); } catch (e) {}
    }
    try { execSync('systemctl stop dnsmasq'); } catch (e) {}
    try { fs.unlinkSync('/etc/dnsmasq.d/nexus-dhcp.conf'); } catch (e) {}
    systemState.config.dhcp = { interfaceName: '', enabled: false, start: '', end: '', leaseTime: '', dnsServers: [] };
    fs.writeFileSync(configPath, JSON.stringify(systemState.config));
    fs.writeFileSync(backupPath, JSON.stringify(systemState.config));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
  
  const parseNetworks = (output, isJson = false) => {
    try {
      if (isJson) {
        const data = JSON.parse(output);
        return (Array.isArray(data) ? data : (data.networks || [])).map(n => ({
          id: n.id || n.nwid,
          name: n.name,
          mac: n.mac,
          status: n.status,
          type: n.type,
          dev: n.dev || n.portDeviceName,
          ips: n.assignedAddresses || n.ipAssignments || []
        }));
      }
      // Text fallback
      // 200 listnetworks <nwid> <name> <mac> <status> <type> <dev> <ZT IPs...>
      return output.trim().split('\n').map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 7 && (parts[1] === 'listnetworks' || parts[0].length === 16)) {
           // Handle both raw lines and "200 listnetworks ..."
           const offset = parts[1] === 'listnetworks' ? 2 : 0;
           return {
             id: parts[offset],
             name: parts[offset+1],
             mac: parts[offset+2],
             status: parts[offset+3],
             type: parts[offset+4],
             dev: parts[offset+5],
             ips: parts.slice(offset+6)
           };
        }
        return null;
      }).filter(n => n && n.id && n.id.length === 16);
    } catch (e) { return []; }
  };

  if (plat === 'win32') {
    try { const svc = execSync('powershell -NoProfile -Command "(Get-Service -Name \"ZeroTier One\").Status"').toString().trim().toLowerCase(); installed = !!svc; running = svc === 'running'; } catch (e) {}
    try { node = execSync('cmd /c zerotier-cli.bat info').toString().trim(); installed = installed || !!node; } catch (e) {}
    try {
      // Try JSON first on Windows
      try {
        const out = execSync('cmd /c zerotier-cli.bat -j listnetworks').toString().trim();
        networks = parseNetworks(out, true);
      } catch {
        const out = execSync('cmd /c zerotier-cli.bat listnetworks').toString().trim();
        networks = parseNetworks(out, false);
      }
    } catch (e) {}
    try { iface = execSync('powershell -NoProfile -Command "(Get-NetAdapter | Where-Object {$_.Name -like \"*ZeroTier*\"} | Select-Object -First 1 -ExpandProperty Name)"').toString().trim(); } catch (e) {}
    return { installed, running, node, networks, iface };
  }
  
  // Linux
  try { execSync('command -v zerotier-cli'); installed = true; } catch (e) {}
  if (installed) { try { running = execSync('systemctl is-active zerotier-one').toString().trim() === 'active'; } catch (e) {} }
  if (installed) {
    try { node = execSync('zerotier-cli info').toString().trim(); } catch (e) {}
    try {
      try {
         const out = execSync('zerotier-cli -j listnetworks').toString().trim();
         networks = parseNetworks(out, true);
      } catch {
         const out = execSync('zerotier-cli listnetworks').toString().trim();
         networks = parseNetworks(out, false);
      }
    } catch (e) {}
    try { iface = execSync("ip -br link | awk '/zt/{print $1; exit}'").toString().trim(); } catch (e) {}
  }
  return { installed, running, node, networks, iface };
}

function getDataplicityStatus() {
  let installed = false, running = false, serial = '', version = '';
  let serviceName = null;
  if (process.platform === 'linux') {
    try {
      if (fs.existsSync('/opt/dataplicity')) installed = true;
      if (installed) {
        // Check for service name (support both dataplicity.service and supervisor.service)
        try {
            if (execSync('systemctl list-units --full -all | grep -F "dataplicity.service" || true').toString().trim()) {
                serviceName = 'dataplicity';
            } else if (execSync('systemctl list-units --full -all | grep -F "supervisor.service" || true').toString().trim()) {
                serviceName = 'supervisor';
            }
        } catch(e) {}

        // Check running status - process check is most reliable for tuxtunnel
        try { 
           // Check for tuxtunnel process which is the actual agent
           // Use ps aux to be compatible with most linuxes
           const proc = execSync("ps aux | grep '[t]uxtunnel'").toString().trim();
           if (proc) running = true;
        } catch (e) {}

        // Fallback to service status if process check fails or just to be sure
        if (!running && serviceName) {
           try { running = execSync(`systemctl is-active ${serviceName}`).toString().trim() === 'active'; } catch (e) {}
        }

        try { 
           if (fs.existsSync('/opt/dataplicity/tuxtunnel/serial')) {
             serial = fs.readFileSync('/opt/dataplicity/tuxtunnel/serial', 'utf8').trim();
           }
        } catch (e) {}
      }
    } catch (e) {}
  }
  return { installed, running, serial, version, serviceName };
}

app.get('/api/dataplicity/status', (req, res) => res.json(getDataplicityStatus()));

app.post('/api/dataplicity/install', (req, res) => {
  try {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'Missing command' });
    
    // Basic security check - ensure it looks like a dataplicity curl command or python script
    // curl -s https://www.dataplicity.com/xxxx.py | sudo python3
    if (!command.includes('dataplicity.com') && !command.includes('python')) {
      return res.status(400).json({ error: 'Invalid Dataplicity installation command' });
    }

    // If platform is not linux, mock or fail
    if (process.platform !== 'linux') {
      logInstall('dataplicity-install-mock-win');
      return res.json({ success: true }); // Mock success for dev
    }

    logInstall('dataplicity-install-start');
    
    // Execute the command. Since it usually pipes to sudo python3, we execute it directly.
    // Ensure we use python3 as requested.
    // If the user pasted "curl ... | sudo python3", we can run it.
    // But better to be explicit if possible.
    
    exec(command, { maxBuffer: 10485760, timeout: 300000 }, (error, stdout, stderr) => {
      if (stdout) try { fs.appendFileSync(installLog, stdout); } catch(e) {}
      if (stderr) try { fs.appendFileSync(installLog, stderr); } catch(e) {}
      
      const output = (stdout || '') + '\n' + (stderr || '');

      if (error) {
         logInstall(`dataplicity-install-error: ${error.message}`);
         return res.status(500).json({ error: 'Installation failed. Check logs.', output });
      }
      
      logInstall('dataplicity-install-complete');
      res.json({ ...getDataplicityStatus(), output });
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dataplicity/start', (req, res) => {
  try {
    if (process.platform === 'linux') {
      const status = getDataplicityStatus();
      if (status.serviceName) {
          execSync(`sudo systemctl enable --now ${status.serviceName}`);
          setTimeout(() => {
             res.json(getDataplicityStatus());
          }, 2000);
      } else {
          // If no service found but files exist, try to restart supervisor as a fallback
          // or tell user to reinstall.
          try {
             execSync('sudo service supervisor restart');
             setTimeout(() => { res.json(getDataplicityStatus()); }, 2000);
          } catch(e) {
             res.status(500).json({ error: 'Could not find dataplicity or supervisor service. Please try reinstalling.' });
          }
      }
    } else {
      res.json({ success: true, running: true }); // Mock
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
    ensureWanDhcpClients();
    ensureMasqueradeAllWan();
    applyFirewallRules();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/factory-reset', (req, res) => {
  try {
    if (process.platform === 'linux') {
      try { execSync('systemctl stop dnsmasq'); } catch (e) {}
      try { fs.unlinkSync('/etc/dnsmasq.d/nexus-dhcp.conf'); } catch (e) {}
      try { execSync('iptables -t nat -F'); } catch (e) {}
      try { execSync('iptables -F'); } catch (e) {}
      try { if (fs.existsSync('/var/lib/nexus/dhcp.leases')) fs.unlinkSync('/var/lib/nexus/dhcp.leases'); } catch (e) {}
      try { if (fs.existsSync(udevRulesPath)) fs.unlinkSync(udevRulesPath); } catch (e) {}
      try { if (fs.existsSync(stampPath)) fs.unlinkSync(stampPath); } catch (e) {}
    }
    systemState.interfaces = [];
    systemState.metrics = { cpuUsage: 0, cores: [], memoryUsage: '0', totalMem: '0', uptime: '', activeSessions: 0, dnsResolved: true };
    systemState.config = { mode: 'LOAD_BALANCER', wanInterfaces: [], bridges: [], interfaceCustomNames: {} };
    try { if (fs.existsSync(configPath)) fs.unlinkSync(configPath); } catch (e) {}
    try { if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath); } catch (e) {}
    fs.writeFileSync(configPath, JSON.stringify(systemState.config, null, 2));
    fs.writeFileSync(backupPath, JSON.stringify(systemState.config, null, 2));
    res.json({ ok: true, rebootRecommended: process.platform === 'linux' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3000, '0.0.0.0', () => log('Nexus Agent active on :3000'));
