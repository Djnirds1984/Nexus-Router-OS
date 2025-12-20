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
  latency: number;
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
        <nav className="flex-1 p-4 space-y-1">
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
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-widest font-black">Kernel Link</div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isLive ? 'Hardware Native' : 'Simulated Env'}
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
 * COMPONENT: DASHBOARD
 */
const Dashboard = ({ interfaces, metrics }: { interfaces: WanInterface[], metrics: SystemMetrics }) => {
  const [selectedIface, setSelectedIface] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [smartMode, setSmartMode] = useState(true);
  const historyLimit = 60;

  // Smart Interface Selection: Auto-switch to the port with active internet usage
  useEffect(() => {
    if (!smartMode) return;
    
    // Find the interface with the highest current throughput (RX + TX)
    const activePorts = interfaces.filter(iface => (iface.throughput.rx + iface.throughput.tx) > 0.05);
    const top = activePorts.sort((a, b) => 
      (b.throughput.rx + b.throughput.tx) - (a.throughput.rx + a.throughput.tx)
    )[0];

    if (top) {
      if (selectedIface !== top.interfaceName) {
        setSelectedIface(top.interfaceName);
        setHistory([]); // Clean slate for the new graph
      }
    } else if (!selectedIface && interfaces.length > 0) {
      // Default to first interface if everything is idle
      setSelectedIface(interfaces[0].interfaceName);
    }
  }, [interfaces, smartMode, selectedIface]);

  // Telemetry Recording
  useEffect(() => {
    if (!selectedIface) return;
    const currentData = interfaces.find(i => i.interfaceName === selectedIface);
    if (!currentData) return;

    setHistory(prev => {
      const newEntry = {
        time: new Date().toLocaleTimeString(),
        rx: currentData.throughput.rx,
        tx: currentData.throughput.tx
      };
      const updated = [...prev, newEntry];
      return updated.length > historyLimit ? updated.slice(updated.length - historyLimit) : updated;
    });
  }, [interfaces, selectedIface]);

  const activeIfaceData = useMemo(() => {
    return interfaces.find(i => i.interfaceName === selectedIface);
  }, [interfaces, selectedIface]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">System Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1 uppercase tracking-wider font-mono">Uptime: {metrics.uptime || '...'}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500 font-black tracking-widest uppercase">System Load</div>
          <div className="text-xl font-mono text-blue-400 font-bold">{metrics.cpuUsage.toFixed(1)}%</div>
        </div>
      </header>

      {/* CORE STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU PER-CORE VISUALIZER */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Compute Cores</h3>
              <div className="text-xs text-slate-400 font-mono">{(metrics.cores || []).length} Cores Active</div>
            </div>
            <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20 font-bold">CPU</div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 flex-1">
            {(metrics.cores || Array(8).fill(0)).map((usage, i) => (
              <div key={i} className="flex flex-col items-center gap-1 group">
                <div className="w-full h-24 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden">
                  <div 
                    className={`absolute bottom-0 left-0 w-full transition-all duration-1000 ease-out shadow-[0_-2px_10px_rgba(59,130,246,0.3)] ${usage > 85 ? 'bg-rose-500' : usage > 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ height: `${Math.max(4, usage)}%` }}
                  />
                  {/* Subtle scanline effect */}
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/5 opacity-20 pointer-events-none" />
                </div>
                <span className="text-[8px] font-mono text-slate-600 group-hover:text-blue-400 transition-colors">C{i}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MEMORY LOAD */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl">
          <div className="flex justify-between items-center mb-6">
             <div>
              <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Memory (RAM)</h3>
              <div className="text-xs text-slate-400 font-mono">ECC DDR4 Runtime</div>
            </div>
            <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 font-bold">MEM</div>
          </div>
          <div className="space-y-6">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-2xl font-mono text-white font-bold">{metrics.memoryUsage}</span>
                  <span className="text-xs text-slate-500 ml-1">GB USED</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono text-slate-400">/ {metrics.totalMem || '16.0'} GB</span>
                </div>
              </div>
              <div className="overflow-hidden h-3 text-xs flex rounded-full bg-slate-950 border border-slate-800 shadow-inner">
                <div 
                  style={{ width: `${(parseFloat(metrics.memoryUsage) / parseFloat(metrics.totalMem || '16')) * 100}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-1000 ease-in-out shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                  <div className="text-[10px] text-slate-600 font-black uppercase mb-1">Swap Space</div>
                  <div className="text-sm font-mono text-slate-300">0.0 GB</div>
               </div>
               <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                  <div className="text-[10px] text-slate-600 font-black uppercase mb-1">Pressure</div>
                  <div className="text-sm font-mono text-emerald-400 font-bold tracking-tighter">OPTIMAL</div>
               </div>
            </div>
          </div>
        </div>

        {/* THERMAL & SESSIONS */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl flex flex-col">
           <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Hardware Health</h3>
                <div className="text-xs text-slate-400 font-mono">Thermal Zone 0</div>
              </div>
              <div className="w-10 h-10 bg-amber-600/10 rounded-xl flex items-center justify-center text-amber-400 border border-amber-500/20 font-bold">TEMP</div>
           </div>
           <div className="flex-1 space-y-6">
              <div className="text-center py-4 bg-slate-950/30 rounded-2xl border border-slate-800/50 relative overflow-hidden group">
                 <div className="text-4xl font-mono text-amber-500 font-bold mb-1">{metrics.temp || "N/A"}</div>
                 <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Core Temp</div>
                 {/* Heat Glow Effect */}
                 <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-600 font-black uppercase mb-1">Active IP Flows</div>
                    <div className="text-lg font-mono text-white font-bold">{metrics.activeSessions}</div>
                 </div>
                 <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-600 font-black uppercase mb-1">Architecture</div>
                    <div className="text-sm font-mono text-blue-400 font-black">x86_64</div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* LIVE TRAFFIC SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/60 p-8 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 relative z-10">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-1.5 h-4 bg-emerald-500 rounded-sm shadow-[0_0_8px_#10b981]" /> Live Usage Telemetry
              </h2>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                Currently Monitoring: <span className="text-blue-400">{selectedIface.toUpperCase()}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSmartMode(!smartMode)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border ${smartMode ? 'bg-blue-600 text-white border-blue-400 shadow-lg' : 'bg-slate-950 text-slate-500 border-slate-800'}`}
                title="Automatically switches to the port with active traffic"
              >
                 {smartMode ? 'Smart Focus: ON' : 'Smart Focus: OFF'}
              </button>
              
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-2xl shadow-inner">
                 <select 
                   value={selectedIface}
                   onChange={(e) => {
                     setSelectedIface(e.target.value);
                     setSmartMode(false); // Disable smart mode if user manually overrides
                     setHistory([]); 
                   }}
                   className="bg-slate-900 text-blue-400 border border-slate-800 rounded-xl px-4 py-2 text-xs font-bold font-mono outline-none focus:border-blue-500 transition-all cursor-pointer"
                 >
                   {interfaces.map(iface => (
                     <option key={iface.interfaceName} value={iface.interfaceName}>{iface.interfaceName.toUpperCase()}</option>
                   ))}
                 </select>
              </div>
            </div>
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#475569" fontSize={10} tickFormatter={(val) => `${val}M`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '11px' }} 
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }} />
                <Area name="Internet Usage (Down)" type="monotone" dataKey="rx" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRx)" isAnimationActive={false} />
                <Area name="Internet Usage (Up)" type="monotone" dataKey="tx" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTx)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 pt-6 border-t border-slate-800">
             <div className="text-center group">
                <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-1 group-hover:text-emerald-500 transition-colors">Instant Download</div>
                <div className="text-2xl font-mono text-emerald-400 font-bold">{activeIfaceData?.throughput.rx.toFixed(2) || '0.00'} <span className="text-[10px] text-slate-500">Mbps</span></div>
             </div>
             <div className="text-center group">
                <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">Instant Upload</div>
                <div className="text-2xl font-mono text-blue-400 font-bold">{activeIfaceData?.throughput.tx.toFixed(2) || '0.00'} <span className="text-[10px] text-slate-500">Mbps</span></div>
             </div>
          </div>
        </div>

        {/* ACTIVE LINKS LIST */}
        <div className="bg-slate-900/60 p-0 rounded-3xl border border-slate-800 backdrop-blur-md overflow-hidden flex flex-col shadow-xl">
           <div className="p-6 border-b border-slate-800 bg-slate-800/10">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Port Activity Map</h2>
              <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tight">Real-time Bitrate Monitoring</div>
           </div>
           <div className="flex-1 overflow-y-auto divide-y divide-slate-800 scrollbar-hide">
              {[...interfaces].sort((a,b) => (b.throughput.rx + b.throughput.tx) - (a.throughput.rx + a.throughput.tx)).map((wan) => {
                const isFocused = selectedIface === wan.interfaceName;
                const totalUsage = wan.throughput.rx + wan.throughput.tx;
                const isWorking = totalUsage > 0.1;
                
                return (
                  <div 
                    key={wan.id} 
                    onClick={() => { setSelectedIface(wan.interfaceName); setSmartMode(false); }}
                    className={`p-6 flex items-center justify-between cursor-pointer transition-all hover:bg-slate-800/30 group ${isFocused ? 'bg-blue-600/5' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                       <div className="relative">
                          <div className={`w-3 h-3 rounded-full ${wan.status === WanStatus.UP ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`} />
                          {isWorking && <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-75" />}
                       </div>
                       <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            {wan.interfaceName.toUpperCase()}
                            {isFocused && <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></span>}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono tracking-tighter">{wan.ipAddress}</div>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className={`text-sm font-mono font-bold ${isWorking ? 'text-emerald-400' : 'text-slate-700'}`}>
                          {isWorking ? `${totalUsage.toFixed(1)} Mbps` : 'STANDBY'}
                       </div>
                       <div className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Usage Rate</div>
                    </div>
                  </div>
                )
              })}
           </div>
           <div className="p-4 bg-slate-950/80 text-center border-t border-slate-800">
              <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Hardware Link: Persistent</div>
           </div>
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENT: BRIDGE & DHCP MANAGER (Unchanged unless necessary)
 */
const BridgeManager = ({ allInterfaces, bridges, setBridges, onApply, activeWanNames }: any) => {
  const [newBridgeName, setNewBridgeName] = useState('br0');
  const availableForBridge = useMemo(() => allInterfaces.filter((iface: any) => !activeWanNames.includes(iface.interfaceName)), [allInterfaces, activeWanNames]);

  const addBridge = () => {
    const newBridge: BridgeConfig = {
      id: Math.random().toString(36).substr(2, 9),
      name: newBridgeName,
      interfaces: [],
      ipAddress: '192.168.10.1',
      netmask: '24',
      dhcpEnabled: true,
      dhcpStart: '192.168.10.50',
      dhcpEnd: '192.168.10.150',
      leaseTime: '12h'
    };
    setBridges([...bridges, newBridge]);
  };

  const toggleIface = (bridgeId: string, ifaceName: string) => {
    setBridges(bridges.map((b: any) => {
      if (b.id !== bridgeId) return b;
      const isMember = b.interfaces.includes(ifaceName);
      return { ...b, interfaces: isMember ? b.interfaces.filter((i: string) => i !== ifaceName) : [...b.interfaces, ifaceName] };
    }));
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Bridge & DHCP</h1>
          <p className="text-slate-500 text-sm mt-1">Combine physical ports into virtual LANs with integrated DHCP services.</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={newBridgeName} 
            onChange={e => setNewBridgeName(e.target.value)}
            className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-white outline-none focus:border-blue-500 transition-all text-sm w-32"
          />
          <button onClick={addBridge} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95">
            CREATE BRIDGE
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {bridges.map((bridge: BridgeConfig) => (
          <div key={bridge.id} className="bg-slate-900/60 p-8 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl">
             <div className="flex justify-between items-start mb-8">
                <div>
                   <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]"></span>
                      {bridge.name}
                   </h3>
                   <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">VIRTUAL KERNEL INTERFACE</div>
                </div>
                <button onClick={() => setBridges(bridges.filter((b: any) => b.id !== bridge.id))} className="text-rose-500 hover:text-rose-400 text-[10px] font-black uppercase tracking-widest bg-rose-500/5 px-3 py-1 rounded-lg border border-rose-500/10">DELETE</button>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Member Interfaces</h4>
                      <div className="flex flex-wrap gap-2">
                         {availableForBridge.map((iface: any) => (
                           <button 
                             key={iface.id}
                             onClick={() => toggleIface(bridge.id, iface.interfaceName)}
                             className={`px-4 py-2 rounded-xl border text-[10px] font-black transition-all ${
                               bridge.interfaces.includes(iface.interfaceName)
                               ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                               : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                             }`}
                           >
                              {iface.interfaceName.toUpperCase()}
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Bridge IP</label>
                        <input 
                          type="text" 
                          value={bridge.ipAddress}
                          onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, ipAddress: e.target.value} : b))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-white outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Netmask (CIDR)</label>
                        <input 
                          type="text" 
                          value={bridge.netmask}
                          onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, netmask: e.target.value} : b))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-white outline-none focus:border-blue-500"
                        />
                      </div>
                   </div>
                </div>

                <div className={`p-8 rounded-3xl border transition-all ${bridge.dhcpEnabled ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'bg-slate-950/50 border-slate-800'}`}>
                   <div className="flex justify-between items-center mb-6">
                      <h4 className="text-sm font-bold text-white uppercase tracking-tight">DHCP Server</h4>
                      <button 
                        onClick={() => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, dhcpEnabled: !b.dhcpEnabled} : b))}
                        className={`px-6 py-1.5 rounded-full text-[10px] font-black uppercase transition-all border ${bridge.dhcpEnabled ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                      >
                         {bridge.dhcpEnabled ? 'ENABLED' : 'DISABLED'}
                      </button>
                   </div>
                   <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Start IP</label>
                           <input type="text" disabled={!bridge.dhcpEnabled} value={bridge.dhcpStart} className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-300 outline-none focus:border-emerald-500 disabled:opacity-30" />
                        </div>
                        <div>
                           <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">End IP</label>
                           <input type="text" disabled={!bridge.dhcpEnabled} value={bridge.dhcpEnd} className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-300 outline-none focus:border-emerald-500 disabled:opacity-30" />
                        </div>
                      </div>
                      <div>
                         <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Lease Expiration</label>
                         <input type="text" disabled={!bridge.dhcpEnabled} value={bridge.leaseTime} className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-300 outline-none focus:border-emerald-500 disabled:opacity-30" />
                      </div>
                   </div>
                </div>
             </div>
          </div>
        ))}

        <button onClick={onApply} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all uppercase tracking-widest mt-6">APPLY & SAVE CONFIG TO KERNEL</button>
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
    if (!process.env.API_KEY) { setAdvice('API Key missing.'); return; }
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Analyze this Ubuntu router configuration: ${JSON.stringify(config)}. Provide performance optimization tips.` });
      setAdvice(response.text || 'No data.');
    } catch (e) { setAdvice('Connection interrupted.'); }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900/60 p-10 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-white">Nexus AI Advisor</h2>
        <button onClick={getAdvice} disabled={loading} className="bg-blue-600 px-8 py-3 rounded-2xl text-xs font-bold text-white transition-all active:scale-95 shadow-lg shadow-blue-600/20">
          {loading ? 'THINKING...' : 'ANALYZE TOPOLOGY'}
        </button>
      </div>
      <div className="bg-slate-950/80 p-8 rounded-2xl border border-slate-800 font-mono text-sm leading-relaxed text-slate-300 min-h-[300px] whitespace-pre-wrap">
        {advice || 'Ready for analysis...'}
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
  const [config, setConfig] = useState<any>({ mode: RouterMode.LOAD_BALANCER, wanInterfaces: [] });
  const [bridges, setBridges] = useState<BridgeConfig[]>([]);

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
        setIsLive(true);
        setMetrics(met);
        setBridges(sBridges);
        setConfig((prev: any) => {
          const merged = ifaces.map((iface: any) => {
            const existing = prev.wanInterfaces.find((w: any) => w.id === iface.id);
            return existing ? { ...iface, name: existing.name, weight: existing.weight, priority: existing.priority } : iface;
          });
          return { ...prev, wanInterfaces: merged };
        });
      }
    } catch (e) { setIsLive(false); }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 2000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const commitConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
      const data = await res.json();
      if (data.success) alert('Sync Success');
    } catch(e) { alert('Sync Failed.'); }
  };

  const commitBridges = async () => {
    try {
      const res = await fetch(`${API_BASE}/bridges/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bridges }) });
      const data = await res.json();
      if (data.success) alert('Bridge Sync Success');
      refreshData();
    } catch(e) { alert('Bridge Sync Failed.'); }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive}>
      {activeTab === 'dashboard' && <Dashboard interfaces={config.wanInterfaces} metrics={metrics} />}
      {activeTab === 'wan' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="bg-slate-900/60 p-10 rounded-3xl border border-slate-800 backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Multi-WAN Orchestration</h2>
              <div className="flex gap-4 mb-10">
                 <button onClick={() => setConfig({...config, mode: RouterMode.LOAD_BALANCER})} className={`flex-1 p-6 rounded-2xl border transition-all text-left ${config.mode === RouterMode.LOAD_BALANCER ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/10' : 'bg-slate-950/50 border-slate-800 text-slate-500'}`}>
                    <div className="font-bold">Load Balancer (Active-Active)</div>
                    <div className="text-[11px] mt-1 opacity-60 font-mono">Parallel IP multiplexing for maximum speed.</div>
                 </button>
                 <button onClick={() => setConfig({...config, mode: RouterMode.FAILOVER})} className={`flex-1 p-6 rounded-2xl border transition-all text-left ${config.mode === RouterMode.FAILOVER ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/10' : 'bg-slate-950/50 border-slate-800 text-slate-500'}`}>
                    <div className="font-bold">Auto Failover (High Availability)</div>
                    <div className="text-[11px] mt-1 opacity-60 font-mono">Priority routing with automatic outage recovery.</div>
                 </button>
              </div>
              <div className="grid grid-cols-1 gap-6 mb-10">
                {config.wanInterfaces.map((wan: any) => (
                  <div key={wan.id} className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 shadow-inner group transition-all hover:border-slate-600">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                       <div className="flex-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Custom Identity</label>
                          <input type="text" value={wan.name} onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, name: e.target.value} : w)})} className="bg-transparent border-b border-slate-800 focus:border-blue-500 outline-none text-xl font-bold text-white w-full md:w-64 pb-1" />
                       </div>
                       <div className="flex items-center gap-3">
                         <div className={`px-4 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase flex items-center gap-2 ${wan.status === WanStatus.UP ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${wan.status === WanStatus.UP ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></div>
                            {wan.status}
                         </div>
                         <span className="text-[10px] bg-slate-900 px-3 py-1.5 rounded border border-slate-800 text-blue-400 font-mono font-black">{wan.interfaceName}</span>
                       </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 font-mono">
                       <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-600 font-black uppercase mb-1">Global IP</div>
                          <div className="text-sm text-slate-300">{wan.ipAddress}</div>
                       </div>
                       <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-600 font-black uppercase mb-1">Gateway</div>
                          <div className="text-sm text-slate-300">{wan.gateway}</div>
                       </div>
                       <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-600 font-black uppercase mb-1 text-emerald-500">RX usage</div>
                          <div className="text-sm text-emerald-400 font-bold">{wan.throughput?.rx.toFixed(1)} Mbps</div>
                       </div>
                       <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-600 font-black uppercase mb-1 text-blue-500">TX usage</div>
                          <div className="text-sm text-blue-400 font-bold">{wan.throughput?.tx.toFixed(1)} Mbps</div>
                       </div>
                    </div>
                    {config.mode === RouterMode.LOAD_BALANCER ? (
                      <div className="space-y-3 bg-blue-600/5 p-4 rounded-xl border border-blue-500/10">
                        <div className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Weight: <span className="text-white ml-2">{wan.weight || 1}</span></div>
                        <input type="range" min="1" max="100" value={wan.weight || 1} onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, weight: parseInt(e.target.value)} : w)})} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                      </div>
                    ) : (
                      <div className="space-y-2 bg-purple-600/5 p-4 rounded-xl border border-purple-500/10">
                        <label className="text-[10px] text-purple-500 font-black uppercase tracking-widest block mb-2">Priority Index</label>
                        <select value={wan.priority || 1} onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, priority: parseInt(e.target.value)} : w)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-300 outline-none focus:border-purple-500">
                           <option value={1}>01 - PRIMARY</option>
                           <option value={2}>02 - SECONDARY</option>
                           <option value={3}>03 - EMERGENCY</option>
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={commitConfig} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] uppercase tracking-widest">APPLY & SAVE WAN CONFIG</button>
           </div>
        </div>
      )}
      {activeTab === 'bridge' && <BridgeManager allInterfaces={config.wanInterfaces} bridges={bridges} setBridges={setBridges} onApply={commitBridges} activeWanNames={config.wanInterfaces.filter((w: any) => w.gateway && w.gateway !== 'None').map((w: any) => w.interfaceName)} />}
      {activeTab === 'advisor' && <AIAdvisor config={config} />}
      {activeTab === 'settings' && (
        <div className="bg-slate-900/60 p-12 rounded-3xl border border-slate-800 text-center animate-in zoom-in-95 duration-500">
           <h2 className="text-2xl font-bold text-white mb-6">Diagnostic Tools</h2>
           <div className="bg-slate-950/80 p-8 rounded-2xl border border-rose-500/20 text-left max-w-xl mx-auto space-y-4 shadow-xl">
              <h3 className="text-rose-400 font-bold flex items-center gap-2"><span>⚠️</span> DNS Port Conflict Tool</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Disable systemd-resolved on port 53 to allow Nexus DHCP services to bind.</p>
              <button onClick={async () => { try { await fetch(`${API_BASE}/system/fix-dns-conflict`, { method: 'POST' }); alert('Resolved.'); } catch(e) {} }} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl text-xs font-black shadow-lg shadow-rose-600/20 active:scale-95 transition-all">FIX PORT 53 CONFLICT</button>
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
