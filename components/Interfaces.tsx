import React, { useEffect, useMemo, useState } from 'react';

type NetDev = {
  name: string;
  type: 'physical' | 'bridge';
  state: string;
  mac: string;
  mtu: number;
  ipAddress: string;
  speed: number | null;
  master: string | null;
  members: string[];
};

const API_BASE = `http://${window.location.hostname || 'localhost'}:3000/api`;

const Interfaces: React.FC = () => {
  const [items, setItems] = useState<NetDev[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
                  <td className="px-3 py-2 text-white font-bold">{b.name}</td>
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
                  <td className="px-3 py-2 text-white font-bold">{p.name}</td>
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

export default Interfaces;

