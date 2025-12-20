import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
  throughput: { rx: number; tx: number; }; // Mbps
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

interface SystemMetrics {
  cpuUsage: number;
  cores: number[]; 
  memoryUsage: string; 
  totalMem: string; 
  temp: string;
  uptime: string;
  activeSessions: number;
}

const API_BASE = '/api';

/**
 * COMPONENT: LAYOUT
 */
const Layout = ({ children, activeTab, setActiveTab, isLive }: any) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'wan', label: 'Multi-WAN', icon: '🌐' },
    { id: 'bridge', label: 'Bridge & DHCP', icon: '🌉' },
    { id: 'advisor', label: 'AI Advisor', icon: '🧠' },
    { id: 'settings', label: 'System', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      <aside className="w-64 bg-slate-900/50 border-r border-slate-800 flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">N</div>
          <span className="font-bold text-xl tracking-tight text-white">Nexus OS</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === tab.id ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="font-medium text-sm">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 mt-auto">
          <div className={`p-4 rounded-xl border transition-all ${isLive ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]' : 'bg-amber-500/5 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]'}`}>
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-widest font-black">Kernel Status</div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isLive ? 'Hardware Linked' : 'Searching Host...'}
              </span>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto relative bg-[#0B0F1A]">
        <div className="max-w-6xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
};

/**
 * COMPONENT: DASHBOARD (TELEMETRY)
 */
const Dashboard = ({ interfaces, metrics }: { interfaces: WanInterface[], metrics: SystemMetrics }) => {
  const [selectedIface, setSelectedIface] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [smartMode, setSmartMode] = useState(true);
  const historyLimit = 60;

  // Dual-Purpose Tracking Logic
  useEffect(() => {
    // Only execute if Smart Mode is active
    if (!smartMode) return;
    
    // Find the port with the most traffic right now
    const activePorts = interfaces.filter(iface => (iface.throughput.rx + iface.throughput.tx) > 0.05);
    const top = activePorts.sort((a, b) => (b.throughput.rx + b.throughput.tx) - (a.throughput.rx + a.throughput.tx))[0];
    
    if (top && selectedIface !== top.interfaceName) {
      setSelectedIface(top.interfaceName);
      setHistory([]); // Reset graph on auto-switch for clarity
    } else if (!selectedIface && interfaces.length > 0) {
      setSelectedIface(interfaces[0].interfaceName);
    }
  }, [interfaces, smartMode, selectedIface]);

  // Graph Data Accumulator
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
      const updated = [...prev, newEntry];
      return updated.length > historyLimit ? updated.slice(updated.length - historyLimit) : updated;
    });
  }, [interfaces, selectedIface]);

  const handleManualSwitch = (ifaceName: string) => {
    setSmartMode(false); // Disables auto-follow immediately
    setSelectedIface(ifaceName);
    setHistory([]); // Clean slate for manual focus
  };

  const activeIfaceData = useMemo(() => interfaces.find(i => i.interfaceName === selectedIface), [interfaces, selectedIface]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">System Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1 uppercase tracking-wider font-mono">Uptime: {metrics.uptime || 'Reading Hardware...'}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500 font-black tracking-widest uppercase">System Load</div>
          <div className="text-2xl font-mono text-blue-400 font-bold">{metrics.cpuUsage.toFixed(1)}%</div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU GRID */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl flex flex-col min-h-[220px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Compute Cores</h3>
            <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20 font-bold">CPU</div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 flex-1 items-end">
            {(metrics.cores || Array(8).fill(0)).map((usage, i) => (
              <div key={i} className="flex flex-col items-center gap-1 group">
                <div className="w-full h-24 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden">
                  <div className={`absolute bottom-0 left-0 w-full transition-all duration-1000 ease-out ${usage > 85 ? 'bg-rose-500' : usage > 50 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ height: `${Math.max(4, usage)}%` }} />
                </div>
                <span className="text-[8px] font-mono text-slate-600 font-bold">C{i}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RAM */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Memory Pipeline</h3>
            <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 font-bold">RAM</div>
          </div>
          <div className="space-y-6">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-3xl font-mono text-white font-bold">{metrics.memoryUsage}</span>
                  <span className="text-xs text-slate-500 ml-1 font-bold">GB USED</span>
                </div>
                <span className="text-sm font-mono text-slate-400">/ {metrics.totalMem || '16.0'} GB</span>
              </div>
              <div className="overflow-hidden h-4 flex rounded-full bg-slate-950 border border-slate-800">
                <div style={{ width: `${(parseFloat(metrics.memoryUsage) / parseFloat(metrics.totalMem || '16')) * 100}%` }} className="bg-indigo-500 transition-all duration-1000 ease-in-out shadow-[0_0_15px_rgba(99,102,241,0.4)]" />
              </div>
            </div>
            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex justify-between items-center text-[10px] font-black uppercase">
               <span className="text-slate-600">Swap Load</span>
               <span className="text-emerald-400">Optimal</span>
            </div>
          </div>
        </div>

        {/* HEALTH */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl flex flex-col">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Environment</h3>
              <div className="w-10 h-10 bg-amber-600/10 rounded-xl flex items-center justify-center text-amber-400 border border-amber-500/20 font-bold">PHY</div>
           </div>
           <div className="flex-1 space-y-6 flex flex-col justify-center text-center">
              <div className="flex items-center justify-around">
                 <div>
                    <div className="text-4xl font-mono text-amber-500 font-bold">{metrics.temp || "N/A"}</div>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Thermal Zone 0</div>
                 </div>
                 <div>
                    <div className="text-4xl font-mono text-blue-400 font-bold">{metrics.activeSessions}</div>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Active IP Flows</div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/60 p-8 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md relative overflow-hidden">
          {/* TRAFFIC MONITOR HEADER WITH DUAL MODE TOGGLES */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 relative z-10">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-1.5 h-4 bg-emerald-500 rounded-sm shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> 
                Traffic Live: <span className="text-blue-400 font-mono">{selectedIface.toUpperCase()}</span>
              </h2>
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                MODE: {smartMode ? 
                  <span className="text-emerald-500 flex items-center gap-1"><span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping"></span> SMART FOCUSING</span> : 
                  <span className="text-amber-500">MANUAL LOCK</span>}
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-slate-950/50 p-2 rounded-2xl border border-slate-800">
              <button 
                onClick={() => setSmartMode(!smartMode)} 
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${smartMode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                title="Automatically switch to the interface with highest current traffic"
              >
                 {smartMode ? 'AUTO ON' : 'AUTO OFF'}
              </button>
              
              <div className="h-6 w-px bg-slate-800 mx-1"></div>

              <select 
                value={selectedIface}
                onChange={(e) => handleManualSwitch(e.target.value)}
                className="bg-slate-900 text-blue-400 border border-slate-700 rounded-xl px-4 py-2 text-xs font-bold font-mono outline-none focus:border-blue-500 cursor-pointer"
              >
                {interfaces.map(iface => (
                  <option key={iface.interfaceName} value={iface.interfaceName}>
                    {iface.interfaceName.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#475569" fontSize={10} tickFormatter={(v) => `${v}M`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }} />
                <Area name="Download" type="monotone" dataKey="rx" stroke="#10b981" strokeWidth={3} fill="url(#colorRx)" isAnimationActive={false} />
                <Area name="Upload" type="monotone" dataKey="tx" stroke="#3b82f6" strokeWidth={3} fill="url(#colorTx)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 pt-6 border-t border-slate-800 text-center font-mono font-bold">
             <div>
                <div className="text-[10px] text-slate-600 font-black uppercase mb-1 tracking-widest">Real-time RX</div>
                <div className="text-3xl text-emerald-400 tracking-tighter">{activeIfaceData?.throughput.rx.toFixed(2)} <span className="text-[10px] text-slate-600">Mbps</span></div>
             </div>
             <div>
                <div className="text-[10px] text-slate-600 font-black uppercase mb-1 tracking-widest">Real-time TX</div>
                <div className="text-3xl text-blue-400 tracking-tighter">{activeIfaceData?.throughput.tx.toFixed(2)} <span className="text-[10px] text-slate-600">Mbps</span></div>
             </div>
          </div>
        </div>

        {/* INTERFACE MATRIX LIST - MANUAL SELECTOR */}
        <div className="bg-slate-900/60 rounded-3xl border border-slate-800 overflow-hidden flex flex-col shadow-2xl backdrop-blur-md">
           <div className="p-6 border-b border-slate-800 bg-slate-800/10 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">Interface Matrix</h2>
                <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold">Select any port to lock view</p>
              </div>
              {!smartMode && (
                <button 
                  onClick={() => setSmartMode(true)} 
                  className="text-[9px] font-black text-blue-500 hover:text-blue-400 transition-colors uppercase"
                >
                  Unlock & Auto
                </button>
              )}
           </div>
           <div className="flex-1 overflow-y-auto divide-y divide-slate-800 scrollbar-hide">
              {[...interfaces].sort((a,b) => (b.throughput.rx + b.throughput.tx) - (a.throughput.rx + a.throughput.tx)).map((wan) => {
                const isSelected = selectedIface === wan.interfaceName;
                const activity = (wan.throughput.rx + wan.throughput.tx) > 0.05;
                
                return (
                  <div 
                    key={wan.id} 
                    onClick={() => handleManualSwitch(wan.interfaceName)} 
                    className={`p-6 flex items-center justify-between cursor-pointer transition-all hover:bg-slate-800/30 group ${isSelected ? 'bg-blue-600/5' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`w-2 h-2 rounded-full ${wan.status === WanStatus.UP ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`} />
                        {activity && isSelected && <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
                      </div>
                      <div>
                        <div className={`text-sm font-bold uppercase font-mono transition-colors ${isSelected ? 'text-blue-400' : 'text-white'}`}>
                          {wan.interfaceName}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono tracking-tighter">{wan.ipAddress}</div>
                      </div>
                    </div>
                    <div className="text-right">
                       <div className={`text-xs font-mono font-bold ${activity ? 'text-emerald-400' : 'text-slate-700'}`}>
                        {(wan.throughput.rx + wan.throughput.tx).toFixed(1)} M
                       </div>
                       {isSelected && <div className="text-[8px] font-bold text-blue-500/50 uppercase tracking-widest">Monitoring</div>}
                    </div>
                  </div>
                );
              })}
           </div>
           <div className="p-4 bg-slate-950/50 text-center border-t border-slate-800">
              <span className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">Hardware Native Link: Active</span>
           </div>
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENT: MULTI-WAN MANAGER
 */
const MultiWanManager = ({ config, setConfig, onApply }: any) => {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900/60 p-10 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Multi-WAN Orchestration</h2>
        <div className="flex gap-4 mb-10">
          <button onClick={() => setConfig({...config, mode: RouterMode.LOAD_BALANCER})} className={`flex-1 p-6 rounded-2xl border transition-all text-left ${config.mode === RouterMode.LOAD_BALANCER ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-950/50 border-slate-800 text-slate-500'}`}>
            <div className="font-bold">Load Balancer (Active-Active)</div>
            <div className="text-[11px] mt-1 opacity-60 font-mono">Parallel IP multiplexing across all healthy links.</div>
          </button>
          <button onClick={() => setConfig({...config, mode: RouterMode.FAILOVER})} className={`flex-1 p-6 rounded-2xl border transition-all text-left ${config.mode === RouterMode.FAILOVER ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-950/50 border-slate-800 text-slate-500'}`}>
            <div className="font-bold">Auto Failover (High Availability)</div>
            <div className="text-[11px] mt-1 opacity-60 font-mono">Priority routing with automatic outage detection.</div>
          </button>
        </div>

        <div className="space-y-6 mb-10">
          {config.wanInterfaces.map((wan: any) => (
            <div key={wan.id} className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 transition-all hover:border-slate-700">
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                 <div className="flex-1">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Custom Interface Label</label>
                    <input type="text" value={wan.name} onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, name: e.target.value} : w)})} className="bg-transparent border-b border-slate-800 focus:border-blue-500 outline-none text-xl font-bold text-white w-full md:w-64" />
                 </div>
                 <div className="flex items-center gap-3">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${wan.status === WanStatus.UP ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>{wan.status}</span>
                    <span className="text-[10px] bg-slate-900 px-3 py-1.5 rounded border border-slate-800 text-blue-400 font-mono">{wan.interfaceName}</span>
                 </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-sm mb-6">
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800"><div className="text-[9px] text-slate-600 uppercase mb-1">IP</div>{wan.ipAddress}</div>
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800"><div className="text-[9px] text-slate-600 uppercase mb-1">Gateway</div>{wan.gateway}</div>
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 text-emerald-400"><div className="text-[9px] text-slate-600 uppercase mb-1">RX</div>{wan.throughput?.rx.toFixed(1)} M</div>
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 text-blue-400"><div className="text-[9px] text-slate-600 uppercase mb-1">TX</div>{wan.throughput?.tx.toFixed(1)} M</div>
              </div>
              {config.mode === RouterMode.LOAD_BALANCER ? (
                <div className="space-y-2 bg-blue-600/5 p-4 rounded-xl border border-blue-500/10">
                  <div className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Traffic Weight: {wan.weight || 1}</div>
                  <input type="range" min="1" max="100" value={wan.weight || 1} onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, weight: parseInt(e.target.value)} : w)})} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                </div>
              ) : (
                <div className="space-y-2 bg-purple-600/5 p-4 rounded-xl border border-purple-500/10">
                   <label className="text-[10px] text-purple-500 font-black uppercase tracking-widest block mb-2">Priority Index</label>
                   <select value={wan.priority || 1} onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, priority: parseInt(e.target.value)} : w)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-300 outline-none">
                      <option value={1}>PRIMARY INTERFACE</option>
                      <option value={2}>SECONDARY BACKUP</option>
                      <option value={3}>EMERGENCY OVERRIDE</option>
                   </select>
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={onApply} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all">SYNC MULTI-WAN CONFIG TO KERNEL</button>
      </div>
    </div>
  );
};

/**
 * COMPONENT: BRIDGE MANAGER
 */
const BridgeManager = ({ interfaces, bridges, setBridges, onApply }: any) => {
  const [newBridgeName, setNewBridgeName] = useState('br0');
  const addBridge = () => {
    const newBridge: BridgeConfig = { id: Math.random().toString(36).substr(2, 9), name: newBridgeName, interfaces: [], ipAddress: '192.168.10.1', netmask: '24', dhcpEnabled: true, dhcpStart: '192.168.10.100', dhcpEnd: '192.168.10.200', leaseTime: '12h' };
    setBridges([...bridges, newBridge]);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Bridge & DHCP</h1>
          <p className="text-slate-500 text-sm mt-1">Combine physical ports into virtual LANs with integrated DHCP services.</p>
        </div>
        <div className="flex gap-2">
          <input type="text" value={newBridgeName} onChange={e => setNewBridgeName(e.target.value)} className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-white outline-none focus:border-blue-500 text-sm w-32" />
          <button onClick={addBridge} className="bg-blue-600 px-6 py-2 rounded-xl text-xs font-bold text-white shadow-lg">CREATE BRIDGE</button>
        </div>
      </header>

      <div className="space-y-6">
        {bridges.map((bridge: BridgeConfig) => (
          <div key={bridge.id} className="bg-slate-900/60 p-8 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl">
            <div className="flex justify-between items-start mb-8">
              <div>
                 <h3 className="text-xl font-bold text-white">{bridge.name}</h3>
                 <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 font-mono">Kernel Virtual Interface</div>
              </div>
              <button onClick={() => setBridges(bridges.filter((b: any) => b.id !== bridge.id))} className="text-rose-500 font-black text-[10px] uppercase">DELETE</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="space-y-6">
                  <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                     <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Member Interfaces</h4>
                     <div className="flex flex-wrap gap-2">
                        {interfaces.map((iface: any) => (
                          <button key={iface.id} onClick={() => {
                            setBridges(bridges.map((b: any) => {
                              if (b.id !== bridge.id) return b;
                              const isMember = b.interfaces.includes(iface.interfaceName);
                              return { ...b, interfaces: isMember ? b.interfaces.filter((i: string) => i !== iface.interfaceName) : [...b.interfaces, iface.interfaceName] };
                            }));
                          }} className={`px-4 py-2 rounded-xl border text-[10px] font-black transition-all ${bridge.interfaces.includes(iface.interfaceName) ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-500'}`}>
                             {iface.interfaceName.toUpperCase()}
                          </button>
                        ))}
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Static IP</label>
                      <input type="text" value={bridge.ipAddress} onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, ipAddress: e.target.value} : b))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-white outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Netmask (CIDR)</label>
                      <input type="text" value={bridge.netmask} onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, netmask: e.target.value} : b))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-white outline-none focus:border-blue-500" />
                    </div>
                  </div>
               </div>
               <div className={`p-8 rounded-3xl border transition-all ${bridge.dhcpEnabled ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-950/50 border-slate-800'}`}>
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-sm font-bold text-white uppercase">DHCP Orchestrator</h4>
                    <button onClick={() => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, dhcpEnabled: !b.dhcpEnabled} : b))} className={`px-6 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${bridge.dhcpEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                       {bridge.dhcpEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <input type="text" disabled={!bridge.dhcpEnabled} value={bridge.dhcpStart} onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, dhcpStart: e.target.value} : b))} className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-300 disabled:opacity-30" placeholder="Start IP" />
                        <input type="text" disabled={!bridge.dhcpEnabled} value={bridge.dhcpEnd} onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, dhcpEnd: e.target.value} : b))} className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-300 disabled:opacity-30" placeholder="End IP" />
                     </div>
                  </div>
               </div>
            </div>
          </div>
        ))}
        <button onClick={onApply} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all">APPLY BRIDGE TOPOLOGY TO KERNEL</button>
      </div>
    </div>
  );
};

/**
 * COMPONENT: AI ADVISOR
 */
const AIAdvisor = ({ config }: any) => {
  const [advice, setAdvice] = useState('');
  const [loading, setLoading] = useState(false);

  const getAdvice = async () => {
    if (!process.env.API_KEY) { setAdvice('Critical Error: Neural API Key not found in Environment.'); return; }
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-pro-preview', 
        contents: `Analyze this router configuration for an Ubuntu x64 machine. Multi-WAN setup: ${JSON.stringify(config)}. Provide 3 specific performance and security hardening recommendations for the Linux kernel.` 
      });
      setAdvice(response.text || 'Core returned empty response.');
    } catch (e) { setAdvice('Connection to AI Neuralink interrupted. Check API accessibility.'); }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900/60 p-10 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-white tracking-tight">AI Network Advisor</h2>
        <button onClick={getAdvice} disabled={loading} className="bg-blue-600 px-8 py-3 rounded-2xl text-xs font-bold text-white transition-all active:scale-95 shadow-lg shadow-blue-600/20">
          {loading ? 'SYNCHRONIZING...' : 'ANALYZE TOPOLOGY'}
        </button>
      </div>
      <div className="bg-slate-950/80 p-8 rounded-2xl border border-slate-800 font-mono text-sm leading-relaxed text-slate-300 min-h-[300px] whitespace-pre-wrap shadow-inner">
        {advice || 'System ready for topological analysis. Click analyze to link with Gemini...'}
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
  const [metrics, setMetrics] = useState<SystemMetrics>({ cpuUsage: 0, cores: [], memoryUsage: '0', totalMem: '0', temp: '0', uptime: '', activeSessions: 0 });
  const [interfaces, setInterfaces] = useState<WanInterface[]>([]);
  const [bridges, setBridges] = useState<BridgeConfig[]>([]);
  const [wanConfig, setWanConfig] = useState<any>({ mode: RouterMode.LOAD_BALANCER, wanInterfaces: [] });

  const refreshData = useCallback(async () => {
    try {
      const [ifaceRes, metricRes, bridgeRes] = await Promise.all([
        fetch(`${API_BASE}/interfaces`),
        fetch(`${API_BASE}/metrics`),
        fetch(`${API_BASE}/bridges`)
      ]);
      if (ifaceRes.ok && metricRes.ok && bridgeRes.ok) {
        const ifaces = await ifaceRes.json();
        const met = await metricRes.json();
        const sBridges = await bridgeRes.json();
        setInterfaces(ifaces);
        setMetrics(met);
        setBridges(sBridges);
        setWanConfig((prev: any) => ({ ...prev, wanInterfaces: ifaces }));
        setIsLive(true);
      }
    } catch (e) { setIsLive(false); }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 1000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const commitWan = async () => {
    try {
      const res = await fetch(`${API_BASE}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wanConfig) });
      const data = await res.json();
      if (data.success) alert('WAN Sync Successful.');
    } catch(e) { alert('Failed to sync WAN config.'); }
  };

  const commitBridges = async () => {
    try {
      const res = await fetch(`${API_BASE}/bridges/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bridges }) });
      const data = await res.json();
      if (data.success) alert('Bridge Sync Successful.');
      refreshData();
    } catch(e) { alert('Failed to sync Bridges.'); }
  };

  const fixDnsConflict = async () => {
    try {
      const res = await fetch(`${API_BASE}/system/fix-dns-conflict`, { method: 'POST' });
      const data = await res.json();
      alert('DNS Fix Complete:\n' + data.log.join('\n'));
    } catch (e) { alert('DNS Fix Failed.'); }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive}>
      {activeTab === 'dashboard' && <Dashboard interfaces={interfaces} metrics={metrics} />}
      {activeTab === 'wan' && <MultiWanManager config={wanConfig} setConfig={setWanConfig} onApply={commitWan} />}
      {activeTab === 'bridge' && <BridgeManager interfaces={interfaces} bridges={bridges} setBridges={setBridges} onApply={commitBridges} />}
      {activeTab === 'advisor' && <AIAdvisor config={wanConfig} />}
      {activeTab === 'settings' && (
        <div className="space-y-6 animate-in zoom-in-95 duration-500">
           <div className="bg-slate-900/60 p-12 rounded-3xl border border-slate-800 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">System Identity & Diagnostics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-10">
                 <div className="p-6 bg-slate-950/80 rounded-2xl border border-slate-800 text-left">
                    <div className="text-[10px] text-slate-600 font-black uppercase mb-1">Host OS</div>
                    <div className="text-sm text-blue-400 font-mono">Ubuntu x64 Native</div>
                 </div>
                 <div className="p-6 bg-slate-950/80 rounded-2xl border border-slate-800 text-left">
                    <div className="text-[10px] text-slate-600 font-black uppercase mb-1">Architecture</div>
                    <div className="text-sm text-blue-400 font-mono">6.8.0-generic</div>
                 </div>
              </div>
              <div className="bg-rose-500/10 p-8 rounded-3xl border border-rose-500/20 text-left max-w-xl mx-auto space-y-4 shadow-xl shadow-rose-500/5">
                 <h3 className="text-rose-400 font-bold flex items-center gap-2"><span>⚠️</span> DNS Port 53 Conflict Solver</h3>
                 <p className="text-xs text-slate-400 leading-relaxed">
                    If DHCP fails, <code className="text-blue-400 font-bold">systemd-resolved</code> is likely blocking Port 53. Click below to disable it and allow Nexus to take control.
                 </p>
                 <button onClick={fixDnsConflict} className="bg-rose-600 hover:bg-rose-500 text-white px-8 py-3 rounded-xl text-xs font-black shadow-lg shadow-rose-600/20 active:scale-95 transition-all">
                    FIX KERNEL DNS CONFLICT
                 </button>
              </div>
           </div>
        </div>
      )}
    </Layout>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
