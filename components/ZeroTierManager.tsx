import React, { useEffect, useMemo, useState } from 'react';

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

const getApiBase = () => {
  const host = window.location.hostname || 'localhost';
  return `http://${host}:3000/api`;
};

const API_BASE = getApiBase();

const ZeroTierManager: React.FC = () => {
  const [status, setStatus] = useState<ZTStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [joiningId, setJoiningId] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [token, setToken] = useState<string>(() => localStorage.getItem('nexus_token') || '');
  const [forwardRules, setForwardRules] = useState<ForwardRule[]>([]);
  const [newRule, setNewRule] = useState<{ proto: 'tcp' | 'udp'; listenPort: string; destIp: string; destPort: string; enabled: boolean }>({ proto: 'tcp', listenPort: '', destIp: '', destPort: '', enabled: true });
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }), [token]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/zerotier/status`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {}
    try {
      const fr = await fetch(`${API_BASE}/zerotier/forwarding`, { headers });
      if (fr.ok) setForwardRules(await fr.json());
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
  }, [headers]);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const res = await fetch(`${API_BASE}/zerotier/install`, { method: 'POST,', headers });
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {}
    setInstalling(false);
  };

  const handleJoin = async () => {
    if (!joiningId.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/zerotier/networks`, { method: 'POST', headers, body: JSON.stringify({ id: joiningId.trim() }) });
      if (res.ok) {
        await fetchStatus();
        setJoiningId('');
      }
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
      if (res.ok) {
        setForwardRules(await res.json());
        setNewRule({ proto: 'tcp', listenPort: '', destIp: '', destPort: '', enabled: true });
      }
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
            <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${status.installed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
              {status.installed ? (status.running ? 'Service: Running' : 'Service: Installed (Stopped)') : 'Not Installed'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="API Token (optional)"
            className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none"
          />
          <button onClick={saveTokenLocal} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${savingToken ? 'bg-slate-700 text-slate-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{savingToken ? 'SAVED' : 'SAVE'}</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6 lg:col-span-1 bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800">
          <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">Smart Installation</h3>
          <div className="space-y-3">
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Compatibility</div>
            <div className="text-xs text-slate-300">Linux {navigator.platform}</div>
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Dependencies</div>
            <div className="text-xs text-slate-300">zerotier-one, systemd</div>
          </div>
          <button
            onClick={handleInstall}
            disabled={installing || (status?.installed && status?.running)}
            className={`mt-4 w-full px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest ${installing ? 'bg-slate-800 text-slate-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
          >
            {installing ? 'INSTALLING...' : status?.installed ? (status?.running ? 'INSTALLED' : 'ENABLE SERVICE') : 'INSTALL ZEROTIER'}
          </button>
          {status?.node && <div className="mt-4 text-[10px] text-slate-500 font-black uppercase">Node Info</div>}
          {status?.node && <div className="font-mono text-xs text-blue-400">{status.node}</div>}
        </div>

        <div className="space-y-6 lg:col-span-2 bg-[#0B0F1A] p-8 rounded-[2.5rem] border border-slate-800">
          <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">Networks</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={joiningId}
              onChange={e => setJoiningId(e.target.value)}
              placeholder="Network ID"
              className="flex-1 bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none"
            />
            <button onClick={handleJoin} className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white">Join</button>
          </div>
          <div className="mt-6 space-y-3">
            {(status?.networks || []).length === 0 ? (
              <div className="text-slate-500 text-xs font-black uppercase tracking-widest">No networks joined</div>
            ) : (
              status?.networks.map(n => (
                <div key={n.id} className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${n.status?.toLowerCase().includes('ok') ? 'bg-emerald-500' : 'bg-amber-500'}`} />
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
          <select
            value={newRule.proto}
            onChange={e => setNewRule(r => ({ ...r, proto: e.target.value as 'tcp' | 'udp' }))}
            className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none"
          >
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
          </select>
          <input
            type="number"
            value={newRule.listenPort}
            onChange={e => setNewRule(r => ({ ...r, listenPort: e.target.value }))}
            placeholder="Listen Port"
            className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none"
          />
          <input
            type="text"
            value={newRule.destIp}
            onChange={e => setNewRule(r => ({ ...r, destIp: e.target.value }))}
            placeholder="Destination IP"
            className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none"
          />
          <input
            type="number"
            value={newRule.destPort}
            onChange={e => setNewRule(r => ({ ...r, destPort: e.target.value }))}
            placeholder="Destination Port"
            className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none"
          />
          <button onClick={addForwardRule} className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-amber-600 hover:bg-amber-500 text-white">Add Rule</button>
        </div>
        <div className="mt-6 space-y-3">
          {forwardRules.length === 0 ? (
            <div className="text-slate-500 text-xs font-black uppercase tracking-widest">No rules</div>
          ) : (
            forwardRules.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-black/40 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${r.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`} />
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

export default ZeroTierManager;

