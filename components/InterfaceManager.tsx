
import React, { useState, useMemo } from 'react';
import { NetworkConfig, RouterMode, WanStatus, WanInterface } from '../types';

interface InterfaceManagerProps {
  config: NetworkConfig;
  appliedConfig: NetworkConfig;
  setConfig: (config: NetworkConfig) => void;
  onApply: () => void;
  isApplying: boolean;
}

const InterfaceManager: React.FC<InterfaceManagerProps> = ({ 
  config, 
  appliedConfig, 
  setConfig, 
  onApply,
  isApplying 
}) => {
  const isDirty = useMemo(() => {
    return JSON.stringify(config) !== JSON.stringify(appliedConfig);
  }, [config, appliedConfig]);

  const sortedWanInterfaces = useMemo(() => {
    return [...config.wanInterfaces].sort((a, b) => {
      if (config.mode === RouterMode.FAILOVER) return a.priority - b.priority;
      return b.weight - a.weight;
    });
  }, [config.wanInterfaces, config.mode]);

  const updateWeight = (id: string, weight: number) => {
    setConfig({
      ...config,
      wanInterfaces: config.wanInterfaces.map(w => w.id === id ? { ...w, weight } : w)
    });
  };

  const updatePriority = (id: string, priority: number) => {
    setConfig({
      ...config,
      wanInterfaces: config.wanInterfaces.map(w => w.id === id ? { ...w, priority } : w)
    });
  };

  return (
    <div className="space-y-8 pb-32">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white">Multi-WAN Orchestration</h1>
          <p className="text-slate-400 mt-1">Configure how traffic is distributed across multiple internet connections.</p>
        </div>
        {isDirty && (
          <div className="flex items-center gap-4 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl animate-in fade-in slide-in-from-right-4">
            <div className="text-right">
              <div className="text-amber-500 font-bold text-xs uppercase">Unapplied Changes</div>
              <div className="text-slate-400 text-xs">Commit configuration to system</div>
            </div>
            <button 
              onClick={onApply}
              disabled={isApplying}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2 px-6 rounded-lg shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {isApplying ? 'APPLYING...' : 'APPLY CONFIG'}
            </button>
          </div>
        )}
      </header>

      {/* Mode Selector */}
      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-bold text-white">Routing Strategy</h2>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${config.mode === RouterMode.LOAD_BALANCER ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
              {config.mode === RouterMode.LOAD_BALANCER ? 'Active-Active' : 'Active-Passive'}
            </span>
          </div>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
            {config.mode === RouterMode.LOAD_BALANCER 
              ? "Distributes outgoing IP packets across all UP interfaces. Best for heavy downloading and maximizing aggregate speed."
              : "Routes all traffic through the highest priority interface. Switches to the next available interface only if primary health checks fail."}
          </p>
        </div>
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner shrink-0">
          <button 
            onClick={() => setConfig({...config, mode: RouterMode.LOAD_BALANCER})}
            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${config.mode === RouterMode.LOAD_BALANCER ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            LOAD BALANCER
          </button>
          <button 
            onClick={() => setConfig({...config, mode: RouterMode.FAILOVER})}
            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${config.mode === RouterMode.FAILOVER ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            AUTO FAILOVER
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedWanInterfaces.map((wan, index) => {
          const isActiveFailover = config.mode === RouterMode.FAILOVER && index === 0 && wan.status === WanStatus.UP;
          
          return (
            <div key={wan.id} className={`bg-slate-900 p-6 rounded-2xl border transition-all ${isActiveFailover ? 'border-emerald-500/50 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'border-slate-800'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white">{wan.name}</h3>
                    {isActiveFailover && <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">Current Gateway</span>}
                  </div>
                  <code className="text-xs text-blue-400 bg-blue-500/5 px-2 py-1 rounded font-mono">{wan.interfaceName}</code>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${wan.status === WanStatus.UP ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {wan.status}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/50">
                  <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">Address Architecture</div>
                  <div className="font-mono text-sm text-slate-300">{wan.ipAddress}</div>
                </div>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/50">
                  <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">Default Gateway</div>
                  <div className="font-mono text-sm text-slate-300">{wan.gateway}</div>
                </div>
              </div>

              {config.mode === RouterMode.LOAD_BALANCER ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-xs font-bold text-slate-500 uppercase">Packet Distribution Weight</label>
                    <span className="text-xl font-mono text-blue-400 font-bold">{wan.weight}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={wan.weight}
                    onChange={(e) => updateWeight(wan.id, parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 font-bold">
                    <span>LOW PRIORITY</span>
                    <span>MAX BANDWIDTH</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase block tracking-wider">Hierarchy Priority</label>
                  <select 
                    value={wan.priority}
                    onChange={(e) => updatePriority(wan.id, parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer hover:bg-slate-900"
                  >
                    <option value={1}>Primary Interface (P1)</option>
                    <option value={2}>Secondary Backup (P2)</option>
                    <option value={3}>Tertiary Redundancy (P3)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 italic">
                    {wan.priority === 1 ? 'Attempts to route all traffic here first.' : `Used only if Priority ${wan.priority - 1} fails.`}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        <button className="h-full border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-12 text-slate-500 hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group">
          <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">+</div>
          <span className="font-bold tracking-tight">Expand Infrastructure</span>
          <span className="text-xs opacity-60 mt-1 uppercase font-semibold">Probing PCIe / USB slots...</span>
        </button>
      </div>
    </div>
  );
};

export default InterfaceManager;
