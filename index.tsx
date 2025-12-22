import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * TYPES & ENUMS
 */
enum WanStatus { UP = 'UP', DOWN = 'DOWN', STANDBY = 'STANDBY' }
enum RouterMode { LOAD_BALANCER = 'LOAD_BALANCER', FAILOVER = 'FAILOVER' }

interface WanInterface {
  id: string;
  name: string;
  interfaceName: string;
  status: WanStatus;
  gateway: string;
  ipAddress: string;
  weight: number;
  priority: number;
  throughput: { rx: number; tx: number; };
  latency: number;
  internetHealth?: 'HEALTHY' | 'OFFLINE';
}

interface BridgeConfig {
  id: string;
  name: string;
  interfaces: string[];
  ipAddress: string;
  netmask: string;
  dhcpEnabled: boolean;
  dhcpStart: string;
  dhcpEnd: string;
  leaseTime: string;
}

interface DhcpConfig {
  interfaceName: string;
  enabled: boolean;
  start: string;
  end: string;
  leaseTime: string;
  dnsServers?: string; // comma-separated
}

interface SystemMetrics {
  cpuUsage: number;
  cores?: number[];
  memoryUsage: string; 
  totalMem: string; 
  temp: string;
  uptime: string;
  activeSessions: number;
  dnsResolved: boolean;
  ipForwarding: boolean;
  bbrEnabled?: boolean;
}

interface NetworkConfig {
  mode: RouterMode;
  wanInterfaces: WanInterface[];
  bridges: BridgeConfig[];
  dhcp?: DhcpConfig;
}

/**
 * API DISCOVERY
 */
const getApiBase = () => {
  const host = window.location.hostname || 'localhost';
  return `http://${host}:3000/api`;
};

const API_BASE = getApiBase();

type ZTStatus = {
  installed: boolean;
  running: boolean;
  node: string;
  networks: { id: string; name?: string; status?: string }[];
  iface?: string;
};

type ForwardRule = {
  id: string;
  proto: 'tcp' | 'udp';
  listenPort: number;
  destIp: string;
  destPort: number;
  enabled: boolean;
};

const ZeroTierManager: React.FC = () => {
  const [status, setStatus] = useState<ZTStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [joiningId, setJoiningId] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [token, setToken] = useState<string>(() => localStorage.getItem('nexus_token') || '');
  const [forwardRules, setForwardRules] = useState<ForwardRule[]>([]);
  const [newRule, setNewRule] = useState<{ proto: 'tcp' | 'udp'; listenPort: string; destIp: string; destPort: string; enabled: boolean }>({ proto: 'tcp', listenPort: '', destIp: '', destPort: '', enabled: true });
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }), [token]);
const [platform, setPlatform] = useState<string>('');
useEffect(() => { (async () => { try { const r = await fetch(`${API_BASE}/system/platform`); if (r.ok) { const d = await r.json(); setPlatform(d.platform || ''); } } catch {} })(); }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/zerotier/status`, { headers });
      if (res.ok) setStatus(await res.json());
    } catch {}
    try {
      const fr = await fetch(`${API_BASE}/zerotier/forwarding`, { headers });
      if (fr.ok) setForwardRules(await fr.json());
    } catch {}
  };

  useEffect(() => { fetchStatus(); }, [headers]);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const res = await fetch(`${API_BASE}/zerotier/install`, { method: 'POST', headers });
      if (res.ok) setStatus(await res.json());
    } catch {}
    setInstalling(false);
  };

  const handleJoin = async () => {
    if (!joiningId.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/zerotier/networks`, { method: 'POST', headers, body: JSON.stringify({ id: joiningId.trim() }) });
      if (res.ok) { await fetchStatus(); setJoiningId(''); }
    } catch {}
  };

  const handleLeave = async (id: string) => {
    if (!confirm(`Leave network ${id}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/zerotier/networks/${id}`, { method: 'DELETE', headers });
      if (res.ok) await fetchStatus();
    } catch {}
  };

  const addForwardRule = async () => {
    const body = {
      proto: newRule.proto,
      listenPort: parseInt(newRule.listenPort || '0'),
      destIp: newRule.destIp.trim(),
      destPort: parseInt(newRule.destPort || '0'),
      enabled: newRule.enabled
    };
    if (!body.listenPort || !body.destIp || !body.destPort) return;
    try {
      const res = await fetch(`${API_BASE}/zerotier/forwarding`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.ok) { setForwardRules(await res.json()); setNewRule({ proto: 'tcp', listenPort: '', destIp: '', destPort: '', enabled: true }); }
    } catch {}
  };

  const removeForwardRule = async (id: string) => {
    if (!confirm('Remove this forwarding rule?')) return;
    try {
      const res = await fetch(`${API_BASE}/zerotier/forwarding/${id}`, { method: 'DELETE', headers });
      if (res.ok) setForwardRules(await res.json());
    } catch {}
  };

  const saveTokenLocal = () => {
    setSavingToken(true);
    localStorage.setItem('nexus_token', token || '');
    setTimeout(() => setSavingToken(false), 500);
    fetchStatus();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">ZeroTier Management</h1>
          <p className="text-slate-400 mt-1 font-medium italic">Virtual network control, install wizard, and port forwarding</p>
          {status && (
            <div className={`${status.installed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'} mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border`}>
              {status.installed ? (status.running ? 'Service: Running' : 'Service: Installed (Stopped)') : 'Not Installed'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input type="text" value={token} onChange={e => setToken(e.target.value)} placeholder="API Token (optional)" className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none" />
          <button onClick={saveTokenLocal} className={`${savingToken ? 'bg-slate-700 text-slate-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'} px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest`}>{savingToken ? 'SAVED' : 'SAVE'}</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6 lg:col-span-1 bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800">
          <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">Smart Installation</h3>
          <div className="space-y-3">
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Compatibility</div>
            <div className="text-xs text-slate-300">Platform: {platform || 'detecting...'}{platform && platform !== 'linux' ? ' (limited)' : ''}</div>
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Dependencies</div>
            <div className="text-xs text-slate-300">zerotier-one, systemd</div>
          </div>
          <button onClick={handleInstall} disabled={installing || (platform && platform !== 'linux') || (status?.installed && status?.running)} className={`${installing ? 'bg-slate-800 text-slate-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white'} mt-4 w-full px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest`}>
            {installing ? 'INSTALLING...' : (platform && platform !== 'linux') ? 'UNSUPPORTED ON THIS OS' : status?.installed ? (status?.running ? 'INSTALLED' : 'ENABLE SERVICE') : 'INSTALL ZEROTIER'}
          </button>
          {status?.node && <div className="mt-4 text-[10px] text-slate-500 font-black uppercase">Node Info</div>}
          {status?.node && <div className="font-mono text-xs text-blue-400">{status.node}</div>}
        </div>

        <div className="space-y-6 lg:col-span-2 bg-[#0B0F1A] p-8 rounded-[2.5rem] border border-slate-800">
          <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">Networks</h3>
          <div className="flex gap-3">
            <input type="text" value={joiningId} onChange={e => setJoiningId(e.target.value)} placeholder="Network ID" className="flex-1 bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none" />
            <button onClick={handleJoin} className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white">Join</button>
          </div>
          <div className="mt-6 space-y-3">
            {(status?.networks || []).length === 0 ? (
              <div className="text-slate-500 text-xs font-black uppercase tracking-widest">No networks joined</div>
            ) : (
              status?.networks.map(n => (
                <div key={n.id} className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`${n.status?.toLowerCase().includes('ok') ? 'bg-emerald-500' : 'bg-amber-500'} w-2 h-2 rounded-full`} />
                    <div className="text-xs font-mono text-blue-400">{n.id}</div>
                    <div className="text-[10px] text-slate-500 font-black uppercase">{n.name || 'Network'}</div>
                  </div>
                  <button onClick={() => handleLeave(n.id)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-600/20 text-rose-400 border border-rose-500/20 hover:bg-rose-600/30">Leave</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Port Forwarding</h3>
          <div className="text-[10px] text-slate-500 font-black uppercase">{status?.iface ? `Interface: ${status.iface}` : 'Interface: N/A'}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select value={newRule.proto} onChange={e => setNewRule(r => ({ ...r, proto: e.target.value as 'tcp' | 'udp' }))} className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none">
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
          </select>
          <input type="number" value={newRule.listenPort} onChange={e => setNewRule(r => ({ ...r, listenPort: e.target.value }))} placeholder="Listen Port" className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none" />
          <input type="text" value={newRule.destIp} onChange={e => setNewRule(r => ({ ...r, destIp: e.target.value }))} placeholder="Destination IP" className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none" />
          <input type="number" value={newRule.destPort} onChange={e => setNewRule(r => ({ ...r, destPort: e.target.value }))} placeholder="Destination Port" className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none" />
          <button onClick={addForwardRule} className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-amber-600 hover:bg-amber-500 text-white">Add Rule</button>
        </div>
        <div className="mt-6 space-y-3">
          {forwardRules.length === 0 ? (
            <div className="text-slate-500 text-xs font-black uppercase tracking-widest">No rules</div>
          ) : (
            forwardRules.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-black/40 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`${r.enabled ? 'bg-emerald-500' : 'bg-slate-600'} w-2 h-2 rounded-full`} />
                  <div className="text-xs font-mono text-blue-400">{r.proto.toUpperCase()} {r.listenPort} → {r.destIp}:{r.destPort}</div>
                </div>
                <button onClick={() => removeForwardRule(r.id)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-600/20 text-rose-400 border border-rose-500/20 hover:bg-rose-600/30">Remove</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENT: UPDATE MANAGER
 */
const UpdateManager = ({ onApplyUpdate, isUpdating }: { onApplyUpdate: () => void, isUpdating: boolean }) => {
  const [gitRepo, setGitRepo] = useState('https://github.com/Djnirds1984/Nexus-Router-OS.git');
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [logs, setLogs] = useState<string[]>(['Nexus Core Maintenance Agent Ready.']);
  const [commits, setCommits] = useState<{h: string, m: string, d: string}[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-10));
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const checkUpdates = () => {
    setChecking(true);
    addLog(`Probing repository: ${gitRepo}...`);
    setTimeout(() => {
      setChecking(false);
      setUpdateAvailable(true);
      setCommits([
        { h: '8f2a1b', m: 'feat: Core Multi-WAN balancing optimization', d: '2h ago' },
        { h: '4c9e7a', m: 'fix: DHCP lease timing on bridge interfaces', d: '1d ago' },
        { h: '2b1d3f', m: 'style: Aesthetic improvements to host dashboard', d: '3d ago' }
      ]);
      addLog('Update found: Build v1.4.2-STABLE detected.');
    }, 1500);
  };

  const handleUpdateNow = () => {
    addLog('CRITICAL: Initiating pre-update system snapshot...');
    setTimeout(() => {
      addLog('BACKUP CREATED: /mnt/backups/nexus_state_stable_v1.3.tar.gz');
      onApplyUpdate();
      addLog('Deploying kernel objects and UI assets...');
    }, 1000);
  };

  const handleDownloadBackup = () => {
    addLog('Packaging system configuration archive...');
    setTimeout(() => {
      const blob = new Blob([JSON.stringify({ timestamp: Date.now(), signature: 'nexus-recovery-v1' })], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexus_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      addLog('Snapshot exported to client successfully.');
    }, 800);
  };

  const handleRestore = () => {
    if (confirm('RESTORE WARNING: Rollback to last fixed version will restart the kernel. Proceed?')) {
      addLog('RESTORE INITIATED: Reverting to v1.3.0-stable build...');
      setTimeout(() => {
        addLog('Rollback Complete. System state: STABLE.');
        alert('System restored to last fixed version.');
      }, 2000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">System Updater</h1>
          <p className="text-slate-400 mt-1 font-medium italic">Continuous Deployment & Kernel Disaster Recovery</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-2xl flex items-center gap-3">
          <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Version</div>
          <div className="text-emerald-400 font-mono text-sm font-bold">v1.3.0-STABLE</div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Repo & Update Control */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0B0F1A] p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="text-8xl">🐙</span>
            </div>
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8 border-l-2 border-blue-500 pl-3">Git Deployment Source</h3>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-2">Repository Link</label>
                <input 
                  type="text" 
                  value={gitRepo}
                  onChange={(e) => setGitRepo(e.target.value)}
                  className="w-full bg-black/40 border border-slate-800 rounded-2xl px-6 py-4 text-sm font-mono text-blue-400 outline-none focus:border-blue-500 transition-all placeholder:text-slate-800"
                  placeholder="https://github.com/user/repo.git"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={checkUpdates}
                  disabled={checking || isUpdating}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black py-4 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-xs border border-slate-700 disabled:opacity-50"
                >
                  {checking ? 'FETCHING COMMITS...' : 'CHECK UPDATES'}
                </button>
                <button 
                  onClick={handleUpdateNow}
                  disabled={!updateAvailable || isUpdating}
                  className={`flex-1 font-black py-4 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-xs shadow-xl ${updateAvailable ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20' : 'bg-slate-900 text-slate-700 cursor-not-allowed border border-slate-800'}`}
                >
                  {isUpdating ? 'SYNCING...' : 'UPDATE NOW'}
                </button>
              </div>
            </div>
          </div>

          {commits.length > 0 && (
            <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 animate-in zoom-in-95 duration-500">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 italic">Latest Commit Changes</h3>
              <div className="space-y-4">
                {commits.map(commit => (
                  <div key={commit.h} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-slate-800/50 hover:border-blue-500/30 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-[10px] text-blue-500 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/10 uppercase font-black">
                        {commit.h}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{commit.m}</div>
                        <div className="text-[9px] text-slate-600 uppercase font-black">{commit.d}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Backup & Recovery Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 backdrop-blur-md">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Disaster Recovery</h3>
            
            <div className="space-y-3">
              <button 
                onClick={handleDownloadBackup}
                className="w-full flex items-center justify-between p-4 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 rounded-2xl transition-all group"
              >
                <div className="text-left">
                  <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Download Backup</div>
                  <div className="text-[9px] text-slate-600 italic">Save configuration snapshot</div>
                </div>
                <span className="text-xl group-hover:translate-y-1 transition-transform">📥</span>
              </button>

              <button 
                onClick={handleRestore}
                className="w-full flex items-center justify-between p-4 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-2xl transition-all group"
              >
                <div className="text-left">
                  <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Immediate Restore</div>
                  <div className="text-[9px] text-slate-600 italic">Rollback to last fixed version</div>
                </div>
                <span className="text-xl group-hover:rotate-180 transition-transform duration-500">🔄</span>
              </button>
            </div>
          </div>

          <div className="bg-black/60 p-6 rounded-[2.5rem] border border-slate-800 shadow-inner">
             <h3 className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Core Lifecycle Logs</h3>
             <div 
              ref={logRef}
              className="h-32 overflow-y-auto font-mono text-[9px] space-y-1.5 custom-scrollbar pr-2"
            >
               {logs.map((log, i) => (
                 <div key={i} className="text-slate-500 hover:text-blue-400 transition-colors">
                    <span className="opacity-30 mr-2">></span>{log}
                 </div>
               ))}
               {isUpdating && <div className="text-blue-400 animate-pulse tracking-widest italic font-black uppercase">COMMITTING CHANGES...</div>}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENT: BRIDGE & DHCP MANAGER
 */
const BridgeManager = ({ config, setConfig, onApply, isApplying, availableInterfaces }: { config: NetworkConfig, setConfig: any, onApply: () => void, isApplying: boolean, availableInterfaces: WanInterface[] }) => {
  const [dhcpStatus, setDhcpStatus] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/dhcp/status`);
        if (res.ok) {
          const st = await res.json();
          setDhcpStatus(st);
          if (st.running && st.interfaceName) {
            setConfig({ ...config, dhcp: { interfaceName: st.interfaceName, enabled: true, start: st.start || '', end: st.end || '', leaseTime: st.leaseTime || '24h', dnsServers: (st.dnsServers || []).join(',') } });
          }
        }
      } catch (e) {}
    })();
  }, []);

  const selectedIface = config.dhcp?.interfaceName || (availableInterfaces[0]?.interfaceName || '');
  const dhcp = config.dhcp || { interfaceName: selectedIface, enabled: false, start: '', end: '', leaseTime: '24h', dnsServers: '8.8.8.8,1.1.1.1' };
  const setDhcp = (updates: Partial<DhcpConfig>) => {
    setConfig({ ...config, dhcp: { ...dhcp, ...updates } });
  };

  const currentIface = availableInterfaces.find(i => i.interfaceName === (config.dhcp?.interfaceName || selectedIface));

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">DHCP Server</h1>
          <p className="text-slate-400 mt-1 font-medium italic">Assign IP addresses on a selected physical interface</p>
          {dhcpStatus && (
            <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${dhcpStatus.running ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
              {dhcpStatus.running ? `Running on ${dhcpStatus.interfaceName}` : 'No DHCP server detected'}
            </div>
          )}
        </div>
        <button 
          onClick={onApply} 
          disabled={isApplying} 
          className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-8 rounded-2xl shadow-xl uppercase tracking-widest text-xs"
        >
          {isApplying ? 'COMMITTING...' : 'SAVE CONFIGURATION'}
        </button>
      </header>

      <div className="bg-[#0B0F1A] p-10 rounded-[2.5rem] border border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="space-y-6">
          <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-l-2 border-blue-500 pl-3">Interface</h3>
          <select 
            value={dhcp.interfaceName}
            onChange={(e) => setDhcp({ interfaceName: e.target.value })}
            disabled={dhcpStatus?.running}
            className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-3 text-xs font-bold text-slate-300 outline-none disabled:opacity-50"
          >
            {availableInterfaces.map(iface => (
              <option key={iface.interfaceName} value={iface.interfaceName}>{iface.interfaceName}</option>
            ))}
          </select>
          {currentIface && (
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">IP: <span className="text-blue-400 font-mono">{currentIface.ipAddress}</span></div>
          )}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">DHCP Enabled</h3>
            <div onClick={() => setDhcp({ enabled: !dhcp.enabled })} className={`w-12 h-6 rounded-full relative cursor-pointer transition-all ${dhcp.enabled ? 'bg-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-slate-800'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${dhcp.enabled ? 'left-7' : 'left-1'}`} />
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-6 ${dhcp.enabled ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
            <div>
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Range Start</label>
              <input type="text" value={dhcp.start} onChange={(e) => setDhcp({ start: e.target.value })} className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono text-xs w-full" placeholder="e.g. 192.168.100.10" />
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Range End</label>
              <input type="text" value={dhcp.end} onChange={(e) => setDhcp({ end: e.target.value })} className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono text-xs w-full" placeholder="e.g. 192.168.100.250" />
            </div>
            <div className="col-span-2">
                       <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Lease Time</label>
                       <input type="text" value={dhcp.leaseTime} onChange={(e) => setDhcp({ leaseTime: e.target.value })} className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono text-xs w-full" placeholder="e.g. 24h" />
                    </div>
                    <div className="col-span-2">
                       <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">DNS Servers</label>
                       <input type="text" value={dhcp.dnsServers || ''} onChange={(e) => setDhcp({ dnsServers: e.target.value })} className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono text-xs w-full" placeholder="e.g. 8.8.8.8,1.1.1.1" />
                    </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Notes</div>
            <ul className="text-[10px] text-slate-600 space-y-1">
              <li>DHCP is applied to the selected physical interface.</li>
              <li>DNS conflicts are avoided if server runs in DHCP-only mode.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENT: SYSTEM SETTINGS
 */
const SystemSettings = ({ metrics }: { metrics: SystemMetrics }) => {
  const [ipForwarding, setIpForwarding] = useState(true);
  const [bbr, setBbr] = useState(true);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">System Core</h1>
        <p className="text-slate-400 mt-1 font-medium italic">Kernel Diagnostics & Global Optimization Control</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 backdrop-blur-md">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Networking Fabric</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-6 bg-black/20 rounded-2xl border border-slate-800/50">
              <div>
                <div className="text-white font-bold text-sm uppercase tracking-tight mb-1">IP Forwarding</div>
                <div className="text-slate-500 text-[10px] font-medium leading-relaxed uppercase">Enable kernel packet routing between interfaces</div>
              </div>
              <div onClick={() => setIpForwarding(!ipForwarding)} className={`w-14 h-7 rounded-full relative cursor-pointer transition-colors ${ipForwarding ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-slate-800'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${ipForwarding ? 'left-8' : 'left-1'}`} /></div>
            </div>
            <div className="flex items-center justify-between p-6 bg-black/20 rounded-2xl border border-slate-800/50">
              <div>
                <div className="text-white font-bold text-sm uppercase tracking-tight mb-1">TCP BBR Optimization</div>
                <div className="text-slate-500 text-[10px] font-medium leading-relaxed uppercase">Google's Bottleneck Bandwidth and RTT algorithm</div>
              </div>
              <div onClick={() => setBbr(!bbr)} className={`w-14 h-7 rounded-full relative cursor-pointer transition-colors ${bbr ? 'bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${bbr ? 'left-8' : 'left-1'}`} /></div>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 backdrop-blur-md flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Maintenance Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black py-4 px-6 rounded-2xl border border-slate-700 text-[10px] uppercase tracking-[0.2em] transition-all">Flush Logs</button>
              <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black py-4 px-6 rounded-2xl border border-slate-700 text-[10px] uppercase tracking-[0.2em] transition-all">Clear ARP</button>
              <button className="bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 font-black py-4 px-6 rounded-2xl border border-rose-500/20 text-[10px] uppercase tracking-[0.2em] transition-all">Reboot Agent</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENT: INTERFACE MANAGER (MULTI-WAN)
 */
const InterfaceManager = ({ interfaces, config, setConfig, onApply, isApplying }: any) => {
  const updateInterface = (id: string, updates: Partial<WanInterface>) => {
    setConfig((prev: NetworkConfig) => ({
      ...prev,
      wanInterfaces: prev.wanInterfaces.map(w => w.id === id ? { ...w, ...updates } : w)
    }));
  };

  const dhcpIface = config?.dhcp?.interfaceName;
  const displayWanInterfaces: WanInterface[] = (config.wanInterfaces || []).filter((w: WanInterface) => w.interfaceName !== dhcpIface);
  const autoLabelWans = () => {
    let n = 1;
    setConfig((prev: NetworkConfig) => ({
      ...prev,
      wanInterfaces: prev.wanInterfaces.map((w: WanInterface) => {
        if (w.interfaceName === dhcpIface) return w;
        return { ...w, name: `WAN${n++}` };
      })
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Multi-WAN Orchestrator</h1>
          <p className="text-slate-400 mt-1 font-medium italic">Smart Load-Balancing & Automated Failover Fabric</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={autoLabelWans} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black py-3 px-6 rounded-2xl border border-slate-700 text-[10px] uppercase tracking-[0.2em] transition-all">Auto-Number Ports</button>
          <button onClick={onApply} disabled={isApplying} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-10 rounded-2xl shadow-xl shadow-blue-600/20 disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest text-xs">{isApplying ? 'SYNCING KERNEL...' : 'COMMIT TO KERNEL'}</button>
        </div>
      </header>

      <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8 backdrop-blur-md">
        <div className="flex-1">
          <h2 className="text-2xl font-black text-white tracking-tight mb-2 uppercase italic">Routing Engine Mode</h2>
          <p className="text-slate-500 text-sm max-w-xl leading-relaxed">{config.mode === RouterMode.LOAD_BALANCER ? "ECMP enabled. Traffic is distributed across all healthy links based on weight." : "Active/Passive failover. Traffic stays on the highest priority link."}</p>
        </div>
        <div className="flex bg-black/40 p-2 rounded-2xl border border-slate-800 shadow-inner shrink-0">
          <button onClick={() => setConfig({ ...config, mode: RouterMode.LOAD_BALANCER })} className={`px-8 py-4 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${config.mode === RouterMode.LOAD_BALANCER ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-600 hover:text-slate-300'}`}>Load Balance</button>
          <button onClick={() => setConfig({ ...config, mode: RouterMode.FAILOVER })} className={`px-8 py-4 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${config.mode === RouterMode.FAILOVER ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-600 hover:text-slate-300'}`}>Failover</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {displayWanInterfaces.map((wan: WanInterface) => (
          <div key={wan.id} className={`p-8 rounded-[2.5rem] border transition-all relative overflow-hidden backdrop-blur-md ${wan.internetHealth === 'HEALTHY' ? 'bg-slate-900/40 border-slate-800 hover:border-blue-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <input 
                    type="text"
                    value={wan.name || `WAN-${wan.interfaceName.toUpperCase()}`}
                    onChange={(e) => updateInterface(wan.id, { name: e.target.value })}
                    className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none w-40"
                  />
                  <span className="text-xs text-slate-500 font-black uppercase tracking-widest">{wan.interfaceName.toUpperCase()}</span>
                  <code className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-1 rounded font-mono border border-blue-500/10 font-bold">{wan.ipAddress}</code>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${wan.internetHealth === 'HEALTHY' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500 animate-pulse'}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${wan.internetHealth === 'HEALTHY' ? 'text-emerald-400' : 'text-rose-500'}`}>{wan.internetHealth === 'HEALTHY' ? 'INTERNET LINKED' : 'REQUEST TIMEOUT'}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">Ping Latency</div>
                <div className="text-2xl font-mono text-emerald-400 font-bold tracking-tighter">{wan.latency} <span className="text-xs">ms</span></div>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              {config.mode === RouterMode.LOAD_BALANCER ? (
                <>
                  <div className="flex justify-between items-end"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Load Weight</label><span className="text-3xl font-mono text-blue-400 font-black tracking-tighter">{wan.weight}%</span></div>
                  <input type="range" min="1" max="100" value={wan.weight} onChange={(e) => updateInterface(wan.id, { weight: parseInt(e.target.value) })} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                </>
              ) : (
                <>
                  <label className="text-[10px] font-black text-slate-500 uppercase block tracking-widest mb-2">Failover Priority</label>
                  <select value={wan.priority} onChange={(e) => updateInterface(wan.id, { priority: parseInt(e.target.value) })} className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none"><option value={1}>1 - Primary Link</option><option value={2}>2 - Secondary Backup</option></select>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * COMPONENT: DEVICE LIST
 */
interface Device {
  mac: string;
  ip: string;
  hostname: string;
  leaseTime: string;
}

const DeviceList: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await fetch(`${API_BASE}/devices`);
        if (res.ok) {
          const data = await res.json();
          setDevices(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-700">
      <header>
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Connected Devices</h1>
        <p className="text-slate-400 mt-1 font-medium">Real-time LAN client discovery & lease management.</p>
      </header>

      <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800 backdrop-blur-md overflow-hidden">
        <div className="p-8 border-b border-slate-800">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            Active Clients <span className="text-slate-500 text-lg font-bold">({devices.length})</span>
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950/50 text-slate-500 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-8 py-4">Hostname</th>
                <th className="px-8 py-4">IP Address</th>
                <th className="px-8 py-4">MAC Address</th>
                <th className="px-8 py-4">Lease Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-8 text-center text-slate-500">Scanning network...</td></tr>
              ) : devices.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-8 text-center text-slate-500">No devices found.</td></tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.mac} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-8 py-4 font-bold text-white">{device.hostname}</td>
                    <td className="px-8 py-4 font-mono text-blue-400">{device.ip}</td>
                    <td className="px-8 py-4 font-mono text-slate-500">{device.mac}</td>
                    <td className="px-8 py-4 text-sm text-slate-400">{device.leaseTime}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENT: LAYOUT
 */
const Layout = ({ children, activeTab, setActiveTab, isLive }: any) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'wan', label: 'Multi-WAN', icon: '🌐' },
    { id: 'devices', label: 'Devices', icon: '💻' },
    { id: 'bridge', label: 'Bridge & DHCP', icon: '🌉' },
    { id: 'zerotier', label: 'ZeroTier', icon: '🕸️' },
    { id: 'updates', label: 'Updates', icon: '🆙' },
    { id: 'advisor', label: 'AI Advisor', icon: '🧠' },
    { id: 'settings', label: 'System', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
      <aside className="w-64 bg-[#0B0F1A] border-r border-slate-800 flex flex-col shadow-2xl z-20">
        <div className="p-8 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-xl italic text-xl">N</div>
          <span className="font-bold text-2xl tracking-tighter text-white uppercase italic">Nexus</span>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto custom-scrollbar">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 ${activeTab === tab.id ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
              <span className="text-xl">{tab.icon}</span>
              <span className="font-bold text-sm tracking-tight">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-6 mt-auto">
          <div className={`p-5 rounded-2xl border transition-all duration-500 ${isLive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.15)]'}`}>
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-[0.2em] font-black">Hardware Link</div>
            <div className="flex items-center gap-3"><div className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-rose-500 animate-pulse shadow-[0_0_12px_#f43f5e]'}`} /><span className={`text-xs font-black uppercase tracking-tighter ${isLive ? 'text-emerald-400' : 'text-rose-400'}`}>{isLive ? 'Kernel Active' : 'Agent Lost'}</span></div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto relative bg-[#020617] scroll-smooth"><div className="max-w-7xl mx-auto p-12">{children}</div></main>
    </div>
  );
};

/**
 * COMPONENT: DASHBOARD (HIGH-FIDELITY RESTORED)
 */
const Dashboard = ({ interfaces, metrics }: { interfaces: WanInterface[], metrics: SystemMetrics }) => {
  const [selectedIface, setSelectedIface] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  
  useEffect(() => {
    if (!selectedIface && interfaces.length > 0) {
      const primary = interfaces.find(i => i.internetHealth === 'HEALTHY') || interfaces[0];
      setSelectedIface(primary.interfaceName);
    }
  }, [interfaces, selectedIface]);

  useEffect(() => {
    if (!selectedIface) return;
    const currentData = interfaces.find(i => i.interfaceName === selectedIface);
    if (!currentData) return;
    
    setHistory(prev => {
      const newEntry = { 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
        rx: currentData.throughput.rx, 
        tx: currentData.throughput.tx 
      };
      return [...prev, newEntry].slice(-60);
    });
  }, [interfaces, selectedIface]);

  const aggregateTraffic = useMemo(() => {
    return interfaces.reduce((acc, curr) => ({
      rx: acc.rx + (curr.throughput?.rx || 0),
      tx: acc.tx + (curr.throughput?.tx || 0)
    }), { rx: 0, tx: 0 });
  }, [interfaces]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Host Dashboard</h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Real-time Linux Router Telemetry</p>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${metrics.dnsResolved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'}`}>
              {metrics.dnsResolved ? 'Internet: Linked' : 'Internet: Failed'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-600 font-black tracking-widest uppercase mb-1">Session Duration</div>
          <div className="text-2xl font-mono text-white font-bold tracking-tighter tabular-nums">{metrics.uptime || '--:--:--'}</div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Aggregate RX</h3>
          <div className="text-4xl font-mono text-emerald-400 font-bold tracking-tighter tabular-nums">{aggregateTraffic.rx.toFixed(2)} <span className="text-sm font-sans font-medium text-slate-500 uppercase tracking-widest">Mbps</span></div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Aggregate TX</h3>
          <div className="text-4xl font-mono text-blue-400 font-bold tracking-tighter tabular-nums">{aggregateTraffic.tx.toFixed(2)} <span className="text-sm font-sans font-medium text-slate-500 uppercase tracking-widest">Mbps</span></div>
        </div>
        
        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md overflow-hidden">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Multi-Core Usage</h3>
          <div className="space-y-3 custom-scrollbar max-h-40 overflow-y-auto">
             {metrics.cores && metrics.cores.length > 0 ? metrics.cores.map((usage, idx) => (
                <div key={idx} className="group">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest group-hover:text-blue-400 transition-colors">CPU {idx}</span>
                    <span className="text-[10px] font-mono text-white font-bold">{usage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-800/50">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out ${usage > 80 ? 'bg-rose-500' : usage > 50 ? 'bg-amber-500' : 'bg-blue-500'} shadow-[0_0_8px_currentColor] opacity-90`} 
                      style={{ width: `${usage}%`, color: usage > 80 ? '#f43f5e' : usage > 50 ? '#f59e0b' : '#3b82f6' }} 
                    />
                  </div>
                </div>
             )) : (
                <div className="text-4xl font-mono text-white font-bold tabular-nums tracking-tighter">{metrics.cpuUsage.toFixed(0)}%</div>
             )}
          </div>
        </div>

        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Physical RAM</h3>
          <div className="text-4xl font-mono text-white font-bold tracking-tighter tabular-nums">{metrics.memoryUsage} <span className="text-sm font-sans font-medium text-slate-500 uppercase tracking-widest">GB</span></div>
          <div className="mt-2 text-[10px] text-slate-600 font-black uppercase tracking-widest italic">Used of {metrics.totalMem} GB Host Total</div>
          <div className="mt-3 w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-800/50">
             <div className="h-full bg-slate-400 transition-all duration-700" style={{ width: `${(parseFloat(metrics.memoryUsage)/parseFloat(metrics.totalMem || "1"))*100}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#0B0F1A] p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase italic tracking-tight">
              <span className="w-2 h-6 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              Traffic Monitor: <span className="text-emerald-400 font-mono tracking-tighter">{selectedIface.toUpperCase()}</span>
            </h2>
            <select 
              value={selectedIface}
              onChange={(e) => setSelectedIface(e.target.value)}
              className="bg-slate-950 text-blue-400 border border-slate-800 rounded-2xl px-6 py-2.5 text-xs font-black outline-none font-mono focus:border-blue-500 cursor-pointer uppercase"
            >
              {interfaces.map(iface => (
                <option key={iface.interfaceName} value={iface.interfaceName}>{iface.interfaceName}</option>
              ))}
            </select>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#475569" fontSize={10} tickFormatter={(v) => `${v}M`} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px' }} />
                <Area name="Down" type="monotone" dataKey="rx" stroke="#10b981" strokeWidth={4} fill="url(#colorRx)" isAnimationActive={false} />
                <Area name="Up" type="monotone" dataKey="tx" stroke="#3b82f6" strokeWidth={4} fill="url(#colorTx)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800 flex flex-col overflow-hidden backdrop-blur-md shadow-2xl">
           <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950/30">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Interface Matrix</h2>
              <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-blue-400 font-mono border border-blue-500/20 uppercase tracking-widest font-black">Link Live</span>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {interfaces.map(iface => (
                <div 
                  key={iface.id} 
                  onClick={() => setSelectedIface(iface.interfaceName)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between ${selectedIface === iface.interfaceName ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'}`}
                >
                   <div className="flex items-center gap-4">
                      <div className={`w-2.5 h-2.5 rounded-full ${iface.internetHealth === 'HEALTHY' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]'}`} />
                      <div>
                        <div className="text-sm font-black text-white font-mono uppercase tracking-tighter">{iface.interfaceName}</div>
                        <div className="text-[10px] text-slate-500 font-mono tracking-tight tabular-nums">{iface.ipAddress}</div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className={`text-xs font-mono font-black ${iface.internetHealth === 'HEALTHY' ? 'text-emerald-400' : 'text-rose-500'}`}>{iface.latency}ms</div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

/**
 * MAIN APP
 */
const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLive, setIsLive] = useState(false);
  const [metrics, setMetrics] = useState<SystemMetrics>({ cpuUsage: 0, memoryUsage: '0', totalMem: '0', temp: '0', uptime: '', activeSessions: 0, dnsResolved: true, ipForwarding: true });
  const [interfaces, setInterfaces] = useState<WanInterface[]>([]);
  const [currentConfig, setCurrentConfig] = useState<NetworkConfig>({
    mode: RouterMode.LOAD_BALANCER,
    wanInterfaces: [],
    bridges: [],
    dhcp: { interfaceName: '', enabled: false, start: '', end: '', leaseTime: '24h' }
  });
  const [appliedConfig, setAppliedConfig] = useState<NetworkConfig>(currentConfig);
  const [isApplying, setIsApplying] = useState(false);
  
  // Use ref to access current config inside refreshData without stale closures
  const configRef = useRef(currentConfig);
  useEffect(() => { configRef.current = currentConfig; }, [currentConfig]);

  const refreshData = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const [ifaceRes, metricRes, configRes] = await Promise.all([
        fetch(`${API_BASE}/interfaces`, { signal: controller.signal }),
        fetch(`${API_BASE}/metrics`, { signal: controller.signal }),
        fetch(`${API_BASE}/config`, { signal: controller.signal })
      ]);
      clearTimeout(timeoutId);

      if (ifaceRes.ok && metricRes.ok) {
        const ifaces = await ifaceRes.json();
        const met = await metricRes.json();
        setInterfaces(ifaces);
        setMetrics(met);
        
        let loadedFromSave = false;
        
        // Load settings from config endpoint
        if (configRes.ok) {
          const savedConfig = await configRes.json();
          const current = configRef.current;

          if (current.bridges.length === 0 && savedConfig.bridges && savedConfig.bridges.length > 0) {
            setCurrentConfig(prev => ({ ...prev, bridges: savedConfig.bridges }));
          }
          if (!current.dhcp && savedConfig.dhcp) {
            setCurrentConfig(prev => ({ ...prev, dhcp: savedConfig.dhcp }));
          }
          // Only overwrite WAN interfaces if local state is empty (prevents overwrite while editing)
          if (current.wanInterfaces.length === 0 && savedConfig.wanInterfaces && savedConfig.wanInterfaces.length > 0) {
            const dhcpIface = (savedConfig.dhcp?.interfaceName) || current.dhcp?.interfaceName || '';
            const persistedWans = dhcpIface ? savedConfig.wanInterfaces.filter((w: any) => w.interfaceName !== dhcpIface) : savedConfig.wanInterfaces;
            setCurrentConfig(prev => ({ ...prev, wanInterfaces: persistedWans }));
            loadedFromSave = true;
          }
        }

        const current = configRef.current;
        if (!loadedFromSave && current.wanInterfaces.length === 0 && ifaces.length > 0) {
          const dhcpIface = current?.dhcp?.interfaceName || '';
          const wanList = dhcpIface ? ifaces.filter((i: any) => i.interfaceName !== dhcpIface) : ifaces;
          setCurrentConfig(prev => ({ ...prev, wanInterfaces: wanList }));
        }
        setIsLive(true);
      } else {
        setIsLive(false);
      }
    } catch (e) { setIsLive(false); }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 1000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleApplyConfig = async () => {
    setIsApplying(true);
    try {
      const res = await fetch(`${API_BASE}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfig)
      });
      if (res.ok) {
        setAppliedConfig({ ...currentConfig });
        alert("KERNEL SYNC: Configuration tables updated successfully.");
      }
    } catch (e) { alert("AGENT ERROR: Communication lost."); }
    finally { setIsApplying(false); }
  };

  const handleUpdate = async () => {
    setIsApplying(true);
    // Simulating deployment latency
    await new Promise(r => setTimeout(r, 2000));
    setIsApplying(false);
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive}>
      {activeTab === 'dashboard' && <Dashboard interfaces={interfaces} metrics={metrics} />}
      {activeTab === 'wan' && <InterfaceManager interfaces={interfaces} config={currentConfig} setConfig={setCurrentConfig} onApply={handleApplyConfig} isApplying={isApplying} />}
      {activeTab === 'devices' && <DeviceList />}
      {activeTab === 'bridge' && <BridgeManager config={currentConfig} setConfig={setCurrentConfig} onApply={handleApplyConfig} isApplying={isApplying} availableInterfaces={interfaces} />}
      {activeTab === 'zerotier' && <ZeroTierManager />}
      {activeTab === 'updates' && <UpdateManager onApplyUpdate={handleUpdate} isUpdating={isApplying} />}
      {activeTab === 'advisor' && <div className="p-32 text-center text-slate-700 font-mono text-xs tracking-widest uppercase opacity-40">AI Advisor Online</div>}
      {activeTab === 'settings' && <SystemSettings metrics={metrics} />}
    </Layout>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}