import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: string; 
  totalMem: string; 
  temp: string;
  uptime: string;
  activeSessions: number;
  dnsResolved: boolean;
  ipForwarding: boolean;
}

interface NetworkConfig {
  mode: RouterMode;
  wanInterfaces: WanInterface[];
}

/**
 * API DISCOVERY
 */
const getApiBase = () => {
  const host = window.location.hostname || 'localhost';
  return `http://${host}:3000/api`;
};

const API_BASE = getApiBase();

/**
 * COMPONENT: INTERFACE MANAGER (MULTI-WAN)
 */
const InterfaceManager = ({ interfaces, config, setConfig, onApply, isApplying }: any) => {
  const isDirty = useMemo(() => {
    // Basic check for config changes
    return true; 
  }, [config]);

  const updateInterface = (id: string, updates: Partial<WanInterface>) => {
    setConfig((prev: NetworkConfig) => ({
      ...prev,
      wanInterfaces: prev.wanInterfaces.map(w => w.id === id ? { ...w, ...updates } : w)
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Multi-WAN Orchestrator</h1>
          <p className="text-slate-400 mt-1 font-medium">Smart Load-Balancing & Automated Failover Fabric</p>
        </div>
        <button 
          onClick={onApply}
          disabled={isApplying}
          className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-10 rounded-2xl shadow-xl shadow-blue-600/20 disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest text-xs"
        >
          {isApplying ? 'SYNCING KERNEL...' : 'COMMIT TO KERNEL'}
        </button>
      </header>

      {/* Mode Selector */}
      <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8 backdrop-blur-md">
        <div className="flex-1">
          <h2 className="text-2xl font-black text-white tracking-tight mb-2 uppercase italic">Routing Engine Mode</h2>
          <p className="text-slate-500 text-sm max-w-xl leading-relaxed">
            {config.mode === RouterMode.LOAD_BALANCER 
              ? "ECMP (Equal-Cost Multi-Path) enabled. Traffic is distributed across all healthy links based on weight." 
              : "Active/Passive failover. Traffic stays on the highest priority link unless a timeout is detected."}
          </p>
        </div>
        <div className="flex bg-black/40 p-2 rounded-2xl border border-slate-800 shadow-inner shrink-0">
          <button 
            onClick={() => setConfig({ ...config, mode: RouterMode.LOAD_BALANCER })}
            className={`px-8 py-4 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${config.mode === RouterMode.LOAD_BALANCER ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-600 hover:text-slate-300'}`}
          >
            Load Balance
          </button>
          <button 
            onClick={() => setConfig({ ...config, mode: RouterMode.FAILOVER })}
            className={`px-8 py-4 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${config.mode === RouterMode.FAILOVER ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-600 hover:text-slate-300'}`}
          >
            Failover
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {config.wanInterfaces.map((wan: WanInterface) => (
          <div key={wan.id} className={`p-8 rounded-[2.5rem] border transition-all relative overflow-hidden backdrop-blur-md ${wan.internetHealth === 'HEALTHY' ? 'bg-slate-900/40 border-slate-800 hover:border-blue-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-black text-white tracking-tight uppercase italic">{wan.interfaceName.toUpperCase()}</h3>
                  <code className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-1 rounded font-mono border border-blue-500/10 font-bold">{wan.ipAddress}</code>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${wan.internetHealth === 'HEALTHY' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500 animate-pulse'}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${wan.internetHealth === 'HEALTHY' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {wan.internetHealth === 'HEALTHY' ? 'INTERNET LINKED' : 'REQUEST TIMEOUT'}
                  </span>
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
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Load Weight</label>
                    <span className="text-3xl font-mono text-blue-400 font-black tracking-tighter">{wan.weight}%</span>
                  </div>
                  <input 
                    type="range" min="1" max="100" 
                    value={wan.weight} 
                    onChange={(e) => updateInterface(wan.id, { weight: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </>
              ) : (
                <>
                  <label className="text-[10px] font-black text-slate-500 uppercase block tracking-widest mb-2">Failover Priority</label>
                  <select 
                    value={wan.priority}
                    onChange={(e) => updateInterface(wan.id, { priority: parseInt(e.target.value) })}
                    className="w-full bg-black/40 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-bold text-slate-300 outline-none"
                  >
                    <option value={1}>1 - Primary Link</option>
                    <option value={2}>2 - Secondary Backup</option>
                    <option value={3}>3 - Tertiary Backup</option>
                  </select>
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
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
      <aside className="w-64 bg-[#0B0F1A] border-r border-slate-800 flex flex-col shadow-2xl z-20">
        <div className="p-8 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-xl shadow-blue-500/20 text-xl italic">N</div>
          <span className="font-bold text-2xl tracking-tighter text-white uppercase italic">Nexus</span>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto custom-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 ${
                activeTab === tab.id 
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5' 
                : 'hover:bg-slate-800/50 text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="font-bold text-sm tracking-tight">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-6 mt-auto">
          <div className={`p-5 rounded-2xl border transition-all duration-500 ${isLive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.15)]'}`}>
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-[0.2em] font-black">Hardware Link</div>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-rose-500 animate-pulse shadow-[0_0_12px_#f43f5e]'}`} />
              <span className={`text-xs font-black uppercase tracking-tighter ${isLive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isLive ? 'Kernel Active' : 'Agent Lost'}
              </span>
            </div>
            {!isLive && <div className="mt-2 text-[9px] text-rose-500 font-medium leading-tight">Probing local:3000...</div>}
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto relative bg-[#020617] scroll-smooth">
        <div className="absolute top-0 right-0 w-2/3 h-2/3 bg-blue-600/5 blur-[160px] rounded-full -z-10 pointer-events-none" />
        <div className="max-w-7xl mx-auto p-12">{children}</div>
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
  
  useEffect(() => {
    if (!selectedIface && interfaces.length > 0) setSelectedIface(interfaces[0].interfaceName);
  }, [interfaces]);

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
          <h1 className="text-4xl font-black text-white tracking-tighter">Router Dashboard</h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-500 text-sm font-medium">Ubuntu x64 Server • Nexus Runtime Engine</p>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all duration-500 ${metrics.dnsResolved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'}`}>
              {metrics.dnsResolved ? 'Internet: Linked' : 'Internet: Failed'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-600 font-black tracking-widest uppercase mb-1">Host Uptime</div>
          <div className="text-2xl font-mono text-white font-bold tracking-tighter">{metrics.uptime || '--:--:--'}</div>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Downlink Total</h3>
          <div className="text-4xl font-mono text-emerald-400 font-bold tracking-tighter">{aggregateTraffic.rx.toFixed(2)} <span className="text-sm font-sans font-medium text-slate-500 uppercase tracking-widest">Mbps</span></div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Uplink Total</h3>
          <div className="text-4xl font-mono text-blue-400 font-bold tracking-tighter">{aggregateTraffic.tx.toFixed(2)} <span className="text-sm font-sans font-medium text-slate-500 uppercase tracking-widest">Mbps</span></div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">CPU Core Load</h3>
          <div className="text-4xl font-mono text-white font-bold">{metrics.cpuUsage.toFixed(1)}%</div>
          <div className="mt-4 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
             <div className="h-full bg-blue-500 transition-all duration-1000 shadow-[0_0_10px_#3b82f6]" style={{ width: `${metrics.cpuUsage}%` }} />
          </div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Physical RAM</h3>
          <div className="text-4xl font-mono text-white font-bold tracking-tighter">{metrics.memoryUsage} <span className="text-sm font-sans font-medium text-slate-500 uppercase">GB</span></div>
          <div className="text-[10px] text-slate-600 font-black uppercase mt-1 tracking-widest">Available {metrics.totalMem}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#0B0F1A] p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <span className="w-2 h-6 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              Interface Telemetry: <span className="text-emerald-400 font-mono tracking-tighter">{selectedIface.toUpperCase()}</span>
            </h2>
            <select 
              value={selectedIface}
              onChange={(e) => setSelectedIface(e.target.value)}
              className="bg-slate-950 text-blue-400 border border-slate-800 rounded-2xl px-6 py-2.5 text-xs font-bold outline-none font-mono focus:border-blue-500 cursor-pointer"
            >
              {interfaces.length > 0 ? interfaces.map(iface => (
                <option key={iface.interfaceName} value={iface.interfaceName}>{iface.interfaceName.toUpperCase()}</option>
              )) : <option>Scanning...</option>}
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
              <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-blue-400 font-mono border border-blue-500/20 uppercase">BBR Native</span>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {interfaces.map(iface => (
                <div 
                  key={iface.id} 
                  onClick={() => setSelectedIface(iface.interfaceName)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between ${selectedIface === iface.interfaceName ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'}`}
                >
                   <div className="flex items-center gap-4">
                      <div className={`w-2.5 h-2.5 rounded-full ${iface.status === WanStatus.UP ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 animate-pulse'}`} />
                      <div>
                        <div className="text-sm font-bold text-white font-mono uppercase tracking-tighter">{iface.interfaceName}</div>
                        <div className="text-[10px] text-slate-500 font-mono tracking-tight">{iface.ipAddress}</div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-[10px] text-emerald-400 font-mono font-bold">{(iface.throughput.rx + iface.throughput.tx).toFixed(1)} Mbps</div>
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
  const [config, setConfig] = useState<NetworkConfig>({ mode: RouterMode.LOAD_BALANCER, wanInterfaces: [] });
  const [isApplying, setIsApplying] = useState(false);

  const refreshData = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const [ifaceRes, metricRes] = await Promise.all([
        fetch(`${API_BASE}/interfaces`, { signal: controller.signal }),
        fetch(`${API_BASE}/metrics`, { signal: controller.signal })
      ]);
      clearTimeout(timeoutId);

      if (ifaceRes.ok && metricRes.ok) {
        const ifaces = await ifaceRes.json();
        const met = await metricRes.json();
        setInterfaces(ifaces);
        setMetrics(met);
        
        // Sync config state with hardware state if empty
        if (config.wanInterfaces.length === 0 && ifaces.length > 0) {
          setConfig(prev => ({ ...prev, wanInterfaces: ifaces }));
        }
        
        setIsLive(true);
      } else {
        setIsLive(false);
      }
    } catch (e) { 
      setIsLive(false); 
    }
  }, [config]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 2000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleApplyConfig = async () => {
    setIsApplying(true);
    try {
      const res = await fetch(`${API_BASE}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) alert("KERNEL SYNC: Routing tables updated successfully.");
      else alert("SYNC FAILED: Permission error or invalid route parameters.");
    } catch (e) {
      alert("AGENT ERROR: Communication to kernel agent lost.");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive}>
      {activeTab === 'dashboard' && <Dashboard interfaces={interfaces} metrics={metrics} />}
      {activeTab === 'wan' && <InterfaceManager interfaces={interfaces} config={config} setConfig={setConfig} onApply={handleApplyConfig} isApplying={isApplying} />}
      {activeTab === 'bridge' && <div className="p-32 text-center text-slate-700 font-mono text-xs tracking-widest uppercase opacity-40">Bridge & DHCP Layer Ready</div>}
      {activeTab === 'advisor' && <div className="p-32 text-center text-slate-700 font-mono text-xs tracking-widest uppercase opacity-40">AI Neural Pipelines Online</div>}
      {activeTab === 'settings' && <div className="p-32 text-center text-slate-700 font-mono text-xs tracking-widest uppercase opacity-40">System Core Diagnostics</div>}
    </Layout>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
