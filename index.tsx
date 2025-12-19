
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

/**
 * COMPONENTS: LAYOUT
 */
const Layout = ({ children, activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'wan', label: 'Multi-WAN', icon: '🌐' },
    { id: 'advisor', label: 'AI Advisor', icon: '🧠' },
    { id: 'settings', label: 'System', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden">
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
                activeTab === tab.id ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="font-medium text-sm">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 mt-auto">
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-widest font-bold">Ubuntu Runtime</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">CORE ONLINE</span>
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
const Dashboard = ({ wanInterfaces }) => {
  const chartData = useMemo(() => Array.from({ length: 20 }).map((_, i) => ({
    time: i,
    wan1: 300 + Math.random() * 200,
    wan2: 50 + Math.random() * 50,
  })), []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'CPU LOAD', val: '12.4%', color: 'text-blue-400' },
          { label: 'RAM USAGE', val: '1.8GB', color: 'text-white' },
          { label: 'SESSIONS', val: '142', color: 'text-white' },
          { label: 'LATENCY', val: '14ms', color: 'text-emerald-400' },
        ].map((m, i) => (
          <div key={i} className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">{m.label}</div>
            <div className={`text-2xl font-bold ${m.color}`}>{m.val}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-blue-500 rounded-sm" /> Network Throughput
        </h2>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorWan1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#475569" fontSize={10} tickFormatter={(val) => `${val}M`} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="wan1" stroke="#3b82f6" strokeWidth={2} fill="url(#colorWan1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        {wanInterfaces.map((wan) => (
          <div key={wan.id} className="p-6 flex items-center justify-between border-b border-slate-800 last:border-0">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${wan.status === WanStatus.UP ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`} />
              <div>
                <div className="font-bold text-white">{wan.name}</div>
                <div className="text-xs text-slate-500 font-mono">{wan.interfaceName} • {wan.ipAddress}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-emerald-400">↓ {wan.throughput.rx.toFixed(1)} Mbps</div>
              <div className="text-xs font-mono text-blue-400">↑ {wan.throughput.tx.toFixed(1)} Mbps</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * COMPONENTS: INTERFACE MANAGER
 */
const InterfaceManager = ({ config, setConfig }) => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Routing Strategy</h2>
          <p className="text-sm text-slate-400 max-w-md">Select how Ubuntu handles traffic across your available WAN ports.</p>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button 
            onClick={() => setConfig({...config, mode: RouterMode.LOAD_BALANCER})}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${config.mode === RouterMode.LOAD_BALANCER ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
          >LOAD BALANCER</button>
          <button 
            onClick={() => setConfig({...config, mode: RouterMode.FAILOVER})}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${config.mode === RouterMode.FAILOVER ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
          >AUTO FAILOVER</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {config.wanInterfaces.map((wan) => (
          <div key={wan.id} className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-white">{wan.name}</h3>
              <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-950 text-blue-400 border border-blue-500/10 font-mono">{wan.interfaceName}</span>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                <span>{config.mode === RouterMode.LOAD_BALANCER ? 'Weight Allocation' : 'Priority Tier'}</span>
                <span className="text-blue-400">{config.mode === RouterMode.LOAD_BALANCER ? `${wan.weight}%` : `P${wan.priority}`}</span>
              </div>
              <input 
                type="range" min="1" max="100" value={wan.weight}
                onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map(w => w.id === wan.id ? {...w, weight: parseInt(e.target.value)} : w)})}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * COMPONENTS: AI ADVISOR
 */
const AIAdvisor = ({ config }) => {
  const [advice, setAdvice] = useState('');
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);

  const getAdvice = async () => {
    // Safety check for API Key
    // Fix: Using process.env.API_KEY directly as required by system guidelines
    if (!process.env.API_KEY) {
      setAdvice('System Error: API Key is not configured in the host environment.');
      return;
    }

    setLoading(true);
    try {
      // Fix: Direct initialization of GoogleGenAI using process.env.API_KEY
      // Fix: Using 'gemini-3-pro-preview' for complex networking advice and CLI command generation
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Expert Linux Networking advice for Ubuntu 24.04 Router with Multi-WAN. Mode: ${config.mode}. Interfaces: ${JSON.stringify(config.wanInterfaces)}. Provide 3 specific CLI commands for iproute2 or nftables.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      // response.text is a direct property, using it correctly
      setAdvice(response.text || '');
      
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const extractedSources = chunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          title: chunk.web.title || 'Source',
          uri: chunk.web.uri || '#'
        }));
      setSources(extractedSources);
    } catch (e) {
      setAdvice('Connection timed out or API refusal. Please check your network credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-bold text-white">Kernel Architecture Advisor</h2>
          <button onClick={getAdvice} disabled={loading} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-xl text-xs font-bold text-white transition-all">
            {loading ? 'Consulting Gemini...' : 'Analyze Topology'}
          </button>
        </div>
        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 font-mono text-sm leading-relaxed text-slate-300 mb-6 whitespace-pre-wrap">
          {advice || 'Click "Analyze Topology" to receive optimized Ubuntu network configuration commands.'}
        </div>
        
        {sources.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Grounding Sources</h4>
            <div className="flex flex-wrap gap-2">
              {sources.map((source, idx) => (
                <a 
                  key={idx} 
                  href={source.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10"
                >
                  {source.title} ↗
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * MAIN APP CONTAINER
 */
const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState({
    mode: RouterMode.LOAD_BALANCER,
    wanInterfaces: [
      { id: 'w1', name: 'Primary ISP', interfaceName: 'eth0', status: WanStatus.UP, weight: 70, priority: 1, ipAddress: '192.168.1.100', throughput: { rx: 450, tx: 120 }, latency: 12 },
      { id: 'w2', name: 'Backup ISP', interfaceName: 'eth1', status: WanStatus.UP, weight: 30, priority: 2, ipAddress: '10.0.0.5', throughput: { rx: 85, tx: 20 }, latency: 45 },
    ]
  });

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <Dashboard wanInterfaces={config.wanInterfaces} />}
      {activeTab === 'wan' && <InterfaceManager config={config} setConfig={setConfig} />}
      {activeTab === 'advisor' && <AIAdvisor config={config} />}
      {activeTab === 'settings' && (
        <div className="bg-slate-900 p-12 rounded-3xl border border-slate-800 border-dashed text-center">
           <div className="text-4xl mb-4">⚙️</div>
           <h2 className="text-xl font-bold text-white mb-2">System Preferences</h2>
           <p className="text-slate-500 text-sm">Managing Ubuntu 24.04 x64 Environment.</p>
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
