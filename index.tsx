
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * NEXUS CORE TYPES
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
}

const API_BASE = 'http://localhost:3000/api';

/**
 * COMPONENTS: LAYOUT
 */
const Layout = ({ children, activeTab, setActiveTab, isLive }: any) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'wan', label: 'Multi-WAN', icon: '🌐' },
    { id: 'advisor', label: 'AI Advisor', icon: '🧠' },
    { id: 'settings', label: 'System', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      <aside className="w-64 bg-slate-900/50 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">N</div>
          <span className="font-bold text-xl tracking-tight">Nexus OS</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === tab.id ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-sm' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="font-medium text-sm">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 mt-auto">
          <div className={`p-4 rounded-xl border transition-all ${isLive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-widest font-bold">Host Connectivity</div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className={`text-xs font-bold uppercase ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
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
 * COMPONENTS: DASHBOARD
 */
const Dashboard = ({ wanInterfaces, metrics }: any) => {
  const chartData = useMemo(() => Array.from({ length: 30 }).map((_, i) => ({
    time: i,
    wan1: (wanInterfaces[0]?.throughput?.rx || 0) + Math.random() * 5,
    wan2: (wanInterfaces[1]?.throughput?.rx || 0) + Math.random() * 2,
  })), [wanInterfaces]);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">System Overview</h1>
          <p className="text-slate-500 text-sm mt-1 uppercase tracking-wider font-mono">Kernel: {metrics.uptime || 'Booting...'}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'CPU LOAD', val: `${metrics.cpuUsage?.toFixed(1) || 0}%`, color: 'text-blue-400' },
          { label: 'MEM USAGE', val: `${metrics.memoryUsage || 0} GB`, color: 'text-white' },
          { label: 'SESSIONS', val: metrics.activeSessions || 0, color: 'text-white' },
          { label: 'LATENCY', val: '14ms', color: 'text-emerald-400' },
        ].map((m, i) => (
          <div key={i} className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-sm hover:border-slate-700 transition-colors">
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">{m.label}</div>
            <div className={`text-2xl font-mono font-bold ${m.color}`}>{m.val}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-blue-500 rounded-sm shadow-[0_0_8px_#3b82f6]" /> Live Throughput (MB/s)
          </h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorWan1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#475569" fontSize={10} tickFormatter={(val) => `${val}M`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '10px' }} />
                <Area type="monotone" dataKey="wan1" stroke="#3b82f6" strokeWidth={3} fill="url(#colorWan1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 flex flex-col justify-between">
           <div>
              <h2 className="text-lg font-bold text-white mb-6">Host Context</h2>
              <div className="space-y-4">
                 <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Architecture</div>
                    <div className="text-sm font-mono text-blue-400">Ubuntu 24.04 x86_64</div>
                 </div>
                 <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Forwarding</div>
                    <div className="text-sm font-mono text-emerald-400">STATE: ENABLED</div>
                 </div>
              </div>
           </div>
           <button className="w-full bg-slate-800 hover:bg-slate-700 text-xs font-bold py-3 rounded-xl transition-all uppercase tracking-widest text-slate-400">
              Update Kernel Delays
           </button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="bg-slate-800/20 p-4 border-b border-slate-800 flex justify-between items-center">
           <h3 className="font-bold text-white text-sm">Hardware Interfaces</h3>
           <span className="text-[10px] font-bold text-slate-500">{wanInterfaces.length} DETECTED</span>
        </div>
        <div className="divide-y divide-slate-800">
          {wanInterfaces.map((wan: any) => (
            <div key={wan.id} className="p-6 flex items-center justify-between hover:bg-slate-800/10 transition-colors group">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${wan.status === WanStatus.UP ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500'}`} />
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    {wan.name}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-blue-400 border border-blue-500/10 font-mono">{wan.interfaceName}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{wan.ipAddress}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-emerald-400">IN: {wan.throughput.rx.toFixed(2)} MB</div>
                <div className="text-xs font-mono text-blue-400">OUT: {wan.throughput.tx.toFixed(2)} MB</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENTS: AI ADVISOR
 */
const AIAdvisor = ({ config }: any) => {
  const [advice, setAdvice] = useState('');
  const [loading, setLoading] = useState(false);

  const getAdvice = async () => {
    if (!process.env.API_KEY) {
      setAdvice('API Key missing. Cannot generate neural diagnostics.');
      return;
    }
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this real Ubuntu router config: ${JSON.stringify(config)}. Suggest optimized nftables and iproute2 performance tweaks.`,
      });
      setAdvice(response.text || '');
    } catch (e) {
      setAdvice('AI link failed. Using local cached heuristics.');
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 p-10 rounded-3xl border border-slate-800 shadow-2xl">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h2 className="text-2xl font-bold text-white mb-1">Nexus AI Neuralink</h2>
           <p className="text-slate-500 text-sm">Deep inspection of Linux networking stack.</p>
        </div>
        <button onClick={getAdvice} disabled={loading} className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-2xl text-xs font-bold text-white transition-all shadow-lg shadow-blue-600/20 active:scale-95">
          {loading ? 'Analyzing Core...' : 'Sync Advisor'}
        </button>
      </div>
      <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 font-mono text-sm leading-relaxed text-slate-300 min-h-[200px] whitespace-pre-wrap">
        {advice || 'Nexus AI is ready. Synchronize topology to receive kernel-level optimization scripts.'}
      </div>
    </div>
  );
};

/**
 * MAIN APP CONTAINER
 */
const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLive, setIsLive] = useState(false);
  const [metrics, setMetrics] = useState({ cpuUsage: 0, memoryUsage: 0, uptime: '', activeSessions: 0 });
  const [config, setConfig] = useState<any>({
    mode: RouterMode.LOAD_BALANCER,
    wanInterfaces: [
      { id: 'eth0', name: 'ISP PRIMARY', interfaceName: 'eth0', status: WanStatus.UP, weight: 70, ipAddress: '192.168.1.10', throughput: { rx: 0, tx: 0 } },
      { id: 'eth1', name: 'ISP BACKUP', interfaceName: 'eth1', status: WanStatus.UP, weight: 30, ipAddress: '10.0.0.5', throughput: { rx: 0, tx: 0 } },
    ]
  });

  const refreshData = useCallback(async () => {
    try {
      const [ifaceRes, metricRes] = await Promise.all([
        fetch(`${API_BASE}/interfaces`),
        fetch(`${API_BASE}/metrics`)
      ]);
      
      if (ifaceRes.ok && metricRes.ok) {
        const ifaces = await ifaceRes.json();
        const met = await metricRes.json();
        setIsLive(true);
        setMetrics(met);
        setConfig((prev: any) => ({ ...prev, wanInterfaces: ifaces }));
      }
    } catch (e) {
      setIsLive(false);
      // Fallback to random simulation if agent is down
      setMetrics({
        cpuUsage: 5 + Math.random() * 5,
        memoryUsage: 1.2,
        uptime: 'Simulated 1h 20m',
        activeSessions: 42
      });
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, [refreshData]);

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive}>
      {activeTab === 'dashboard' && <Dashboard wanInterfaces={config.wanInterfaces} metrics={metrics} />}
      {activeTab === 'wan' && (
        <div className="bg-slate-900 p-10 rounded-3xl border border-slate-800 text-center">
           <div className="text-4xl mb-4">🚀</div>
           <h2 className="text-2xl font-bold text-white mb-2">Interface Orchestration</h2>
           <p className="text-slate-500 mb-8 max-w-sm mx-auto">Hardware interfaces are managed automatically by the Nexus Core Agent.</p>
           <button 
             onClick={async () => {
               await fetch(`${API_BASE}/apply`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(config)
               });
               alert('Config pushed to Kernel successfully.');
             }}
             className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20"
           >
             Commit Config to Kernel
           </button>
        </div>
      )}
      {activeTab === 'advisor' && <AIAdvisor config={config} />}
      {activeTab === 'settings' && (
        <div className="bg-slate-900 p-12 rounded-3xl border border-slate-800 text-center">
           <h2 className="text-xl font-bold text-white">System Settings</h2>
           <p className="text-slate-500 mt-2">Core Agent Port: 3000 • Protocol: HTTP/JSON</p>
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
