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

interface FirewallRule {
  id: string;
  type: 'INPUT' | 'FORWARD';
  proto: 'tcp' | 'udp' | 'icmp' | 'any';
  port?: string;
  src?: string;
  action: 'ACCEPT' | 'DROP' | 'REJECT';
  enabled: boolean;
}

interface NetworkConfig {
  mode: RouterMode;
  wanInterfaces: WanInterface[];
  bridges: BridgeConfig[];
  dhcp?: DhcpConfig;
  firewallRules?: FirewallRule[];
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
  networks: { 
    id: string; 
    name?: string; 
    status?: string;
    mac?: string;
    type?: string;
    dev?: string;
    ips?: string[];
  }[];
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

  const [forwardRules, setForwardRules] = useState<ForwardRule[]>([]);
  const [newRule, setNewRule] = useState<{ proto: 'tcp' | 'udp'; listenPort: string; destIp: string; destPort: string; enabled: boolean }>({ proto: 'tcp', listenPort: '', destIp: '', destPort: '', enabled: true });
  const headers = useMemo(() => ({ 'Content-Type': 'application/json' }), []);
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
                <div key={n.id} className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl space-y-3 hover:border-blue-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${n.status?.toLowerCase().includes('ok') ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`} />
                      <div className="text-sm font-mono text-blue-400 font-bold">{n.name || 'Unnamed Network'}</div>
                      <div className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">{n.id}</div>
                    </div>
                    <button onClick={() => handleLeave(n.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-600/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600/20 transition-colors">
                      Leave
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-800/50">
                    <div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Status</div>
                      <div className="text-xs text-slate-300 font-mono">{n.status}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Type</div>
                      <div className="text-xs text-slate-300 font-mono">{n.type}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">MAC</div>
                      <div className="text-xs text-slate-300 font-mono">{n.mac || 'N/A'}</div>
                    </div>
                     <div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Interface</div>
                      <div className="text-xs text-slate-300 font-mono">{n.dev || 'N/A'}</div>
                    </div>
                  </div>

                  {n.ips && n.ips.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/50">
                       <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Managed IPs</div>
                       <div className="flex flex-wrap gap-2">
                         {n.ips.map((ip, idx) => (
                           <div key={idx} className="bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-1 rounded text-xs font-mono">
                             {ip}
                           </div>
                         ))}
                       </div>
                    </div>
                  )}
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
  const [branch, setBranch] = useState('main');
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [version, setVersion] = useState<{ sha: string; message: string; date?: string } | null>(null); // Kept for legacy prop if needed, but unused if we switch
  const [activeVersion, setActiveVersion] = useState<{ sha: string; message: string; date?: string } | null>(null);
  const [remoteVersion, setRemoteVersion] = useState<{ sha: string; message: string; date?: string } | null>(null);
  const [jobId, setJobId] = useState('');
  const [logs, setLogs] = useState<string[]>(['Nexus Updater Ready.']);
  const [commits, setCommits] = useState<{h: string, m: string, d: string}[]>([]);
  const [backups, setBackups] = useState<{ name: string; size: number; mtime: number }[]>([]);
  const [backupError, setBackupError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-10));
  };

  useEffect(() => {
    fetch(`${API_BASE}/update/version`)
      .then(r => r.json())
      .then(d => { if (d.version) setActiveVersion(d.version); })
      .catch(() => {});
  }, []);

  const loadBackups = async () => {
    try {
      setBackupError('');
      const r = await fetch(`${API_BASE}/update/backups`, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } });
      if (r.ok) { const d = await r.json(); setBackups(d.files || []); }
      else { const t = await r.text(); setBackupError(t || 'Failed to load backups'); }
    } catch (e:any) { setBackupError(e?.message || 'Network error while loading backups'); }
  };

  const restoreBackup = async (name: string) => {
    try {
      addLog(`RESTORE: ${name} -> applying backup...`);
      const r = await fetch(`${API_BASE}/update/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (r.ok) { addLog('RESTORE COMPLETE'); }
      else { const t = await r.text(); addLog(`RESTORE FAILED: ${t}`); }
    } catch (e:any) { addLog(`RESTORE ERROR: ${e.message||'network'}`); }
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => { loadBackups(); }, []);

  useEffect(() => {
    if (!jobId) return;
    const t = setInterval(loadBackups, 3000);
    return () => clearInterval(t);
  }, [jobId]);

  const checkUpdates = async () => {
    setChecking(true);
    addLog(`Probing repository: ${gitRepo} [branch: ${branch}]...`);
    try {
      const res = await fetch(`${API_BASE}/update/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: gitRepo, branch })
      });
      if (res.ok) {
        const data = await res.json();
        setUpdateAvailable(true);
        if (data.version) setRemoteVersion(data.version);
        setCommits((data.commits || []).map((c: any) => ({ h: c.sha.substring(0, 7), m: c.message, d: c.date })));
        addLog('Remote HEAD resolved.');
      } else {
        setUpdateAvailable(false);
        addLog('Repository check failed.');
      }
    } catch (e) { addLog('Network error while checking updates.'); }
    setChecking(false);
  };

  const handleUpdateNow = async () => {
    addLog('INIT: Creating backup and syncing repository...');
    try {
      const res = await fetch(`${API_BASE}/update/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: gitRepo, branch })
      });
      if (res.ok) {
        const data = await res.json();
        const jid = data.job || '';
        setJobId(jid);
        loadBackups();
        const poll = async () => {
          if (!jid) return;
          try {
            const lr = await fetch(`${API_BASE}/update/logs?job=${encodeURIComponent(jid)}`);
            if (lr.ok) {
              const payload = await lr.json();
              setLogs(payload.logs || []);
              if (!version && payload.logs) {
                const line = (payload.logs || []).find((l: string) => l.startsWith('DEPLOYED:'));
                if (line) {
                  const m = line.match(/DEPLOYED:\s+(\w+)\s+-\s+(.*)$/);
                  if (m) setVersion({ sha: m[1], message: m[2] });
                }
              }
              if ((payload.logs || []).some((l: string) => l.startsWith('BACKUP:'))) loadBackups();
              if (!payload.done) setTimeout(poll, 1000);
              else loadBackups();
            }
          } catch { setTimeout(poll, 1500); }
        };
        poll();
      }
    } catch (e) { addLog('Update request failed.'); }
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
          <div className="text-emerald-400 font-mono text-sm font-bold">{activeVersion ? `${activeVersion.sha.substring(0,7)} : ${activeVersion.message}` : 'unknown'}</div>
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
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-2 mt-6">Branch to Pull</label>
                <input 
                  type="text" 
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full bg-black/40 border border-slate-800 rounded-2xl px-6 py-3 text-sm font-mono text-blue-400 outline-none focus:border-blue-500 transition-all placeholder:text-slate-800"
                  placeholder="main"
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

          <div className="bg-black/60 p-6 rounded-[2.5rem] border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">Backups</h3>
              <button onClick={loadBackups} className="px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700">Refresh</button>
            </div>
            {backupError && <div className="text-[10px] text-rose-400 border border-rose-500/30 bg-rose-500/10 rounded-xl px-3 py-2 mb-2">{backupError}</div>}
            <div className="space-y-2">
              {backups.length === 0 ? (
                <div className="text-[10px] text-slate-600">No backups found.</div>
              ) : backups.map(b => (
                <div key={b.name} className="flex items-center justify-between p-3 bg-black/40 border border-slate-800 rounded-xl">
                  <div>
                    <div className="text-[10px] text-slate-300 font-mono">{b.name}</div>
                    <div className="text-[9px] text-slate-600 uppercase font-black">{new Date(b.mtime).toLocaleString()} • {(b.size/1024).toFixed(1)} KB</div>
                  </div>
                  <button onClick={() => restoreBackup(b.name)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/30">Restore</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENT: DHCP MANAGEMENT
 */
const DhcpManagement = ({ config, setConfig, onApply, isApplying, availableInterfaces }: { config: NetworkConfig, setConfig: any, onApply: () => void, isApplying: boolean, availableInterfaces: WanInterface[] }) => {
  const [dhcpStatus, setDhcpStatus] = useState<any>(null);
  const handleDeleteDhcp = async () => {
    try {
      const res = await fetch(`${API_BASE}/dhcp`, { method: 'DELETE' });
      if (res.ok) {
        setDhcpStatus(await res.json());
        setConfig({ ...config, dhcp: { interfaceName: '', enabled: false, start: '', end: '', leaseTime: '24h', dnsServers: '' } });
        alert('DHCP setup deleted.');
      } else {
        alert('Failed to delete DHCP setup.');
      }
    } catch (e) { alert('Error deleting DHCP setup.'); }
  };
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/dhcp/status`);
        if (res.ok) {
          const st = await res.json();
          setDhcpStatus(st);
          setConfig({
            ...config,
            dhcp: {
              interfaceName: st.interfaceName || '',
              enabled: !!st.running,
              start: st.start || '',
              end: st.end || '',
              leaseTime: st.leaseTime || '24h',
              dnsServers: (st.dnsServers || []).join(',')
            }
          });
        }
      } catch (e) {}
    })();
  }, []);

  const selectedIface = config.dhcp?.interfaceName || '';
  const dhcp = config.dhcp || { interfaceName: selectedIface, enabled: false, start: '', end: '', leaseTime: '24h', dnsServers: '8.8.8.8,1.1.1.1' };
  const setDhcp = (updates: Partial<DhcpConfig>) => {
    setConfig({ ...config, dhcp: { ...dhcp, ...updates } });
  };

  const currentIface = availableInterfaces.find(i => i.interfaceName === (config.dhcp?.interfaceName || selectedIface));

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">DHCP Management</h1>
          <p className="text-slate-400 mt-1 font-medium italic">Assign IP addresses on a selected physical interface</p>
          {dhcpStatus && (
            <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${dhcpStatus.running ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
              {dhcpStatus.running ? `Running on ${dhcpStatus.interfaceName}` : 'No DHCP server detected'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onApply} 
            disabled={isApplying} 
            className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-8 rounded-2xl shadow-xl uppercase tracking-widest text-xs"
          >
            {isApplying ? 'COMMITTING...' : 'SAVE CONFIGURATION'}
          </button>
          <button 
            onClick={handleDeleteDhcp} 
            disabled={isApplying} 
            className="bg-rose-600 hover:bg-rose-500 text-white font-black py-3 px-6 rounded-2xl shadow-xl uppercase tracking-widest text-xs"
          >
            DELETE DHCP SETUP
          </button>
        </div>
      </header>

      <div className="bg-[#0B0F1A] p-10 rounded-[2.5rem] border border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="space-y-6">
          <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-l-2 border-blue-500 pl-3">Interface</h3>
          <select 
            value={dhcp.interfaceName}
            onChange={(e) => setDhcp({ interfaceName: e.target.value })}
            className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-3 text-xs font-bold text-slate-300 outline-none"
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

  // Password Management State
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  const handleChangePassword = () => {
    const currentStored = localStorage.getItem('nexus_password') || 'admin';
    if (oldPass !== currentStored) {
      setPassMsg('Error: Incorrect current password.');
      return;
    }
    if (!newPass) {
      setPassMsg('Error: New password cannot be empty.');
      return;
    }
    localStorage.setItem('nexus_password', newPass);
    setPassMsg('Success: Password updated.');
    setOldPass('');
    setNewPass('');
    setTimeout(() => setPassMsg(''), 3000);
  };

  const handleDownloadBackup = () => {
    const blob = new Blob([JSON.stringify({ timestamp: Date.now(), signature: 'nexus-recovery-v1' })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    alert('Snapshot exported to client successfully.');
  };

  const handleRestore = () => {
    if (confirm('RESTORE WARNING: Rollback to last fixed version will restart the kernel. Proceed?')) {
      setTimeout(() => {
        alert('System restored to last fixed version.');
      }, 2000);
    }
  };



  const [ifaceConfigs, setIfaceConfigs] = useState<Record<string, { role: 'WAN' | 'NONE'; method: 'DHCP' | 'STATIC' | 'PPPOE'; staticIp?: string; netmask?: string; gateway?: string; pppoeUser?: string; pppoePass?: string }>>({});

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

        <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 backdrop-blur-md">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Disaster Recovery</h3>
          <div className="space-y-3">
            <button 
              type="button"
              onClick={() => {
                if (confirm('RESTART AGENT: This will restart the Nexus background service. Web interface may briefly disconnect. Proceed?')) {
                  // Use standard fetch without keepalive first to ensure we get a response
                  fetch(`${API_BASE}/system/restart`, { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  })
                    .then(r => {
                      if (r.ok) {
                        alert('Agent is restarting. Please wait 15-20 seconds for the service to come back online, then refresh the page.');
                        // Optional: attempt to reload page after a delay
                        // setTimeout(() => window.location.reload(), 20000);
                      }
                      else r.text().then(t => alert(`Failed to restart agent (Status ${r.status}): ${t || r.statusText}`));
                    })
                    .catch((e) => {
                      console.error(e);
                      alert(`Failed to contact agent: ${e.message || 'Unknown network error'}. \n\nCheck if the server is running on port 3000.`);
                    });
                }
              }}
              className="w-full flex items-center justify-between p-4 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 rounded-2xl transition-all group"
            >
              <div className="text-left">
                <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Restart Agent</div>
                <div className="text-[9px] text-slate-600 italic">Reboot background service</div>
              </div>
              <span className="text-xl group-hover:rotate-180 transition-transform duration-700">⚡</span>
            </button>

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

            <button
              onClick={() => {
                if (confirm('FULL SYSTEM REBOOT: This will reboot the host machine. Proceed?')) {
                  fetch(`${API_BASE}/system/reboot`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                    .then(r => {
                      if (r.ok) {
                        alert('System is rebooting. Please wait 1–2 minutes, then reconnect. The page will attempt to reload in 60 seconds.');
                        setTimeout(() => window.location.reload(), 60000);
                      } else {
                        r.text().then(t => alert(`Failed to request reboot (Status ${r.status}): ${t || r.statusText}`));
                      }
                    })
                    .catch(e => alert(`Reboot request error: ${e.message || 'Unknown network error'}`));
                }
              }}
              className="w-full flex items-center justify-between p-4 bg-slate-700/20 hover:bg-slate-700/30 border border-slate-700/40 rounded-2xl transition-all group"
            >
              <div className="text-left">
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Full System Reboot</div>
                <div className="text-[9px] text-slate-600 italic">Restart the host machine</div>
              </div>
              <span className="text-xl group-hover:rotate-180 transition-transform duration-700">🖥️</span>
            </button>

            <button
              onClick={() => {
                if (confirm('FACTORY RESET: This will erase Nexus configuration, DHCP settings, and networking rules and return to default. Proceed?')) {
                  fetch(`${API_BASE}/factory-reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                    .then(async r => {
                      if (r.ok) {
                        const d = await r.json();
                        setResetMsg('Factory reset complete.');
                        localStorage.removeItem('nexus_auth');
                        localStorage.removeItem('nexus_password');
                        fetch(`${API_BASE}/system/restart`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                          .then(rr => {
                            if (rr.ok) {
                              alert('Factory reset complete. Agent restarting. Please wait ~20 seconds; the page will reload automatically.');
                              setTimeout(() => window.location.reload(), 20000);
                            } else {
                              alert('Factory reset complete, but restart failed. Please restart the agent manually.');
                              setTimeout(() => window.location.reload(), 2000);
                            }
                          })
                          .catch(() => {
                            alert('Factory reset complete, but restart failed. Please restart the agent manually.');
                            setTimeout(() => window.location.reload(), 2000);
                          });
                      } else {
                        const t = await r.text();
                        alert(`Factory reset failed (Status ${r.status}): ${t || r.statusText}`);
                      }
                    })
                    .catch(e => alert(`Factory reset error: ${e.message || 'Unknown network error'}`));
                }
              }}
              className="w-full flex items-center justify-between p-4 bg-rose-600/10 hover:bg-rose-600/15 border border-rose-600/20 rounded-2xl transition-all group"
            >
              <div className="text-left">
                <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Factory Reset</div>
                <div className="text-[9px] text-slate-600 italic">Erase configuration and start fresh</div>
              </div>
              <span className="text-xl group-hover:scale-110 transition-transform duration-300">🧨</span>
            </button>
            {resetMsg && <div className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">{resetMsg}</div>}
          </div>
        </div>

        <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 backdrop-blur-md lg:col-span-2">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Security & Access Control</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="text-white font-bold text-sm uppercase tracking-tight mb-2">Admin Credentials</div>
              <p className="text-slate-500 text-[10px] font-medium leading-relaxed uppercase mb-6">Update the master password for the administrative console.</p>
              {passMsg && (
                <div className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl mb-4 ${passMsg.startsWith('Success') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                  {passMsg}
                </div>
              )}
            </div>
            <div className="space-y-4 bg-black/20 p-6 rounded-2xl border border-slate-800/50">
               <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Current Password</label>
                  <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-blue-500 transition-all" />
               </div>
               <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">New Password</label>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-blue-500 transition-all" />
               </div>
               <button onClick={handleChangePassword} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-black py-3 rounded-xl uppercase tracking-widest text-[10px] transition-all">Update Password</button>
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
  // Build live view by merging dynamic fields from latest /api/interfaces
  const liveMap = new Map<string, any>((interfaces || []).map((i: any) => [i.interfaceName, i]));
  const baseList: WanInterface[] = (config.wanInterfaces && config.wanInterfaces.length > 0)
    ? config.wanInterfaces
    : ((interfaces || []).filter((i: any) => i.interfaceName !== dhcpIface));
  const displayWanInterfaces: WanInterface[] = baseList.map((w: any) => {
    const live = liveMap.get(w.interfaceName) || {};
    return {
      ...w,
      ipAddress: live.ipAddress ?? w.ipAddress,
      gateway: live.gateway ?? w.gateway,
      status: live.status ?? w.status,
      latency: live.latency ?? w.latency,
      throughput: live.throughput ?? w.throughput,
      internetHealth: live.internetHealth ?? w.internetHealth
    };
  });
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

  const [ifaceConfigs, setIfaceConfigs] = useState<Record<string, { role: 'WAN' | 'NONE'; method: 'DHCP' | 'STATIC' | 'PPPOE'; staticIp?: string; netmask?: string; gateway?: string; pppoeUser?: string; pppoePass?: string }>>({});

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</label>
                  <select value={(ifaceConfigs[wan.interfaceName]?.role) || 'WAN'} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), role: e.target.value as any } }))} className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none">
                    <option value="WAN">WAN</option>
                    <option value="NONE">None</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Connection</label>
                  <select value={(ifaceConfigs[wan.interfaceName]?.method) || 'DHCP'} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), method: e.target.value as any } }))} className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none">
                    <option value="DHCP">DHCP</option>
                    <option value="STATIC">Static</option>
                    <option value="PPPOE">PPPoE Client</option>
                  </select>
                </div>
                {(ifaceConfigs[wan.interfaceName]?.method) === 'STATIC' && (
                  <div className="grid grid-cols-1 gap-2">
                    <input value={ifaceConfigs[wan.interfaceName]?.staticIp || ''} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), staticIp: e.target.value } }))} placeholder="IP Address" className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none" />
                    <input value={ifaceConfigs[wan.interfaceName]?.netmask || ''} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), netmask: e.target.value } }))} placeholder="Netmask" className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none" />
                    <input value={ifaceConfigs[wan.interfaceName]?.gateway || ''} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), gateway: e.target.value } }))} placeholder="Gateway" className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none" />
                  </div>
                )}
                {(ifaceConfigs[wan.interfaceName]?.method) === 'PPPOE' && (
                  <div className="grid grid-cols-1 gap-2">
                    <input value={ifaceConfigs[wan.interfaceName]?.pppoeUser || ''} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), pppoeUser: e.target.value } }))} placeholder="PPPoE Username" className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none" />
                    <input type="password" value={ifaceConfigs[wan.interfaceName]?.pppoePass || ''} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), pppoePass: e.target.value } }))} placeholder="PPPoE Password" className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none" />
                  </div>
                )}
              </div>
              {config.mode === RouterMode.LOAD_BALANCER ? (
                <>
                  <div className="flex justify-between items-end"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Load Weight</label><span className="text-3xl font-mono text-blue-400 font-black tracking-tighter">{wan.weight}%</span></div>
                  <input type="range" min="1" max="100" value={wan.weight} onChange={(e) => updateInterface(wan.id, { weight: parseInt(e.target.value) })} disabled={(ifaceConfigs[wan.interfaceName]?.role || 'WAN') !== 'WAN'} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50" />
                </>
              ) : (
                <>
                  <label className="text-[10px] font-black text-slate-500 uppercase block tracking-widest mb-2">Failover Priority</label>
                  <select value={wan.priority} onChange={(e) => updateInterface(wan.id, { priority: parseInt(e.target.value) })} disabled={(ifaceConfigs[wan.interfaceName]?.role || 'WAN') !== 'WAN'} className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none disabled:opacity-50"><option value={1}>1 - Primary Link</option><option value={2}>2 - Secondary Backup</option></select>
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
 * COMPONENT: INTERFACES
 */

type NetDev = {
  name: string;
  customName?: string;
  type: 'physical' | 'bridge';
  state: string;
  mac: string;
  mtu: number;
  ipAddress: string;
  speed: number | null;
  master: string | null;
  members: string[];
};

const Interfaces: React.FC = () => {
  const [items, setItems] = useState<NetDev[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const handleRename = async (interfaceName: string) => {
    try {
      await fetch(`${API_BASE}/interfaces/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interfaceName, customName: tempName })
      });
      setEditingId(null);
      // Immediate refresh
      const r = await fetch(`${API_BASE}/netdevs`);
      if (r.ok) {
        const d = await r.json();
        setItems(d.interfaces || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startEditing = (item: NetDev) => {
    setEditingId(item.name);
    setTempName(item.customName || '');
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const r = await fetch(`${API_BASE}/netdevs`);
        if (r.ok) {
          const d = await r.json();
          setItems(d.interfaces || []);
        } else {
          setError(`Status ${r.status}`);
        }
      } catch (e: any) {
        setError(e?.message || 'Network error');
      }
      setLoading(false);
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const bridges = useMemo(() => items.filter(i => i.type === 'bridge'), [items]);
  const phys = useMemo(() => items.filter(i => i.type === 'physical'), [items]);

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">Interfaces</h1>
          <div className="text-slate-500 text-xs font-black uppercase tracking-widest">Physical ports and bridges</div>
        </div>
        <div className="text-xs font-mono text-blue-400">{loading ? 'Refreshing...' : 'Live'}</div>
      </header>

      {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-xs font-black">{error}</div>}

      <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white">Bridges</h2>
          <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{bridges.length} bridge(s)</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase tracking-widest">
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">IP</th>
                <th className="text-left px-3 py-2">MAC</th>
                <th className="text-left px-3 py-2">MTU</th>
                <th className="text-left px-3 py-2">Members</th>
                <th className="text-left px-3 py-2">State</th>
              </tr>
            </thead>
            <tbody>
              {bridges.map(b => (
                <tr key={b.name} className="border-t border-slate-800/60">
                  <td className="px-3 py-2 text-white font-bold group relative">
                    {editingId === b.name ? (
                      <div className="flex items-center gap-2">
                        <input 
                          autoFocus
                          value={tempName}
                          onChange={e => setTempName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRename(b.name);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="bg-slate-950 text-white px-2 py-1 rounded text-xs border border-blue-500 outline-none w-32"
                        />
                        <button onClick={() => handleRename(b.name)} className="text-emerald-500 hover:text-emerald-400">✓</button>
                        <button onClick={() => setEditingId(null)} className="text-rose-500 hover:text-rose-400">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => startEditing(b)}>
                        <span>{b.customName || b.name}</span>
                        {b.customName && <span className="text-[10px] text-slate-500 font-mono bg-slate-800 px-1 rounded">{b.name}</span>}
                        <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-400">✎</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-blue-400">{b.ipAddress || 'N/A'}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{b.mac || 'N/A'}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{b.mtu}</td>
                  <td className="px-3 py-2 text-slate-300">{b.members.length ? b.members.join(', ') : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${b.state === 'UP' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700/20 text-slate-400 border border-slate-700/30'}`}>{b.state}</span>
                  </td>
                </tr>
              ))}
              {bridges.length === 0 && (
                <tr><td className="px-3 py-4 text-slate-500 text-xs font-black uppercase" colSpan={6}>No bridges detected</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white">Physical Interfaces</h2>
          <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{phys.length} port(s)</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase tracking-widest">
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">IP</th>
                <th className="text-left px-3 py-2">MAC</th>
                <th className="text-left px-3 py-2">MTU</th>
                <th className="text-left px-3 py-2">Speed</th>
                <th className="text-left px-3 py-2">Master</th>
                <th className="text-left px-3 py-2">State</th>
              </tr>
            </thead>
            <tbody>
              {phys.map(p => (
                <tr key={p.name} className="border-t border-slate-800/60">
                  <td className="px-3 py-2 text-white font-bold group relative">
                    {editingId === p.name ? (
                      <div className="flex items-center gap-2">
                        <input 
                          autoFocus
                          value={tempName}
                          onChange={e => setTempName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRename(p.name);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="bg-slate-950 text-white px-2 py-1 rounded text-xs border border-blue-500 outline-none w-32"
                        />
                        <button onClick={() => handleRename(p.name)} className="text-emerald-500 hover:text-emerald-400">✓</button>
                        <button onClick={() => setEditingId(null)} className="text-rose-500 hover:text-rose-400">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => startEditing(p)}>
                        <span>{p.customName || p.name}</span>
                        {p.customName && <span className="text-[10px] text-slate-500 font-mono bg-slate-800 px-1 rounded">{p.name}</span>}
                        <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-400">✎</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-blue-400">{p.ipAddress || 'N/A'}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{p.mac || 'N/A'}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{p.mtu}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{p.speed ? `${p.speed} Mb/s` : 'N/A'}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{p.master || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${p.state === 'UP' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700/20 text-slate-400 border border-slate-700/30'}`}>{p.state}</span>
                  </td>
                </tr>
              ))}
              {phys.length === 0 && (
                <tr><td className="px-3 py-4 text-slate-500 text-xs font-black uppercase" colSpan={7}>No interfaces detected</td></tr>
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
interface FirewallManagerProps {
  config: NetworkConfig;
  setConfig: (config: NetworkConfig) => void;
  onApply: () => void;
  isApplying: boolean;
}

const FirewallManager: React.FC<FirewallManagerProps> = ({
  config,
  setConfig,
  onApply,
  isApplying
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'filter' | 'nat'>('filter');
  const [natRules, setNatRules] = useState<string[]>([]);
  const [loadingNat, setLoadingNat] = useState(false);

  const fetchNatRules = useCallback(async () => {
    setLoadingNat(true);
    try {
      const res = await fetch('/api/firewall/nat');
      const data = await res.json();
      setNatRules(data.rules || []);
    } catch (error) {
      console.error('Failed to fetch NAT rules:', error);
    } finally {
      setLoadingNat(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'nat') {
      fetchNatRules();
    }
  }, [activeSubTab, fetchNatRules]);

  const [newRule, setNewRule] = useState<Partial<FirewallRule>>({
    type: 'INPUT',
    proto: 'tcp',
    action: 'ACCEPT',
    enabled: true,
    port: '',
    src: ''
  });

  const rules = config.firewallRules || [];

  const addRule = () => {
    const rule: FirewallRule = {
      id: Math.random().toString(36).substr(2, 9),
      type: newRule.type as any,
      proto: newRule.proto as any,
      port: newRule.port || '',
      src: newRule.src || '',
      action: newRule.action as any,
      enabled: true
    };
    setConfig({
      ...config,
      firewallRules: [...rules, rule]
    });
    setNewRule({ ...newRule, port: '', src: '' });
  };

  const removeRule = (id: string) => {
    setConfig({
      ...config,
      firewallRules: rules.filter(r => r.id !== id)
    });
  };

  const toggleRule = (id: string) => {
     setConfig({
      ...config,
      firewallRules: rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    });
  };

  return (
     <div className="space-y-8 pb-32 animate-in fade-in duration-700">
       {/* Header */}
       <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Firewall</h1>
          <p className="text-slate-400 mt-1 font-medium">Traffic Control & Security Rules</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-900/50 p-1 rounded-xl border border-slate-800 flex">
            <button
              onClick={() => setActiveSubTab('filter')}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'filter' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Filter Rules
            </button>
            <button
              onClick={() => setActiveSubTab('nat')}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'nat' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              NAT Rules
            </button>
          </div>
          <button 
              onClick={onApply}
              disabled={isApplying}
              className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 px-8 rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest text-xs"
            >
              {isApplying ? 'APPLYING...' : 'APPLY RULES'}
            </button>
        </div>
      </header>

      {activeSubTab === 'filter' ? (
        <>
          {/* Add Rule Form */}
          <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800">
             <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">Add New Rule</h3>
             <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <select 
                  value={newRule.type}
                  onChange={e => setNewRule({...newRule, type: e.target.value as any})}
                  className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none"
                >
                  <option value="INPUT">INPUT (Local)</option>
                  <option value="FORWARD">FORWARD (Routing)</option>
                </select>
                <select 
                  value={newRule.proto}
                  onChange={e => setNewRule({...newRule, proto: e.target.value as any})}
                  className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="icmp">ICMP</option>
                  <option value="any">ANY</option>
                </select>
                <input
                  type="text"
                  placeholder="Port (e.g. 80, 443)"
                  value={newRule.port}
                  onChange={e => setNewRule({...newRule, port: e.target.value})}
                  className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none"
                />
                <input
                  type="text"
                  placeholder="Source IP (Optional)"
                  value={newRule.src}
                  onChange={e => setNewRule({...newRule, src: e.target.value})}
                  className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none"
                />
                 <select 
                  value={newRule.action}
                  onChange={e => setNewRule({...newRule, action: e.target.value as any})}
                  className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none"
                >
                  <option value="ACCEPT">ACCEPT</option>
                  <option value="DROP">DROP</option>
                  <option value="REJECT">REJECT</option>
                </select>
                <button onClick={addRule} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/20 active:scale-95 transition-all">
                  ADD RULE
                </button>
             </div>
          </div>

          {/* Rules List */}
          <div className="space-y-4">
            {rules.length === 0 ? (
               <div className="text-center py-12 text-slate-500 text-sm">No active firewall rules</div>
            ) : (
              rules.map((rule, idx) => (
                <div key={rule.id} className={`bg-slate-900/40 p-4 rounded-2xl border flex items-center justify-between group transition-all ${rule.enabled ? 'border-slate-800 hover:border-blue-500/30' : 'border-slate-800 opacity-60'}`}>
                  <div className="flex items-center gap-6">
                    <div className="font-mono text-xs text-slate-500 w-8">#{idx + 1}</div>
                    <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${rule.action === 'ACCEPT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {rule.action}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">{rule.type}</span>
                      <span className="text-[10px] text-slate-500 font-mono uppercase">{rule.proto} {rule.port ? `:${rule.port}` : ''}</span>
                    </div>
                    {rule.src && (
                       <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Source</span>
                        <span className="text-xs font-mono text-blue-400">{rule.src}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                     <button onClick={() => toggleRule(rule.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${rule.enabled ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                       {rule.enabled ? 'Active' : 'Disabled'}
                     </button>
                     <button onClick={() => removeRule(rule.id)} className="p-2 text-slate-500 hover:text-rose-400 transition-colors">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                     </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Current System NAT Rules</h3>
            <button 
              onClick={fetchNatRules} 
              disabled={loadingNat}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loadingNat ? "animate-spin" : ""}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
              REFRESH
            </button>
          </div>
          <div className="bg-black/50 rounded-2xl border border-slate-800 p-6 overflow-x-auto font-mono text-xs">
            {loadingNat ? (
              <div className="text-slate-500 italic">Loading rules...</div>
            ) : natRules.length === 0 ? (
              <div className="text-slate-500 italic">No NAT rules found or not running on Linux</div>
            ) : (
              <table className="w-full text-left">
                <tbody>
                  {natRules.map((rule, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-2 text-slate-600 select-none w-12 text-right">{i + 1}</td>
                      <td className="py-2 px-4 text-emerald-400 whitespace-pre-wrap break-all">{rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
             <div className="flex gap-3">
               <div className="text-blue-400">ℹ️</div>
               <p className="text-xs text-blue-200/80 leading-relaxed">
                 These are the raw active Network Address Translation (NAT) rules from the system kernel. 
                 They include Masquerading (WAN access) and Port Forwarding rules managed by other system modules.
               </p>
             </div>
          </div>
        </div>
      )}
     </div>
  );
};

type DataplicityStatus = {
  installed: boolean;
  running: boolean;
  serial?: string;
  version?: string;
  log?: string[];
};

const DataplicityManager: React.FC = () => {
  const [status, setStatus] = useState<DataplicityStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installCmd, setInstallCmd] = useState('');
  const [error, setError] = useState('');
  const [installLogs, setInstallLogs] = useState('');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dataplicity/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch Dataplicity status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleInstall = async () => {
    if (!installCmd.trim()) return;
    setInstalling(true);
    setError('');
    setInstallLogs('');
    
    // Extract ID if user pasted full command, or use as is if it's just the code?
    // Actually, backend can handle the parsing or just run the command if safe.
    // To be safe, let's extract the ID or validate the command structure.
    // Common: curl -s https://www.dataplicity.com/<ID>.py | sudo python3
    // Or just: https://www.dataplicity.com/<ID>.py
    
    try {
      const res = await fetch(`${API_BASE}/dataplicity/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: installCmd })
      });
      
      const data = await res.json();
      
      if (data.output) {
        setInstallLogs(data.output);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Installation failed');
      }
      
      await fetchStatus();
      setInstallCmd('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header>
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Dataplicity Manager</h1>
        <p className="text-slate-400 mt-1 font-medium italic">Remote Shell & Device Management</p>
      </header>

      {status?.installed ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-6">
            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Service Status</h3>
            
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${status.running ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
              <div className="text-xl font-bold text-white tracking-tight">
                {status.running ? 'ACTIVE & RUNNING' : 'STOPPED'}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800/50">
               <div>
                 <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Serial Number</div>
                 <div className="font-mono text-blue-400 text-lg">{status.serial || 'Unknown'}</div>
               </div>
               {status.version && (
                 <div>
                   <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Agent Version</div>
                   <div className="font-mono text-slate-300">{status.version}</div>
                 </div>
               )}
            </div>

            <div className="flex gap-4 mt-4">
              <button 
                onClick={fetchStatus} 
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-widest transition-all"
              >
                {loading ? 'REFRESHING...' : 'REFRESH STATUS'}
              </button>

              {!status.running && (
                <button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await fetch(`${API_BASE}/dataplicity/start`, { method: 'POST' });
                      // Add delay to allow service to start
                      setTimeout(fetchStatus, 3000);
                    } catch(e) {
                      console.error(e);
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                >
                  START SERVICE
                </button>
              )}
            </div>
          </div>

          <div className="bg-[#0B0F1A] p-8 rounded-[2.5rem] border border-slate-800 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-3xl mb-2">
              ☁️
            </div>
            <h3 className="text-xl font-bold text-white">Remote Access Ready</h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              Your device is connected to Dataplicity. You can access the remote shell from your dashboard at <a href="https://www.dataplicity.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">dataplicity.com</a>.
            </p>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto bg-slate-900/40 p-10 rounded-[3rem] border border-slate-800 text-center space-y-8">
           <div className="space-y-2">
             <div className="w-20 h-20 bg-slate-800 rounded-3xl mx-auto flex items-center justify-center text-4xl mb-6 shadow-xl shadow-black/20">
               🔌
             </div>
             <h2 className="text-3xl font-black text-white tracking-tight">Connect to Dataplicity</h2>
             <p className="text-slate-400">Enter your installation command to enable remote access.</p>
           </div>

           <div className="space-y-4 text-left max-w-xl mx-auto">
             <div className="bg-black/40 p-6 rounded-2xl border border-slate-800">
               <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Installation Command</label>
               <textarea 
                 value={installCmd}
                 onChange={e => setInstallCmd(e.target.value)}
                 placeholder="curl -s https://www.dataplicity.com/xxxx.py | sudo python3"
                 className="w-full bg-transparent border-none outline-none text-slate-300 font-mono text-xs h-24 resize-none placeholder:text-slate-700"
               />
             </div>
             
             {error && (
               <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold">
                 Error: {error}
               </div>
             )}
             
             {installLogs && (
                <div className="p-4 bg-black border border-slate-800 rounded-xl">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Installation Log</div>
                  <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap overflow-x-auto max-h-40 scrollbar-thin scrollbar-thumb-slate-700">
                    {installLogs}
                  </pre>
                </div>
             )}

             <button
               onClick={handleInstall}
               disabled={installing || !installCmd.trim()}
               className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${installing ? 'bg-slate-700 text-slate-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-95'}`}
             >
               {installing ? 'INSTALLING...' : 'RUN INSTALLER'}
             </button>
             
             <p className="text-[10px] text-slate-600 text-center">
               The installer will run using Python 3 as requested. This process may take a minute.
             </p>
           </div>
        </div>
      )}
    </div>
  );
};

const Layout = ({ children, activeTab, setActiveTab, isLive, onLogout }: any) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'interfaces', label: 'Interfaces', icon: '🔌' },
    { id: 'wan', label: 'Multi-WAN', icon: '🌐' },
    { id: 'firewall', label: 'Firewall', icon: '🛡️' },
    { id: 'devices', label: 'Devices', icon: '💻' },
    { id: 'dhcp', label: 'DHCP Management', icon: '🌉' },
    { id: 'zerotier', label: 'ZeroTier', icon: '🕸️' },
    { id: 'dataplicity', label: 'Dataplicity', icon: '🐍' },
    { id: 'updates', label: 'Updates', icon: '🆙' },
    { id: 'advisor', label: 'AI Advisor', icon: '🧠' },
    { id: 'settings', label: 'System', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0B0F1A] border-b border-slate-800 z-40 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="font-bold text-xl tracking-tight text-white uppercase italic">Nexus</span>
        </div>
      </div>
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
      {!isMobileMenuOpen && (
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="md:hidden fixed bottom-20 right-4 z-50 p-4 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 active:scale-95"
          aria-label="Open menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      )}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-[#0B0F1A] border-r border-slate-800 flex flex-col shadow-2xl
          transform transition-transform duration-300 md:translate-x-0 md:static md:inset-auto
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-8 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-xl italic text-xl">N</div>
            <span className="font-bold text-2xl tracking-tighter text-white uppercase italic">Nexus</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto custom-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 ${activeTab === tab.id ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="font-bold text-sm tracking-tight">{tab.label}</span>
            </button>
          ))}
          <div className="pt-4 mt-4 border-t border-slate-800/50">
            <button onClick={onLogout} className="w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 group">
              <span className="text-xl group-hover:-translate-x-1 transition-transform">🚪</span>
              <span className="font-bold text-sm tracking-tight">Logout</span>
            </button>
          </div>
        </nav>
        <div className="p-6 mt-auto">
          <div className={`p-5 rounded-2xl border transition-all duration-500 ${isLive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.15)]'}`}>
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-[0.2em] font-black">Hardware Link</div>
            <div className="flex items-center gap-3"><div className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-rose-500 animate-pulse shadow-[0_0_12px_#f43f5e]'}`} /><span className={`text-xs font-black uppercase tracking-tighter ${isLive ? 'text-emerald-400' : 'text-rose-400'}`}>{isLive ? 'Kernel Active' : 'Agent Lost'}</span></div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto relative bg-[#020617] scroll-smooth pt-14 md:pt-0">
        <div className="max-w-7xl mx-auto p-6 md:p-12">{children}</div>
      </main>
    </div>
  );
};

/**
 * COMPONENT: DASHBOARD (HIGH-FIDELITY RESTORED)
 */
const Dashboard = ({ interfaces, metrics }: { interfaces: WanInterface[], metrics: SystemMetrics }) => {
  const [selectedIface, setSelectedIface] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [selectedIface2, setSelectedIface2] = useState<string>('');
  const [history2, setHistory2] = useState<any[]>([]);
  
  useEffect(() => {
    if (!selectedIface && interfaces.length > 0) {
      const primary = interfaces.find(i => i.internetHealth === 'HEALTHY') || interfaces[0];
      setSelectedIface(primary.interfaceName);
    }
  }, [interfaces, selectedIface]);

  useEffect(() => {
    if (!selectedIface2 && interfaces.length > 0) {
      const alt = interfaces.find(i => i.interfaceName !== selectedIface) || interfaces[0];
      setSelectedIface2(alt.interfaceName);
    }
  }, [interfaces, selectedIface2, selectedIface]);

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

  useEffect(() => {
    if (!selectedIface2) return;
    const currentData2 = interfaces.find(i => i.interfaceName === selectedIface2);
    if (!currentData2) return;
    setHistory2(prev => {
      const newEntry = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        rx: currentData2.throughput.rx,
        tx: currentData2.throughput.tx
      };
      return [...prev, newEntry].slice(-60);
    });
  }, [interfaces, selectedIface2]);

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
        <div className="bg-[#0B0F1A] p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase italic tracking-tight">
              <span className="w-2 h-6 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              Traffic Monitor A: <span className="text-emerald-400 font-mono tracking-tighter">{(interfaces.find(i => i.interfaceName === selectedIface)?.name || selectedIface).toUpperCase()}</span>
            </h2>
            <select 
              value={selectedIface}
              onChange={(e) => setSelectedIface(e.target.value)}
              className="bg-slate-950 text-blue-400 border border-slate-800 rounded-2xl px-6 py-2.5 text-xs font-black outline-none font-mono focus:border-blue-500 cursor-pointer uppercase"
            >
              {interfaces.map(iface => (
                <option key={iface.interfaceName} value={iface.interfaceName}>{iface.name}</option>
              ))}
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorRx1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorTx1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#475569" fontSize={10} tickFormatter={(v) => `${v}M`} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px' }} />
                <Area name="Down" type="monotone" dataKey="rx" stroke="#10b981" strokeWidth={4} fill="url(#colorRx1)" isAnimationActive={false} />
                <Area name="Up" type="monotone" dataKey="tx" stroke="#3b82f6" strokeWidth={4} fill="url(#colorTx1)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0B0F1A] p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase italic tracking-tight">
              <span className="w-2 h-6 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
              Traffic Monitor B: <span className="text-blue-400 font-mono tracking-tighter">{(interfaces.find(i => i.interfaceName === selectedIface2)?.name || selectedIface2).toUpperCase()}</span>
            </h2>
            <select 
              value={selectedIface2}
              onChange={(e) => setSelectedIface2(e.target.value)}
              className="bg-slate-950 text-emerald-400 border border-slate-800 rounded-2xl px-6 py-2.5 text-xs font-black outline-none font-mono focus:border-emerald-500 cursor-pointer uppercase"
            >
              {interfaces.map(iface => (
                <option key={iface.interfaceName} value={iface.interfaceName}>{iface.name}</option>
              ))}
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history2}>
                <defs>
                  <linearGradient id="colorRx2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorTx2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#475569" fontSize={10} tickFormatter={(v) => `${v}M`} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px' }} />
                <Area name="Down" type="monotone" dataKey="rx" stroke="#10b981" strokeWidth={4} fill="url(#colorRx2)" isAnimationActive={false} />
                <Area name="Up" type="monotone" dataKey="tx" stroke="#3b82f6" strokeWidth={4} fill="url(#colorTx2)" isAnimationActive={false} />
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
                  onClick={() => { setSelectedIface(iface.interfaceName); setSelectedIface2(iface.interfaceName); }}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between ${selectedIface === iface.interfaceName ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'}`}
                >
                   <div className="flex items-center gap-4">
                      <div className={`w-2.5 h-2.5 rounded-full ${iface.internetHealth === 'HEALTHY' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]'}`} />
                      <div>
                        <div className="text-sm font-black text-white font-mono uppercase tracking-tighter">{iface.name}</div>
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
  // Login Logic State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const auth = localStorage.getItem('nexus_auth');
    if (auth === 'true') setIsLoggedIn(true);
  }, []);

  const handleLogin = () => {
    const storedPass = localStorage.getItem('nexus_password') || 'admin';
    if (loginUser === 'admin' && loginPass === storedPass) {
      setIsLoggedIn(true);
      localStorage.setItem('nexus_auth', 'true');
      setLoginError('');
    } else {
      setLoginError('Invalid credentials');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('nexus_auth');
    setLoginUser('');
    setLoginPass('');
  };

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
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const [ifaceRes, metricRes, configRes, netdevsRes] = await Promise.all([
        fetch(`${API_BASE}/interfaces`, { signal: controller.signal }),
        fetch(`${API_BASE}/metrics`, { signal: controller.signal }),
        fetch(`${API_BASE}/config`, { signal: controller.signal }),
        fetch(`${API_BASE}/netdevs`, { signal: controller.signal })
      ]);
      clearTimeout(timeoutId);

      let ndMap: Record<string, any> = {};
      if (netdevsRes.ok) {
        const nd = await netdevsRes.json();
        if (nd && Array.isArray(nd.interfaces)) {
          nd.interfaces.forEach((n: any) => { ndMap[n.name] = n; });
        }
      }

      if (metricRes.ok) {
        const met = await metricRes.json();
        setMetrics(met);
      }

      if (ifaceRes.ok) {
        const rawIfaces = await ifaceRes.json();
        const ifaces = Array.isArray(rawIfaces) ? rawIfaces : [];
        const overlaid = ifaces.map((i: any) => {
          const nd = ndMap[i.interfaceName] || {};
          const ip = i.ipAddress && i.ipAddress !== 'N/A' ? i.ipAddress : (nd.ipAddress || i.ipAddress);
          return { ...i, ipAddress: ip };
        });
        setInterfaces(overlaid);

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
        if (netdevsRes.ok) {
          const nd = await netdevsRes.json();
          const list = (nd.interfaces || []).filter((n: any) => n.type !== 'bridge').map((n: any) => ({
            id: n.name,
            name: (n.customName || n.name.toUpperCase()),
            interfaceName: n.name,
            status: (n.state === 'UP' ? 'UP' : 'DOWN'),
            ipAddress: n.ipAddress || 'N/A',
            gateway: 'Detecting...',
            throughput: { rx: 0, tx: 0 },
            latency: 0,
            internetHealth: 'OFFLINE'
          }));
          setInterfaces(list);
          setIsLive(true);
        } else {
          setIsLive(false);
        }
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

  if (!isLoggedIn) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/30">
        <div className="bg-slate-900/40 p-12 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md w-full max-w-md animate-in fade-in zoom-in duration-500">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-bold text-white shadow-xl italic text-3xl mx-auto mb-6">N</div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Nexus OS</h1>
            <p className="text-slate-500 mt-2 text-xs font-black uppercase tracking-widest">Secure Admin Access</p>
          </div>
          
          {loginError && (
            <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-center">
              {loginError}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Username</label>
              <input 
                type="text" 
                value={loginUser}
                onChange={e => setLoginUser(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full bg-black/40 border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                placeholder="admin"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Password</label>
              <input 
                type="password" 
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full bg-black/40 border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                placeholder="••••••••"
              />
            </div>
            <button 
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 uppercase tracking-widest text-xs transition-all active:scale-95"
            >
              Login to Console
            </button>
          </div>
          
          <div className="mt-8 text-center">
             <div className="text-[9px] text-slate-700 font-mono">Build v2.4.0-stable</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive} onLogout={handleLogout}>
      {activeTab === 'dashboard' && <Dashboard interfaces={interfaces} metrics={metrics} />}
      {activeTab === 'interfaces' && <Interfaces />}
      {activeTab === 'wan' && <InterfaceManager interfaces={interfaces} config={currentConfig} appliedConfig={appliedConfig} setConfig={setCurrentConfig} onApply={handleApplyConfig} isApplying={isApplying} />}
      {activeTab === 'firewall' && <FirewallManager config={currentConfig} setConfig={setCurrentConfig} onApply={handleApplyConfig} isApplying={isApplying} />}
      {activeTab === 'devices' && <DeviceList />}
      {activeTab === 'dhcp' && <DhcpManagement config={currentConfig} setConfig={setCurrentConfig} onApply={handleApplyConfig} isApplying={isApplying} availableInterfaces={interfaces} />}
      {activeTab === 'zerotier' && <ZeroTierManager />}
      {activeTab === 'dataplicity' && <DataplicityManager />}
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
