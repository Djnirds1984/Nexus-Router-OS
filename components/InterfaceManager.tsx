import React, { useState, useMemo, useEffect } from 'react';
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
    const enriched = [...config.wanInterfaces].map(wan => ({
      ...wan,
      name: wan.name || wan.interfaceName.toUpperCase(),
      ipAddress: wan.ipAddress || 'N/A',
      gateway: wan.gateway || 'Detecting...',
      latency: wan.latency || 0,
      status: wan.status
    }));
    const sorted = [...enriched].sort((a, b) => {
      if (config.mode === RouterMode.FAILOVER) return a.priority - b.priority;
      return b.weight - a.weight;
    });
    return sorted;
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

  const [ifaceConfigs, setIfaceConfigs] = useState<Record<string, { role: 'WAN' | 'NONE'; method: 'DHCP' | 'STATIC' | 'PPPOE'; staticIp?: string; netmask?: string; gateway?: string; pppoeUser?: string; pppoePass?: string }>>({});

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [availableInterfaces, setAvailableInterfaces] = useState<string[]>([]);
  const [newWan, setNewWan] = useState<Partial<WanInterface>>({
    method: 'DHCP',
    role: 'WAN',
    weight: 50,
    priority: 1
  });
  const [dnsInput, setDnsInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!newWan.interfaceName) newErrors.interfaceName = 'Interface is required';
    if (newWan.method === 'STATIC') {
      const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
      if (!newWan.staticIp || !ipRegex.test(newWan.staticIp)) newErrors.staticIp = 'Valid IP required';
      if (!newWan.netmask || !ipRegex.test(newWan.netmask)) newErrors.netmask = 'Valid Netmask required';
      if (newWan.gateway && !ipRegex.test(newWan.gateway)) newErrors.gateway = 'Valid Gateway IP required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (isAddModalOpen) {
      const used = config.wanInterfaces.map(w => w.interfaceName);
      const avail = interfaces
        .filter(i => !used.includes(i.interfaceName))
        .map(i => i.interfaceName);
      setAvailableInterfaces(avail);
    }
  }, [isAddModalOpen, config.wanInterfaces, interfaces]);

  const handleAddWan = async () => {
    if (!validateForm()) return;
    
    const dnsServers = dnsInput.split(',').map(s => s.trim()).filter(s => s);

    // Atomic operation: Add via API immediately
    try {
        const res = await fetch('/api/wan/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                interfaceName: newWan.interfaceName,
                method: newWan.method,
                staticIp: newWan.staticIp,
                netmask: newWan.netmask,
                gateway: newWan.gateway,
                dnsServers,
                name: newWan.name
            })
        });
        
        if (res.ok) {
            const data = await res.json();
            // Update local config to reflect change immediately without waiting for full reload
            setConfig({
                ...config,
                wanInterfaces: [...config.wanInterfaces, data.wan]
            });
            setIsAddModalOpen(false);
            setNewWan({ method: 'DHCP', role: 'WAN', weight: 50, priority: 1 });
            setDnsInput('');
            setErrors({});
        } else {
            alert('Failed to add WAN interface');
        }
    } catch (e) {
        console.error(e);
        alert('Error adding WAN interface');
    }
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
          const cfg = ifaceConfigs[wan.interfaceName] || { role: 'WAN', method: 'DHCP' };
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 relative z-10">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</label>
                  <select value={cfg.role} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), role: e.target.value as any } }))} className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none">
                    <option value="WAN">WAN</option>
                    <option value="NONE">None</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Connection</label>
                  <select value={cfg.method} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), method: e.target.value as any } }))} className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none">
                    <option value="DHCP">DHCP</option>
                    <option value="STATIC">Static</option>
                    <option value="PPPOE">PPPoE Client</option>
                  </select>
                </div>
                {cfg.method === 'STATIC' && (
                  <div className="grid grid-cols-1 gap-2">
                    <input value={cfg.staticIp || ''} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), staticIp: e.target.value } }))} placeholder="IP Address" className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none" />
                    <input value={cfg.netmask || ''} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), netmask: e.target.value } }))} placeholder="Netmask" className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none" />
                    <input value={cfg.gateway || ''} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), gateway: e.target.value } }))} placeholder="Gateway" className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none" />
                  </div>
                )}
                {cfg.method === 'PPPOE' && (
                  <div className="grid grid-cols-1 gap-2">
                    <input value={cfg.pppoeUser || ''} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), pppoeUser: e.target.value } }))} placeholder="PPPoE Username" className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none" />
                    <input type="password" value={cfg.pppoePass || ''} onChange={(e) => setIfaceConfigs(prev => ({ ...prev, [wan.interfaceName]: { ...(prev[wan.interfaceName] || { role: 'WAN', method: 'DHCP' }), pppoePass: e.target.value } }))} placeholder="PPPoE Password" className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none" />
                  </div>
                )}
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
                    disabled={cfg.role !== 'WAN'}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all shadow-inner disabled:opacity-50"
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
                    disabled={cfg.role !== 'WAN'}
                    className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none transition-all cursor-pointer hover:bg-black/60 focus:border-blue-500 disabled:opacity-50"
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

        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="h-full border-2 border-dashed border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center p-16 text-slate-600 hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group cursor-pointer"
        >
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">+</div>
          <span className="font-black tracking-tight text-sm uppercase">Add WAN Interface</span>
          <span className="text-[10px] opacity-60 mt-2 uppercase font-black tracking-widest">Configure new uplink</span>
        </button>
      </div>

      {/* Add WAN Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6">
            <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic">Add WAN Interface</h3>
            
            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Physical Interface</label>
                    <select 
                        value={newWan.interfaceName || ''} 
                        onChange={e => setNewWan({...newWan, interfaceName: e.target.value})}
                        className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-300 outline-none focus:border-blue-500"
                    >
                        <option value="">Select Interface...</option>
                        {availableInterfaces.map(iface => (
                            <option key={iface} value={iface}>{iface}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Connection Type</label>
                    <div className="flex gap-2 mt-1">
                        {['DHCP', 'STATIC'].map(m => (
                            <button
                                key={m}
                                onClick={() => setNewWan({...newWan, method: m as any})}
                                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${newWan.method === m ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {newWan.method === 'STATIC' && (
                    <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <input 
                                placeholder="IP Address (e.g. 192.168.1.10)" 
                                value={newWan.staticIp || ''}
                                onChange={e => setNewWan({...newWan, staticIp: e.target.value})}
                                className={`w-full bg-black/40 border ${errors.staticIp ? 'border-rose-500' : 'border-slate-800'} rounded-xl px-4 py-3 text-sm font-bold text-slate-300 outline-none focus:border-blue-500`}
                            />
                            {errors.staticIp && <p className="text-[10px] text-rose-500 font-bold mt-1 ml-1">{errors.staticIp}</p>}
                        </div>
                        <div>
                            <input 
                                placeholder="Netmask (e.g. 255.255.255.0)" 
                                value={newWan.netmask || ''}
                                onChange={e => setNewWan({...newWan, netmask: e.target.value})}
                                className={`w-full bg-black/40 border ${errors.netmask ? 'border-rose-500' : 'border-slate-800'} rounded-xl px-4 py-3 text-sm font-bold text-slate-300 outline-none focus:border-blue-500`}
                            />
                            {errors.netmask && <p className="text-[10px] text-rose-500 font-bold mt-1 ml-1">{errors.netmask}</p>}
                        </div>
                        <div>
                            <input 
                                placeholder="Gateway (e.g. 192.168.1.1)" 
                                value={newWan.gateway || ''}
                                onChange={e => setNewWan({...newWan, gateway: e.target.value})}
                                className={`w-full bg-black/40 border ${errors.gateway ? 'border-rose-500' : 'border-slate-800'} rounded-xl px-4 py-3 text-sm font-bold text-slate-300 outline-none focus:border-blue-500`}
                            />
                             {errors.gateway && <p className="text-[10px] text-rose-500 font-bold mt-1 ml-1">{errors.gateway}</p>}
                        </div>
                    </div>
                )}
                
                <div>
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">DNS Servers</label>
                     <input 
                        placeholder="8.8.8.8, 1.1.1.1" 
                        value={dnsInput}
                        onChange={e => setDnsInput(e.target.value)}
                        className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-300 outline-none focus:border-blue-500 mt-1"
                     />
                </div>
            </div>

            <div className="flex gap-4 pt-4">
                <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-800 transition-all"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleAddWan}
                    disabled={!newWan.interfaceName || (newWan.method === 'STATIC' && (!newWan.staticIp || !newWan.netmask))}
                    className="flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Add Interface
                </button>
            </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default InterfaceManager;
