import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * TYPES & ENUMS
 */
enum WanStatus { UP = 'UP', DOWN = 'DOWN', STANDBY = 'STANDBY' }

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

/**
 * API DISCOVERY & CONNECTIVITY
 * Automatically resolves the path to the Hardware Agent.
 */
const getApiBase = () => {
  const host = window.location.hostname || 'localhost';
  // If we are served via Nginx proxy on port 80/443, use relative /api
  // Otherwise, fallback to the agent's native port 3000
  if (window.location.port === '' || window.location.port === '80' || window.location.port === '443') {
    return '/api';
  }
  return `http://${host}:3000/api`;
};

const API_BASE = getApiBase();

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
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-xl shadow-blue-500/20">N</div>
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
          <div className={`p-5 rounded-2xl border transition-all duration-500 ${isLive ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'bg-rose-500/5 border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.1)]'}`}>
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-[0.2em] font-black">Hardware Link</div>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-rose-500 animate-pulse'}`} />
              <span className={`text-xs font-black uppercase tracking-tighter ${isLive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isLive ? 'NATIVE_ACTIVE' : 'OFFLINE_MODE'}
              </span>
            </div>
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
      rx: acc.rx + curr.throughput.rx,
      tx: acc.tx + curr.throughput.tx
    }), { rx: 0, tx: 0 });
  }, [interfaces]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter">System Topology</h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-500 text-sm font-medium">Ubuntu x64 Router Node • Kernel 6.8 Stable</p>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all duration-500 ${metrics.dnsResolved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'}`}>
              {metrics.dnsResolved ? 'DNS_SYNC' : 'DNS_FAIL'}
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all duration-500 ${metrics.ipForwarding ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
              {metrics.ipForwarding ? 'FORWARDING_ON' : 'FORWARDING_OFF'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-600 font-black tracking-widest uppercase mb-1">Runtime Sync</div>
          <div className="text-2xl font-mono text-white font-bold tracking-tighter">{metrics.uptime || '--:--:--'}</div>
        </div>
      </header>

      {/* High Fidelity Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md hover:border-emerald-500/30 transition-all">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Aggregate Ingress</h3>
          <div className="text-4xl font-mono text-emerald-400 font-bold tracking-tighter">{aggregateTraffic.rx.toFixed(2)} <span className="text-sm font-sans font-medium text-slate-600 uppercase tracking-widest">Mbps</span></div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md hover:border-blue-500/30 transition-all">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Aggregate Egress</h3>
          <div className="text-4xl font-mono text-blue-400 font-bold tracking-tighter">{aggregateTraffic.tx.toFixed(2)} <span className="text-sm font-sans font-medium text-slate-600 uppercase tracking-widest">Mbps</span></div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md hover:border-amber-500/30 transition-all">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Compute Stress</h3>
          <div className="text-4xl font-mono text-white font-bold">{metrics.cpuUsage.toFixed(1)}%</div>
          <div className="mt-4 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
             <div className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" style={{ width: `${metrics.cpuUsage}%` }} />
          </div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md hover:border-purple-500/30 transition-all">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Heap Allocation</h3>
          <div className="text-4xl font-mono text-white font-bold tracking-tighter">{metrics.memoryUsage} <span className="text-sm font-sans font-medium text-slate-600 uppercase">GB</span></div>
          <div className="text-[10px] text-slate-600 font-black uppercase mt-1 tracking-widest">Of {metrics.totalMem} Physical</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Real-time Telemetry Chart */}
        <div className="lg:col-span-2 bg-[#0B0F1A] p-10 rounded-[2.5rem] border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <span className="w-2 h-6 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              Live Stream: <span className="text-emerald-400 font-mono tracking-tighter">{selectedIface.toUpperCase()}</span>
            </h2>
            <select 
              value={selectedIface}
              onChange={(e) => setSelectedIface(e.target.value)}
              className="bg-slate-950 text-blue-400 border border-slate-800 rounded-2xl px-6 py-2.5 text-xs font-bold outline-none font-mono focus:border-blue-500 transition-all cursor-pointer"
            >
              {interfaces.length > 0 ? interfaces.map(iface => (
                <option key={iface.interfaceName} value={iface.interfaceName}>{iface.interfaceName.toUpperCase()}</option>
              )) : <option>SCANNING...</option>}
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
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
                <Area name="Downlink" type="monotone" dataKey="rx" stroke="#10b981" strokeWidth={4} fill="url(#colorRx)" isAnimationActive={false} />
                <Area name="Uplink" type="monotone" dataKey="tx" stroke="#3b82f6" strokeWidth={4} fill="url(#colorTx)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Interface Quick Look Matrix */}
        <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800 shadow-2xl flex flex-col overflow-hidden backdrop-blur-md hover:border-blue-500/20 transition-colors">
           <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Hardware Matrix</h2>
              <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-blue-400 font-mono border border-blue-500/20 uppercase tracking-widest">Active Stack</span>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {interfaces.length > 0 ? interfaces.map(iface => (
                <div 
                  key={iface.id} 
                  onClick={() => setSelectedIface(iface.interfaceName)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between ${selectedIface === iface.interfaceName ? 'bg-blue-600/10 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'}`}
                >
                   <div className="flex items-center gap-4">
                      <div className={`w-2.5 h-2.5 rounded-full ${iface.status === WanStatus.UP ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                      <div>
                        <div className="text-sm font-bold text-white font-mono uppercase tracking-tighter">{iface.interfaceName}</div>
                        <div className="text-[10px] text-slate-500 font-mono tracking-tight">{iface.ipAddress}</div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-[10px] text-emerald-400 font-mono font-bold tracking-tighter">{(iface.throughput.rx + iface.throughput.tx).toFixed(1)} Mbps</div>
                   </div>
                </div>
              )) : (
                <div className="text-center py-20 text-slate-600 font-mono text-xs uppercase tracking-[0.2em] animate-pulse">Initializing Physical Ports...</div>
              )}
           </div>
           <div className="p-8 mt-auto border-t border-slate-800 flex justify-between items-center bg-slate-950/40">
              <div>
                <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">Thermal Stat</div>
                <div className="text-2xl font-mono text-amber-500 font-bold">{metrics.temp || '--'}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">Active Threads</div>
                <div className="text-2xl font-mono text-blue-400 font-bold">{metrics.activeSessions}</div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENT: SYSTEM RECOVERY
 */
const SystemRecovery = ({ metrics, onFixDns, onRescue, interfaces }: any) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isFixing, setIsFixing] = useState(false);

  const handleFix = async () => {
    setIsFixing(true);
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] INITIATING_KERNEL_DNS_PATCH...`]);
    try {
      const res = await onFixDns();
      if (res.success) {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] SUCCESS: Stack synchronized. dnsmasq active.`]);
      } else {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] FAILED: ${res.error}`]);
      }
    } catch (e) {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: Agent connectivity failure.`]);
    }
    setIsFixing(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
      <div className="bg-slate-900/40 p-12 rounded-[3rem] border border-slate-800 shadow-2xl backdrop-blur-xl text-center">
        <h2 className="text-3xl font-black text-white mb-10 tracking-tighter uppercase">Kernel Operations Console</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto mb-12">
          <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 text-left shadow-inner flex flex-col items-center">
            <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-4">DNS Path</div>
            <div className={`text-lg font-mono font-bold ${metrics.dnsResolved ? 'text-emerald-400' : 'text-rose-500 animate-pulse'}`}>
              {metrics.dnsResolved ? 'LINKED_LOCKED' : 'RESOLVE_ERROR'}
            </div>
          </div>
          <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 text-left shadow-inner flex flex-col items-center">
            <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-4">Active Ports</div>
            <div className="text-lg font-mono font-bold text-blue-400 uppercase tracking-tighter">
              {interfaces.filter((i:any) => i.status === 'UP').length} PHYSICAL PORTS
            </div>
          </div>
          <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 text-left shadow-inner flex flex-col items-center">
            <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-4">IP Forwarding</div>
            <div className={`text-lg font-mono font-bold ${metrics.ipForwarding ? 'text-emerald-400' : 'text-amber-500'}`}>
              {metrics.ipForwarding ? 'KERNEL_ACTIVE' : 'KERNEL_DISABLED'}
            </div>
          </div>
        </div>

        <div className="bg-rose-500/5 p-10 rounded-[2.5rem] border border-rose-500/20 max-w-3xl mx-auto space-y-6">
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="w-16 h-16 bg-rose-600/20 rounded-full flex items-center justify-center text-rose-500 text-4xl animate-pulse shadow-xl shadow-rose-600/10 border border-rose-500/20">⚠️</div>
            <h3 className="text-rose-500 font-black text-sm uppercase tracking-[0.2em] mt-2">Emergency Recovery Tools</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={onRescue} className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-5 rounded-2xl text-xs font-black shadow-lg shadow-amber-600/20 active:scale-95 transition-all uppercase tracking-widest">
              FLUSH ROUTES & NAT
            </button>
            <button 
              onClick={handleFix} 
              disabled={isFixing}
              className="bg-rose-600 hover:bg-rose-500 text-white px-8 py-5 rounded-2xl text-xs font-black shadow-lg shadow-rose-600/20 active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50"
            >
              {isFixing ? 'PATCHING...' : 'FORCED KERNEL DNS REPAIR'}
            </button>
          </div>
          
          <div className="p-6 bg-black/80 rounded-2xl border border-slate-800 shadow-inner text-left font-mono text-[10px] text-slate-500 max-h-40 overflow-y-auto custom-scrollbar">
            {logs.length === 0 ? (
              <p className="italic">Waiting for repair command...</p>
            ) : logs.map((log, i) => (
              <p key={i} className="mb-1 leading-relaxed">{log}</p>
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
  const [isInitialized, setIsInitialized] = useState(false);

  const refreshData = useCallback(async () => {
    try {
      const [ifaceRes, metricRes] = await Promise.all([
        fetch(`${API_BASE}/interfaces`),
        fetch(`${API_BASE}/metrics`)
      ]);
      if (ifaceRes.ok && metricRes.ok) {
        const ifaces = await ifaceRes.json();
        const met = await metricRes.json();
        setInterfaces(ifaces);
        setMetrics(met);
        setIsLive(true);
        if (!isInitialized) setIsInitialized(true);
      } else {
        setIsLive(false);
      }
    } catch (e) { 
      setIsLive(false); 
    }
  }, [isInitialized]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 2000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleFixDns = async () => {
    try {
      const res = await fetch(`${API_BASE}/system/restore-dns`, { method: 'POST' });
      const data = await res.json();
      refreshData();
      return { success: res.ok, error: data.error };
    } catch (e) {
      return { success: false, error: "AGENT_DISCONNECTED" };
    }
  };

  const handleRescue = async () => {
    if (!confirm("This will WIPE all multi-wan kernel routing rules. Confirm rescue sequence?")) return;
    try {
       const res = await fetch(`${API_BASE}/apply`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ mode: 'FAILOVER', wanInterfaces: interfaces.map(i => ({...i, priority: 1})) }) 
       });
       if (res.ok) alert("RESCUE: Routing tables flushed to default.");
       else alert("FAILED: Kernel rejected route flush.");
    } catch(e) { alert("ERROR: Agent communication failure."); }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive}>
      {activeTab === 'dashboard' && <Dashboard interfaces={interfaces} metrics={metrics} />}
      {activeTab === 'wan' && <div className="p-32 text-center text-slate-700 font-mono text-xs tracking-widest uppercase opacity-40">Multi-WAN Fabric Ready</div>}
      {activeTab === 'bridge' && <div className="p-32 text-center text-slate-700 font-mono text-xs tracking-widest uppercase opacity-40">Bridge & DHCP Layer Ready</div>}
      {activeTab === 'advisor' && <div className="p-32 text-center text-slate-700 font-mono text-xs tracking-widest uppercase opacity-40">AI Neural Advisor Online</div>}
      {activeTab === 'settings' && <SystemRecovery metrics={metrics} onFixDns={handleFixDns} onRescue={handleRescue} interfaces={interfaces} />}
    </Layout>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
