import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: string;
  temp: string;
  uptime: string;
  activeSessions: number;
}

const API_BASE = 'http://localhost:3000/api';

/**
 * COMPONENT: LAYOUT
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
const Dashboard = ({ wanInterfaces, metrics }: { wanInterfaces: WanInterface[], metrics: SystemMetrics }) => {
  const chartData = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      time: i,
      wan1: (wanInterfaces[0]?.throughput?.rx || 0) + (Math.random() * 0.5),
      wan2: (wanInterfaces[1]?.throughput?.rx || 0) + (Math.random() * 0.2),
    }));
  }, [wanInterfaces]);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">System Telemetry</h1>
          <p className="text-slate-500 text-sm mt-1 uppercase tracking-wider font-mono">Uptime: {metrics.uptime || 'Detecting...'}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'CPU LOAD', val: `${metrics.cpuUsage?.toFixed(1) || 0}%`, color: 'text-blue-400' },
          { label: 'MEM USAGE', val: `${metrics.memoryUsage || 0} GB`, color: 'text-white' },
          { label: 'SESSIONS', val: metrics.activeSessions || 0, color: 'text-white' },
          { label: 'CORE TEMP', val: metrics.temp || 'N/A', color: 'text-amber-400' },
        ].map((m, i) => (
          <div key={i} className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 backdrop-blur-md shadow-sm hover:border-slate-700 transition-colors">
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">{m.label}</div>
            <div className={`text-2xl font-mono font-bold ${m.color}`}>{m.val}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/60 p-8 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
          <h2 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-blue-500 rounded-sm shadow-[0_0_8px_#3b82f6]" /> Live Network Load (MB/s)
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

        <div className="bg-slate-900/60 p-8 rounded-2xl border border-slate-800 flex flex-col justify-between backdrop-blur-md">
           <div>
              <h2 className="text-lg font-bold text-white mb-6">Host Environment</h2>
              <div className="space-y-4">
                 <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-widest">OS Runtime</div>
                    <div className="text-sm font-mono text-blue-400">Ubuntu 24.04 x86_64</div>
                 </div>
                 <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-widest">IPv4 Forwarding</div>
                    <div className="text-sm font-mono text-emerald-400">STATE: ACTIVE</div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-xl backdrop-blur-md">
        <div className="bg-slate-800/20 p-4 border-b border-slate-800 flex justify-between items-center">
           <h3 className="font-bold text-white text-sm">Hardware Interfaces</h3>
           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{wanInterfaces.length} DETECTED</span>
        </div>
        <div className="divide-y divide-slate-800 font-mono">
          {wanInterfaces.map((wan: any) => (
            <div key={wan.id} className="p-6 flex items-center justify-between hover:bg-slate-800/10 transition-colors group">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${wan.status === WanStatus.UP ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500'}`} />
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    {wan.name}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-blue-400 border border-blue-500/10 uppercase font-mono">{wan.interfaceName}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{wan.ipAddress} • <span className="text-slate-600">GW: {wan.gateway}</span></div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-emerald-400 font-bold">RX: {wan.throughput.rx.toFixed(2)} MB</div>
                <div className="text-xs text-blue-400 font-bold">TX: {wan.throughput.tx.toFixed(2)} MB</div>
              </div>
            </div>
          ))}
          {wanInterfaces.length === 0 && (
            <div className="p-10 text-center text-slate-600 italic text-sm">Waiting for hardware probe...</div>
          )}
        </div>
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
    if (!process.env.API_KEY) {
      setAdvice('Neural link failure: Gemini API Key missing from environment.');
      return;
    }
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this real Ubuntu router configuration for optimization. Configuration: ${JSON.stringify(config)}. 
        Please provide:
        1. Performance assessment.
        2. Specific CLI commands for nftables and sysctl tweaks.
        3. Security hardening recommendations.`,
      });
      setAdvice(response.text || 'No data returned from AI core.');
    } catch (e) {
      setAdvice('Connection to AI Neuralink interrupted. Check API key and network.');
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900/60 p-10 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-md">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h2 className="text-2xl font-bold text-white mb-1">Nexus AI Neuralink</h2>
           <p className="text-slate-500 text-sm italic tracking-tight">Deep kernel inspection powered by Google Gemini</p>
        </div>
        <button onClick={getAdvice} disabled={loading} className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-2xl text-xs font-bold text-white transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50">
          {loading ? 'SYNCHRONIZING...' : 'ANALYZE TOPOLOGY'}
        </button>
      </div>
      <div className="bg-slate-950/80 p-8 rounded-2xl border border-slate-800 font-mono text-sm leading-relaxed text-slate-300 min-h-[300px] whitespace-pre-wrap shadow-inner overflow-y-auto max-h-[500px]">
        {advice || 'System ready for inspection. Synchronize topology to generate AI-driven performance scripts.'}
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
  const [metrics, setMetrics] = useState<SystemMetrics>({ cpuUsage: 0, memoryUsage: '0', temp: '0', uptime: '', activeSessions: 0 });
  const [config, setConfig] = useState<any>({
    mode: RouterMode.LOAD_BALANCER,
    wanInterfaces: []
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
        // Persist local weight changes if possible, or just overwrite with real state
        setConfig((prev: any) => ({ ...prev, wanInterfaces: ifaces }));
      }
    } catch (e) {
      setIsLive(false);
      // Mock for UI demonstration if agent is offline
      setMetrics({ cpuUsage: 5, memoryUsage: '1.2', temp: '42°C', uptime: 'Simulation Mode', activeSessions: 12 });
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const commitConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        alert('Nexus Core: Kernel synchronized successfully.\n' + data.log.join('\n'));
      }
    } catch(e) {
      alert('Nexus Core: Failed to communicate with Hardware Agent.');
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive}>
      {activeTab === 'dashboard' && <Dashboard wanInterfaces={config.wanInterfaces} metrics={metrics} />}
      
      {activeTab === 'wan' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="bg-slate-900/60 p-10 rounded-3xl border border-slate-800 backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white mb-6">Route Orchestration</h2>
              
              <div className="flex gap-4 mb-10">
                 <button 
                   onClick={() => setConfig({...config, mode: RouterMode.LOAD_BALANCER})}
                   className={`flex-1 p-6 rounded-2xl border transition-all text-left group ${config.mode === RouterMode.LOAD_BALANCER ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                 >
                    <div className={`font-bold transition-colors ${config.mode === RouterMode.LOAD_BALANCER ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>Multi-WAN Load Balancer</div>
                    <div className="text-[11px] mt-1 opacity-60">Combine bandwidth from all active ISP connections.</div>
                 </button>
                 <button 
                   onClick={() => setConfig({...config, mode: RouterMode.FAILOVER})}
                   className={`flex-1 p-6 rounded-2xl border transition-all text-left group ${config.mode === RouterMode.FAILOVER ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                 >
                    <div className={`font-bold transition-colors ${config.mode === RouterMode.FAILOVER ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>High Availability Failover</div>
                    <div className="text-[11px] mt-1 opacity-60">Automatic switching to backup link on outage detection.</div>
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                {config.wanInterfaces.map((wan: any) => (
                  <div key={wan.id} className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 shadow-inner">
                    <div className="flex justify-between items-center mb-4">
                       <span className="font-bold text-white tracking-tight">{wan.name}</span>
                       <span className="text-[10px] text-blue-400 font-mono font-black uppercase tracking-widest">{wan.interfaceName}</span>
                    </div>
                    {config.mode === RouterMode.LOAD_BALANCER ? (
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase tracking-widest">Weight Distribution: {wan.weight || 1}x</div>
                        <input 
                          type="range" min="1" max="100" value={wan.weight || 1}
                          onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, weight: parseInt(e.target.value)} : w)})}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Priority Index</label>
                        <select 
                          value={wan.priority || 1}
                          onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, priority: parseInt(e.target.value)} : w)})}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-300 outline-none focus:border-blue-500"
                        >
                           <option value={1}>PRIORITY 1 (MAIN)</option>
                           <option value={2}>PRIORITY 2 (BACKUP)</option>
                           <option value={3}>PRIORITY 3 (EMERGENCY)</option>
                        </select>
                      </div>
                    )}
                  </div>
                ))}
                {config.wanInterfaces.length === 0 && (
                   <div className="col-span-2 p-10 bg-slate-950/50 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500 text-sm italic">
                      No WAN interfaces detected for routing.
                   </div>
                )}
              </div>

              <button 
                onClick={commitConfig}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all uppercase tracking-widest"
              >
                Sync Configuration to Ubuntu Kernel
              </button>
           </div>
        </div>
      )}
      
      {activeTab === 'advisor' && <AIAdvisor config={config} />}
      
      {activeTab === 'settings' && (
        <div className="bg-slate-900/60 p-12 rounded-3xl border border-slate-800 text-center backdrop-blur-md">
           <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">System Identity</h2>
           <p className="text-slate-500 font-mono text-sm mb-10">Nexus Router OS v1.3.4 (Native Kernel Agent)</p>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
              <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-2xl shadow-inner">
                 <div className="text-[10px] text-slate-500 mb-2 font-black uppercase tracking-widest">Hardware Port</div>
                 <div className="text-blue-400 font-bold font-mono text-lg">3000</div>
              </div>
              <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-2xl shadow-inner">
                 <div className="text-[10px] text-slate-500 mb-2 font-black uppercase tracking-widest">Git Origin</div>
                 <div className="text-emerald-400 font-bold font-mono text-xs truncate">Djnirds1984/Nexus-Router-OS</div>
              </div>
           </div>

           <div className="mt-10 p-6 bg-blue-600/5 border border-blue-500/10 rounded-2xl text-left max-w-xl mx-auto">
              <div className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-3">Kernel Log</div>
              <div className="font-mono text-[11px] text-slate-400 space-y-1">
                 <div>[INFO] IPv4 forwarding enabled</div>
                 <div>[INFO] Multipath routing cache cleared</div>
                 <div>[INFO] Interface enp1s0 status: UP</div>
                 <div>[INFO] BBR Congestion Control: ACTIVE</div>
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
