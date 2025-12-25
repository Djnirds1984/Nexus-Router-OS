import React, { useState, useMemo } from 'react';
import { NetworkConfig, RouterMode, WanStatus, WanInterface } from '../types';

interface ExtendedWanInterface extends WanInterface {
  internetHealth?: 'HEALTHY' | 'OFFLINE';
}

interface InterfaceManagerProps {
  interfaces: any[];
  config: NetworkConfig;
  appliedConfig: NetworkConfig;
  setConfig: (config: NetworkConfig) => void;
  onApply: () => void;
  isApplying: boolean;
}

const InterfaceManager: React.FC<InterfaceManagerProps> = ({ 
  interfaces,
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
    const sorted = [...config.wanInterfaces].sort((a, b) => {
      if (config.mode === RouterMode.FAILOVER) return a.priority - b.priority;
      return b.weight - a.weight;
    });
    
    return sorted.map(wan => {
      const live = interfaces.find(i => i.interfaceName === wan.interfaceName);
      return {
        ...wan,
        name: live?.name || wan.name || wan.interfaceName.toUpperCase(),
        ipAddress: live?.ipAddress || wan.ipAddress || 'N/A',
        gateway: live?.gateway || wan.gateway || 'Detecting...',
        latency: live?.latency || wan.latency || 0,
        internetHealth: live?.internetHealth,
        status: live?.status || wan.status
      };
    });
  }, [config.wanInterfaces, config.mode, interfaces]);

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
    <div className="space-y-8 pb-32 animate-in fade-in duration-700">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Smart Multi-WAN</h1>
          <p className="text-slate-400 mt-1 font-medium">Kernel-level load balancing & automatic failover orchestration.</p>
        </div>
        {isDirty && (
          <div className="flex items-center gap-4 bg-blue-500/10 border border-blue-500/20 p-5 rounded-2xl shadow-xl shadow-blue-500/5 animate-bounce">
            <div className="text-right">
              <div className="text-blue-400 font-black text-xs uppercase tracking-widest">Pending Sync</div>
              <div className="text-slate-500 text-[10px] font-bold">Update routing tables</div>
            </div>
            <button 
              onClick={onApply}
              disabled={isApplying}
              className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 px-8 rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest text-xs"
            >
              {isApplying ? 'SYNCING...' : 'COMMIT TO KERNEL'}
            </button>
          </div>
        )}
      </header>

      {/* Mode Selector */}
      <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8 backdrop-blur-md">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-3">
            <h2 className="text-2xl font-black text-white tracking-tight">Routing Engine</h2>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${config.mode === RouterMode.LOAD_BALANCER ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
              {config.mode === RouterMode.LOAD_BALANCER ? 'Active-Active ECMP' : 'Active-Passive Priority'}
            </div>
          </div>
          <p className="text-slate-500 text-sm max-w-2xl leading-relaxed font-medium">
            {config.mode === RouterMode.LOAD_BALANCER 
              ? "Distributes sessions across all healthy WANs using Equal-Cost Multi-Path. Smart routing automatically excludes interfaces with high packet loss or timeouts."
              : "Directs all traffic to the top-priority healthy link. Failover triggers within 4 seconds of a request timeout detection."}
          </p>
        </div>
        <div className="flex bg-black/40 p-2 rounded-2xl border border-slate-800 shadow-inner shrink-0">
          <button 
            onClick={() => setConfig({...config, mode: RouterMode.LOAD_BALANCER})}
            className={`px-8 py-4 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${config.mode === RouterMode.LOAD_BALANCER ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-600 hover:text-slate-300'}`}
          >
            Load Balance
          </button>
          <button 
            onClick={() => setConfig({...config, mode: RouterMode.FAILOVER})}
            className={`px-8 py-4 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${config.mode === RouterMode.FAILOVER ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-600 hover:text-slate-300'}`}
          >
            Failover
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {sortedWanInterfaces.map((wan: ExtendedWanInterface, index) => {
          const isHealthy = wan.internetHealth === 'HEALTHY' || (wan.status === WanStatus.UP && !wan.internetHealth);
          
          return (
            <div key={wan.id} className={`bg-slate-900/40 p-8 rounded-[2.5rem] border transition-all relative overflow-hidden backdrop-blur-md ${isHealthy ? 'border-slate-800 hover:border-blue-500/20' : 'border-rose-500/20 bg-rose-500/5'}`}>
              {!isHealthy && <div className="absolute inset-0 bg-rose-500/5 pointer-events-none animate-pulse" />}
              
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-black text-white tracking-tight uppercase italic">{wan.name}</h3>
                    <code className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-1 rounded font-mono border border-blue-500/10 font-bold">{wan.interfaceName}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isHealthy ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isHealthy ? 'Internet Active' : 'Request Timeout / Dead Link'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">Latency</div>
                    <div className={`text-2xl font-mono font-bold tracking-tighter ${isHealthy ? 'text-emerald-400' : 'text-rose-500 opacity-20'}`}>
                        {isHealthy ? `${wan.latency || 0} ms` : '---'}
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-10 relative z-10">
                <div className="p-5 bg-black/40 rounded-2xl border border-slate-800/50">
                  <div className="text-[10px] text-slate-500 font-black mb-2 uppercase tracking-widest">Local Address</div>
                  <div className="font-mono text-xs text-slate-300 font-bold">{wan.ipAddress}</div>
                </div>
                <div className="p-5 bg-black/40 rounded-2xl border border-slate-800/50">
                  <div className="text-[10px] text-slate-500 font-black mb-2 uppercase tracking-widest">Gateway Node</div>
                  <div className="font-mono text-xs text-slate-300 font-bold">{wan.gateway}</div>
                </div>
              </div>

              {config.mode === RouterMode.LOAD_BALANCER ? (
                <div className="space-y-6 relative z-10">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ECMP Distribution Weight</label>
                    <span className="text-3xl font-mono text-blue-400 font-black tracking-tighter">{wan.weight}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={wan.weight}
                    onChange={(e) => updateWeight(wan.id, parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all shadow-inner"
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 font-black uppercase tracking-widest">
                    <span>Low Priority</span>
                    <span>Max Traffic Share</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 relative z-10">
                  <label className="text-[10px] font-black text-slate-500 uppercase block tracking-widest">Failover Priority (Lower is Higher)</label>
                  <select 
                    value={wan.priority}
                    onChange={(e) => updatePriority(wan.id, parseInt(e.target.value))}
                    className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none transition-all cursor-pointer hover:bg-black/60 focus:border-blue-500"
                  >
                    <option value={1}>Primary [P1]</option>
                    <option value={2}>Secondary Backup [P2]</option>
                    <option value={3}>Tertiary Redundancy [P3]</option>
                  </select>
                  <p className="text-[10px] text-slate-600 font-bold italic">
                    {wan.priority === 1 ? 'Current primary target for all egress packets.' : `Active only if P${wan.priority - 1} internet check fails.`}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        <div className="h-full border-2 border-dashed border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center p-16 text-slate-600 hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group cursor-not-allowed">
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">🔒</div>
          <span className="font-black tracking-tight text-sm uppercase">Expand Topology</span>
          <span className="text-[10px] opacity-60 mt-2 uppercase font-black tracking-widest">Probing physical slots...</span>
        </div>
      </div>
    </div>
  );
};

export default InterfaceManager;
