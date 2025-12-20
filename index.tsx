import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
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
  isBridgeMember?: boolean;
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
}

interface SystemMetrics {
  cpuUsage: number;
  cores: number[]; 
  memoryUsage: string; 
  totalMem: string; 
  temp: string;
  uptime: string;
  activeSessions: number;
  dnsResolved: boolean;
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
      <aside className="w-64 bg-[#0B0F1A] border-r border-slate-800 flex flex-col shadow-2xl z-20">
        <div className="p-8 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-xl shadow-blue-500/20">N</div>
          <span className="font-bold text-2xl tracking-tighter text-white">Nexus</span>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
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
          <div className={`p-5 rounded-2xl border transition-all duration-500 ${isLive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-[0.2em] font-black">Kernel Status</div>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-rose-500 animate-pulse'}`} />
              <span className={`text-xs font-black uppercase tracking-tighter ${isLive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isLive ? 'Hardware Native' : 'Kernel Offline'}
              </span>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto relative bg-[#020617]">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-blue-500/5 blur-[120px] rounded-full -z-10" />
        <div className="max-w-6xl mx-auto p-12">{children}</div>
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter">System Dashboard</h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-500 text-sm font-medium">Ubuntu x64 Router Node</p>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${metrics.dnsResolved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'}`}>
              {metrics.dnsResolved ? 'DNS: Linked' : 'DNS: Failing'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-600 font-black tracking-widest uppercase mb-1">Session Uptime</div>
          <div className="text-2xl font-mono text-white font-bold">{metrics.uptime || '0m'}</div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Compute Load</h3>
          <div className="flex items-end justify-between">
            <div className="text-4xl font-mono text-white font-bold">{metrics.cpuUsage.toFixed(1)}%</div>
            <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${metrics.cpuUsage}%` }} />
            </div>
          </div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Memory Pipeline</h3>
          <div className="flex items-end justify-between">
            <div className="text-4xl font-mono text-white font-bold">{metrics.memoryUsage} <span className="text-sm">GB</span></div>
            <div className="text-xs text-slate-500 font-bold mb-1">/ {metrics.totalMem}</div>
          </div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Thermal Health</h3>
          <div className="text-4xl font-mono text-amber-500 font-bold">{metrics.temp || '--'}</div>
        </div>
      </div>

      <div className="bg-[#0B0F1A] p-10 rounded-[2.5rem] border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <span className="w-2 h-6 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            Live Traffic: <span className="text-blue-400 font-mono tracking-tighter">{selectedIface.toUpperCase()}</span>
          </h2>
          <select 
            value={selectedIface}
            onChange={(e) => setSelectedIface(e.target.value)}
            className="bg-slate-950 text-blue-400 border border-slate-800 rounded-2xl px-6 py-2.5 text-xs font-bold outline-none font-mono focus:border-blue-500 transition-colors"
          >
            {interfaces.map(iface => (
              <option key={iface.interfaceName} value={iface.interfaceName}>{iface.interfaceName.toUpperCase()}</option>
            ))}
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
    </div>
  );
};

/**
 * COMPONENT: SYSTEM RECOVERY
 */
const SystemRecovery = ({ metrics, onFixDns, onRescue, interfaces }: any) => (
  <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
    <div className="bg-slate-900/40 p-12 rounded-[3rem] border border-slate-800 shadow-2xl backdrop-blur-xl text-center">
      <h2 className="text-3xl font-black text-white mb-10 tracking-tighter uppercase">Kernel Operations</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto mb-12">
        <div className="bg-slate-950/50 p-8 rounded-3xl border border-slate-800 text-left shadow-inner">
          <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-2">Local Resolution</div>
          <div className={`text-lg font-mono font-bold ${metrics.dnsResolved ? 'text-emerald-400' : 'text-rose-500'}`}>
            {metrics.dnsResolved ? 'SYSTEM_STABLE' : 'DNS_FAILURE'}
          </div>
        </div>
        <div className="bg-slate-950/50 p-8 rounded-3xl border border-slate-800 text-left shadow-inner">
          <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-2">WAN State</div>
          <div className="text-lg font-mono font-bold text-blue-400">
            {interfaces.filter((i:any) => i.status === 'UP').length} ACTIVE LINKS
          </div>
        </div>
      </div>

      <div className="bg-rose-500/5 p-10 rounded-[2.5rem] border border-rose-500/20 max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="w-12 h-12 bg-rose-600/20 rounded-full flex items-center justify-center text-rose-500 text-2xl animate-pulse">⚠️</div>
          <h3 className="text-rose-500 font-black text-sm uppercase tracking-[0.2em]">Emergency Recovery Sequence</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={onRescue} className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-4 rounded-2xl text-xs font-black shadow-lg shadow-amber-600/20 active:scale-95 transition-all">
            RESET ALL KERNEL ROUTES
          </button>
          <button onClick={onFixDns} className="bg-rose-600 hover:bg-rose-500 text-white px-8 py-4 rounded-2xl text-xs font-black shadow-lg shadow-rose-600/20 active:scale-95 transition-all">
            FORCED DNS REPAIR
          </button>
        </div>
        <p className="text-[10px] text-slate-600 font-medium italic">Warning: Repairing DNS will overwrite /etc/resolv.conf and restart the DHCP agent.</p>
      </div>
    </div>
  </div>
);

/**
 * MAIN APP
 */
const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLive, setIsLive] = useState(false);
  const [metrics, setMetrics] = useState<SystemMetrics>({ cpuUsage: 0, cores: [], memoryUsage: '0', totalMem: '0', temp: '0', uptime: '', activeSessions: 0, dnsResolved: true });
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
      }
    } catch (e) { setIsLive(false); }
  }, [isInitialized]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 1500); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleFixDns = async () => {
    try {
      const res = await fetch(`${API_BASE}/system/restore-dns`, { method: 'POST' });
      if (res.ok) alert("SUCCESS: DNS Repair sequence complete. systemd-resolved neutralized.");
      else alert("FAILED: Kernel rejected repair command.");
    } catch (e) { alert("ERROR: Could not reach Hardware Agent."); }
  };

  const handleRescue = async () => {
    if (!confirm("This will wipe all existing Multi-WAN and Bridge routing. Proceed?")) return;
    try {
       await fetch(`${API_BASE}/apply`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ mode: 'FAILOVER', wanInterfaces: interfaces.map(i => ({...i, priority: 1})) }) 
       });
       alert("RESCUE: Default Failover routes injected.");
    } catch(e) { alert("RESCUE: Command failed."); }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive}>
      {activeTab === 'dashboard' && <Dashboard interfaces={interfaces} metrics={metrics} />}
      {activeTab === 'wan' && <div className="p-20 text-center text-slate-600 font-mono">Multi-WAN Control Module Ready</div>}
      {activeTab === 'bridge' && <div className="p-20 text-center text-slate-600 font-mono">Bridge & DHCP Layer Ready</div>}
      {activeTab === 'advisor' && <div className="p-20 text-center text-slate-600 font-mono">AI Advisor Awaiting Connectivity</div>}
      {activeTab === 'settings' && <SystemRecovery metrics={metrics} onFixDns={handleFixDns} onRescue={handleRescue} interfaces={interfaces} />}
    </Layout>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
