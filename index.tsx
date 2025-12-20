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

  // Smart Interface Selection: Auto-switch to active ports
  useEffect(() => {
    if (!smartMode) return;
    
    // Find the interface with significant traffic
    const activePorts = interfaces.filter(iface => (iface.throughput.rx + iface.throughput.tx) > 0.1);
    const top = activePorts.sort((a, b) => 
      (b.throughput.rx + b.throughput.tx) - (a.throughput.rx + a.throughput.tx)
    )[0];

    if (top && selectedIface !== top.interfaceName) {
      setSelectedIface(top.interfaceName);
      setHistory([]); 
    } else if (!selectedIface && interfaces.length > 0) {
      setSelectedIface(interfaces[0].interfaceName);
    }
  }, [interfaces, smartMode, selectedIface]);

  // Record history
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
          <h1 className="text-3xl font-bold text-white tracking-tight">Real-time Telemetry</h1>
          <p className="text-slate-500 text-sm mt-1 uppercase tracking-wider font-mono">Uptime: {metrics.uptime || 'Reading Hardware...'}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500 font-black tracking-widest uppercase">System Aggregate</div>
          <div className="text-2xl font-mono text-blue-400 font-bold">{metrics.cpuUsage.toFixed(1)}%</div>
        </div>
      </header>

      {/* CORE STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU PER-CORE GRID */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl flex flex-col min-h-[220px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Compute Core Grid</h3>
              <div className="text-xs text-slate-400 font-mono">Hardware Multi-core View</div>
            </div>
            <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20 font-bold">CPU</div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 flex-1 items-end">
            {(metrics.cores || Array(8).fill(0)).map((usage, i) => (
              <div key={i} className="flex flex-col items-center gap-1 group">
                <div className="w-full h-24 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden">
                  <div 
                    className={`absolute bottom-0 left-0 w-full transition-all duration-1000 ease-out shadow-[0_-2px_10px_rgba(59,130,246,0.3)] ${usage > 85 ? 'bg-rose-500' : usage > 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ height: `${Math.max(4, usage)}%` }}
                  />
                </div>
                <span className="text-[8px] font-mono text-slate-600">C{i}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MEMORY LOAD */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl min-h-[220px]">
          <div className="flex justify-between items-center mb-6">
             <div>
              <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Memory Matrix</h3>
              <div className="text-xs text-slate-400 font-mono">Total Physical RAM</div>
            </div>
            <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 font-bold">RAM</div>
          </div>
          <div className="space-y-6">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-3xl font-mono text-white font-bold">{metrics.memoryUsage}</span>
                  <span className="text-xs text-slate-500 ml-1">GB USED</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono text-slate-400">/ {metrics.totalMem || '16.0'} GB</span>
                </div>
              </div>
              <div className="overflow-hidden h-4 text-xs flex rounded-full bg-slate-950 border border-slate-800 shadow-inner">
                <div 
                  style={{ width: `${(parseFloat(metrics.memoryUsage) / parseFloat(metrics.totalMem || '16')) * 100}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-1000 ease-in-out shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                />
              </div>
            </div>
            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex justify-between items-center">
               <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Hardware Status</span>
               <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Running Native</span>
            </div>
          </div>
        </div>

        {/* THERMAL & HEALTH */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl flex flex-col min-h-[220px]">
           <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Health & Heat</h3>
                <div className="text-xs text-slate-400 font-mono">Environment Sensors</div>
              </div>
              <div className="w-10 h-10 bg-amber-600/10 rounded-xl flex items-center justify-center text-amber-400 border border-amber-500/20 font-bold">PHY</div>
           </div>
           <div className="flex-1 space-y-6 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                 <div className="text-center">
                    <div className="text-4xl font-mono text-amber-500 font-bold">{metrics.temp || "N/A"}</div>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Core Temp</div>
                 </div>
                 <div className="text-center">
                    <div className="text-4xl font-mono text-blue-400 font-bold">{metrics.activeSessions}</div>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Active Flows</div>
                 </div>
              </div>
              <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-center font-mono text-[10px] text-slate-500 uppercase tracking-widest font-black">
                 Host Identity: Ubuntu x86_64
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/60 p-8 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 relative z-10">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-1.5 h-4 bg-emerald-500 rounded-sm shadow-[0_0_8px_#10b981]" /> Live Usage Telemetry
              </h2>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                Displaying: <span className="text-blue-400 font-mono">{selectedIface.toUpperCase()}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSmartMode(!smartMode)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border ${smartMode ? 'bg-blue-600 text-white border-blue-400 shadow-lg' : 'bg-slate-950 text-slate-500 border-slate-800'}`}
              >
                 {smartMode ? 'Smart Focus: On' : 'Manual Lock'}
              </button>
              
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-2xl shadow-inner">
                 <select 
                   value={selectedIface}
                   onChange={(e) => {
                     setSelectedIface(e.target.value);
                     setSmartMode(false);
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
                <Area name="Download Rate (Mbps)" type="monotone" dataKey="rx" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRx)" isAnimationActive={false} />
                <Area name="Upload Rate (Mbps)" type="monotone" dataKey="tx" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTx)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 pt-6 border-t border-slate-800">
             <div className="text-center group">
                <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-1 group-hover:text-emerald-500 transition-colors">Bitrate (RX)</div>
                <div className="text-3xl font-mono text-emerald-400 font-bold">{activeIfaceData?.throughput.rx.toFixed(2) || '0.00'} <span className="text-[10px] text-slate-500 uppercase tracking-tighter">Mbps</span></div>
             </div>
             <div className="text-center group">
                <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">Bitrate (TX)</div>
                <div className="text-3xl font-mono text-blue-400 font-bold">{activeIfaceData?.throughput.tx.toFixed(2) || '0.00'} <span className="text-[10px] text-slate-500 uppercase tracking-tighter">Mbps</span></div>
             </div>
          </div>
        </div>

        {/* ACTIVE PORT LIST */}
        <div className="bg-slate-900/60 p-0 rounded-3xl border border-slate-800 backdrop-blur-md overflow-hidden flex flex-col shadow-xl">
           <div className="p-6 border-b border-slate-800 bg-slate-800/10 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">Hardware Interface Map</h2>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Immediate I/O Polling</div>
              </div>
              <div className="px-2 py-1 bg-slate-950 rounded text-[9px] font-mono text-emerald-500 border border-emerald-500/20 shadow-inner">SYNC:OK</div>
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
                          <div className="text-sm font-bold text-white uppercase font-mono">{wan.interfaceName}</div>
                          <div className="text-[10px] text-slate-500 font-mono tracking-tighter">{wan.ipAddress}</div>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className={`text-sm font-mono font-bold ${isWorking ? 'text-emerald-400' : 'text-slate-700'}`}>
                          {isWorking ? `${totalUsage.toFixed(1)} Mbps` : 'IDLE'}
                       </div>
                    </div>
                  </div>
                )
              })}
           </div>
           <div className="p-4 bg-slate-950/80 text-center border-t border-slate-800">
              <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Hardware Agent: Online</div>
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
  const [metrics, setMetrics] = useState<SystemMetrics>({ cpuUsage: 0, cores: [], memoryUsage: '0', totalMem: '0', temp: '0', uptime: '', activeSessions: 0 });
  const [interfaces, setInterfaces] = useState<WanInterface[]>([]);
  const [bridges, setBridges] = useState([]);

  const refreshData = useCallback(async () => {
    try {
      const [ifaceRes, metricRes, bridgeRes] = await Promise.all([
        fetch(`${API_BASE}/interfaces`),
        fetch(`${API_BASE}/metrics`),
        fetch(`${API_BASE}/bridges`)
      ]);
      if (ifaceRes.ok && metricRes.ok && bridgeRes.ok) {
        setInterfaces(await ifaceRes.json());
        setMetrics(await metricRes.json());
        setBridges(await bridgeRes.json());
        setIsLive(true);
      }
    } catch (e) { setIsLive(false); }
  }, []);

  useEffect(() => {
    refreshData();
    // 1-second polling for smooth animation
    const interval = setInterval(refreshData, 1000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive}>
      {activeTab === 'dashboard' && <Dashboard interfaces={interfaces} metrics={metrics} />}
      {activeTab === 'wan' && (
        <div className="bg-slate-900/60 p-10 rounded-3xl border border-slate-800 backdrop-blur-md">
           <h2 className="text-2xl font-bold text-white mb-6">Multi-WAN Orchestration</h2>
           <p className="text-slate-400 italic">Configuration module is active. Real-time kernel synchronization enabled.</p>
        </div>
      )}
      {activeTab === 'bridge' && (
        <div className="bg-slate-900/60 p-10 rounded-3xl border border-slate-800 backdrop-blur-md">
           <h2 className="text-2xl font-bold text-white mb-6">Bridge & DHCP</h2>
           <p className="text-slate-400 italic">Virtual LAN bridging system. Probing local interfaces...</p>
        </div>
      )}
      {activeTab === 'advisor' && (
        <div className="bg-slate-900/60 p-10 rounded-3xl border border-slate-800 backdrop-blur-md">
           <h2 className="text-2xl font-bold text-white mb-6 tracking-tight text-center">AI Network Advisor</h2>
           <div className="text-center text-slate-500 py-20 font-mono text-sm">Querying Gemini Neuralink...</div>
        </div>
      )}
      {activeTab === 'settings' && (
        <div className="bg-slate-900/60 p-12 rounded-3xl border border-slate-800 text-center">
           <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">System Identity</h2>
           <div className="bg-blue-500/10 p-6 rounded-2xl border border-blue-500/20 text-blue-400 font-bold uppercase text-[10px] tracking-widest">
              Nexus OS v1.3.0 • Hardware Native Link Active
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
