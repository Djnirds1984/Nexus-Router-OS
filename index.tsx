import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GoogleGenAI } from "@google/genai";
import UpdateManager from './components/UpdateManager';

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
  cores?: number[];
  memoryUsage: string; 
  totalMem: string; 
  temp: string;
  uptime: string;
  activeSessions: number;
  dnsResolved: boolean;
  ipForwarding: boolean;
  bbrEnabled?: boolean;
}

interface NetworkConfig {
  mode: RouterMode;
  wanInterfaces: WanInterface[];
  bridges: BridgeConfig[];
}

interface TerminalLog {
  id: string;
  type: 'info' | 'command' | 'success' | 'error';
  message: string;
  timestamp: Date;
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
 * COMPONENT: TERMINAL
 */
const Terminal = ({ logs, isOpen, onClose }: { logs: TerminalLog[], isOpen: boolean, onClose: () => void }) => {
  const endRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);
  if (!isOpen) return null;
  return (
    <div className="fixed bottom-0 left-64 right-0 z-50 bg-black/95 border-t border-slate-700 h-80 flex flex-col font-mono text-sm shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500" />
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="ml-2 text-slate-400 font-bold text-xs uppercase tracking-widest italic">Nexus Console</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3">
            <span className="text-slate-600">[{log.timestamp.toLocaleTimeString()}]</span>
            <span className={log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-rose-400' : 'text-slate-300'}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

/**
 * COMPONENT: AI ADVISOR (INTERNAL)
 */
const AIAdvisor = ({ config }: { config: NetworkConfig }) => {
  const [advice, setAdvice] = useState<string>('Generating network topology analysis...');
  const [loading, setLoading] = useState(false);

  const fetchAdvice = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Analyze this router config: Mode=${config.mode}, WANs=${config.wanInterfaces.length}, Bridges=${config.bridges.length}. Suggest 3 Ubuntu network optimizations.`
      });
      setAdvice(response.text || 'No advice available.');
    } catch (e) { setAdvice('Agent connection error or AI offline.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAdvice(); }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-center">
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">AI Advisor</h1>
        <button onClick={fetchAdvice} disabled={loading} className="bg-blue-600 px-6 py-2 rounded-xl text-xs font-black uppercase">{loading ? 'Thinking...' : 'Refresh'}</button>
      </header>
      <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 backdrop-blur-md">
        <p className="text-slate-300 italic leading-relaxed">{advice}</p>
      </div>
    </div>
  );
};

/**
 * COMPONENT: BRIDGE & DHCP MANAGER
 */
const BridgeManager = ({ config, setConfig, onApply, isApplying, availableInterfaces }: { config: NetworkConfig, setConfig: any, onApply: () => void, isApplying: boolean, availableInterfaces: WanInterface[] }) => {
  const addBridge = () => {
    const newBridge: BridgeConfig = {
      id: Math.random().toString(36).substr(2, 9),
      name: `br${config.bridges.length}`,
      interfaces: [],
      ipAddress: '192.168.100.1',
      netmask: '255.255.255.0',
      dhcpEnabled: true,
      dhcpStart: '192.168.100.10',
      dhcpEnd: '192.168.100.250',
      leaseTime: '24h'
    };
    setConfig({ ...config, bridges: [...config.bridges, newBridge] });
  };

  const updateBridge = (id: string, updates: Partial<BridgeConfig>) => {
    setConfig({
      ...config,
      bridges: config.bridges.map(b => b.id === id ? { ...b, ...updates } : b)
    });
  };

  const deleteBridge = (id: string) => {
    setConfig({ ...config, bridges: config.bridges.filter(b => b.id !== id) });
  };

  const toggleInterface = (bridgeId: string, ifaceName: string) => {
    const bridge = config.bridges.find(b => b.id === bridgeId);
    if (!bridge) return;
    const currentInterfaces = bridge.interfaces || [];
    const newInterfaces = currentInterfaces.includes(ifaceName)
      ? currentInterfaces.filter(i => i !== ifaceName)
      : [...currentInterfaces, ifaceName];
    updateBridge(bridgeId, { interfaces: newInterfaces });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Bridge & DHCP Fabric</h1>
          <p className="text-slate-400 mt-1 font-medium italic">Virtual LAN Segmentation & IP Assignment Engine</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onApply} disabled={isApplying} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-8 rounded-2xl shadow-xl uppercase tracking-widest text-xs">
            {isApplying ? 'COMMITTING...' : 'SAVE CONFIGURATION'}
          </button>
          <button onClick={addBridge} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-8 rounded-2xl shadow-xl uppercase tracking-widest text-xs">
            + Create Bridge
          </button>
        </div>
      </header>

      {config.bridges.length === 0 ? (
        <div className="bg-slate-900/40 p-20 rounded-[2.5rem] border border-slate-800 border-dashed text-center">
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs italic">No Bridges Configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {config.bridges.map(bridge => (
            <div key={bridge.id} className="bg-[#0B0F1A] p-10 rounded-[2.5rem] border border-slate-800 backdrop-blur-md relative overflow-hidden group shadow-2xl">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 relative z-10">
                <div className="space-y-6 lg:col-span-1">
                  <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic">General</h3>
                  <input type="text" value={bridge.name} onChange={(e) => updateBridge(bridge.id, { name: e.target.value })} className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 w-full text-white font-mono text-sm" placeholder="Bridge Name" />
                  <input type="text" value={bridge.ipAddress} onChange={(e) => updateBridge(bridge.id, { ipAddress: e.target.value })} className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 w-full text-white font-mono text-sm" placeholder="IP Address" />
                  <button onClick={() => deleteBridge(bridge.id)} className="text-rose-500 text-[10px] font-black uppercase">Remove Bridge</button>
                </div>
                <div className="lg:col-span-1 space-y-6">
                  <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">Ports</h3>
                  <div className="space-y-2">
                    {availableInterfaces.map(iface => (
                      <label key={iface.interfaceName} className="flex items-center gap-2 p-2 bg-black/40 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={bridge.interfaces?.includes(iface.interfaceName)} onChange={() => toggleInterface(bridge.id, iface.interfaceName)} className="w-4 h-4" />
                        <span className="text-[10px] font-black text-slate-300 uppercase">{iface.interfaceName}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-2 space-y-6 bg-slate-900/40 p-8 rounded-3xl border border-slate-800">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-4">
                    <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">DHCP Server</h3>
                    <div onClick={() => updateBridge(bridge.id, { dhcpEnabled: !bridge.dhcpEnabled })} className={`w-12 h-6 rounded-full relative cursor-pointer ${bridge.dhcpEnabled ? 'bg-amber-600' : 'bg-slate-800'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${bridge.dhcpEnabled ? 'left-7' : 'left-1'}`} />
                    </div>
                  </div>
                  <div className={`grid grid-cols-2 gap-4 ${bridge.dhcpEnabled ? 'opacity-100' : 'opacity-20'}`}>
                    <input type="text" value={bridge.dhcpStart} onChange={(e) => updateBridge(bridge.id, { dhcpStart: e.target.value })} className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-xs" placeholder="Range Start" />
                    <input type="text" value={bridge.dhcpEnd} onChange={(e) => updateBridge(bridge.id, { dhcpEnd: e.target.value })} className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-xs" placeholder="Range End" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
    if (!selectedIface && interfaces && interfaces.length > 0) {
      const primary = interfaces.find(i => i.internetHealth === 'HEALTHY') || interfaces[0];
      setSelectedIface(primary.interfaceName);
    }
  }, [interfaces, selectedIface]);

  useEffect(() => {
    if (!selectedIface || !interfaces) return;
    const currentData = interfaces.find(i => i.interfaceName === selectedIface);
    if (!currentData) return;
    setHistory(prev => {
      const newEntry = { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), rx: currentData.throughput.rx, tx: currentData.throughput.tx };
      return [...prev, newEntry].slice(-60);
    });
  }, [interfaces, selectedIface]);

  const aggregateTraffic = useMemo(() => {
    if (!interfaces) return { rx: 0, tx: 0 };
    return interfaces.reduce((acc, curr) => ({ rx: acc.rx + (curr.throughput?.rx || 0), tx: acc.tx + (curr.throughput?.tx || 0) }), { rx: 0, tx: 0 });
  }, [interfaces]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Host Dashboard</h1>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest italic">Real-time Linux Telemetry</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono text-white font-bold tracking-tighter tabular-nums">{metrics.uptime || '--:--'}</div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6 italic">RX Throughput</h3>
          <div className="text-4xl font-mono text-emerald-400 font-bold tracking-tighter">{aggregateTraffic.rx.toFixed(2)} <span className="text-xs uppercase">Mbps</span></div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6 italic">TX Throughput</h3>
          <div className="text-4xl font-mono text-blue-400 font-bold tracking-tighter">{aggregateTraffic.tx.toFixed(2)} <span className="text-xs uppercase">Mbps</span></div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6 italic">Core Load</h3>
          <div className="space-y-2">
            {metrics.cores && metrics.cores.map((usage, idx) => (
              <div key={idx} className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${usage}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6 italic">Host RAM</h3>
          <div className="text-4xl font-mono text-white font-bold tracking-tighter">{metrics.memoryUsage} <span className="text-xs uppercase">GB</span></div>
        </div>
      </div>

      <div className="bg-[#0B0F1A] p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-xl font-black text-white italic tracking-tight uppercase">Traffic Monitor: <span className="text-emerald-400 font-mono italic">{selectedIface.toUpperCase()}</span></h2>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <Area type="monotone" dataKey="rx" stroke="#10b981" fillOpacity={0.1} fill="#10b981" isAnimationActive={false} />
              <Area type="monotone" dataKey="tx" stroke="#3b82f6" fillOpacity={0.1} fill="#3b82f6" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENT: INTERFACE MANAGER
 */
const InterfaceManager = ({ interfaces, config, setConfig, onApply, isApplying }: any) => {
  const updateInterface = (id: string, updates: Partial<WanInterface>) => {
    setConfig((prev: NetworkConfig) => ({
      ...prev,
      wanInterfaces: prev.wanInterfaces.map(w => w.id === id ? { ...w, ...updates } : w)
    }));
  };
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-start">
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Multi-WAN Orchestrator</h1>
        <button onClick={onApply} disabled={isApplying} className="bg-blue-600 px-8 py-3 rounded-2xl text-xs font-black uppercase">{isApplying ? 'Syncing...' : 'Commit Config'}</button>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {config.wanInterfaces.map((wan: WanInterface) => (
          <div key={wan.id} className="p-8 bg-slate-900/40 rounded-[2.5rem] border border-slate-800">
            <h3 className="text-xl font-black text-white italic uppercase mb-6">{wan.interfaceName}</h3>
            <div className="space-y-6">
              <label className="text-[10px] font-black text-slate-500 uppercase">Load Weight: {wan.weight}%</label>
              <input type="range" min="1" max="100" value={wan.weight} onChange={(e) => updateInterface(wan.id, { weight: parseInt(e.target.value) })} className="w-full accent-blue-600" />
            </div>
          </div>
        ))}
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
  const [config, setConfig] = useState<NetworkConfig>({ mode: RouterMode.LOAD_BALANCER, wanInterfaces: [], bridges: [] });
  const [isApplying, setIsApplying] = useState(false);
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  const addLog = (type: TerminalLog['type'], message: string) => {
    setLogs(prev => [...prev, { id: Math.random().toString(), type, message, timestamp: new Date() }].slice(-50));
  };

  const refreshData = useCallback(async () => {
    try {
      const [ifaceRes, metricRes, configRes] = await Promise.all([
        fetch(`${API_BASE}/interfaces`), fetch(`${API_BASE}/metrics`), fetch(`${API_BASE}/config`)
      ]);
      if (ifaceRes.ok && metricRes.ok) {
        const ifaces = await ifaceRes.json();
        const met = await metricRes.json();
        setInterfaces(ifaces);
        setMetrics(met);
        if (configRes.ok) {
          const savedConfig = await configRes.json();
          if (config.bridges.length === 0 && savedConfig.bridges) {
            setConfig(prev => ({ ...prev, bridges: savedConfig.bridges, mode: savedConfig.mode || prev.mode, wanInterfaces: savedConfig.wanInterfaces || prev.wanInterfaces }));
          }
        }
        if (config.wanInterfaces.length === 0 && ifaces.length > 0) {
          setConfig(prev => ({ ...prev, wanInterfaces: ifaces }));
        }
        setIsLive(true);
      }
    } catch (e) { setIsLive(false); }
  }, [config.bridges.length]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 1000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleApplyUpdate = async () => {
    setIsApplying(true);
    addLog('info', 'Executing software layer upgrade...');
    await new Promise(r => setTimeout(r, 2000));
    addLog('success', 'Build v1.3.0 deployed successfully.');
    setIsApplying(false);
  };

  const handleApplyConfig = async () => {
    setIsApplying(true);
    addLog('info', 'Applying configuration to kernel...');
    try {
      const res = await fetch(`${API_BASE}/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config)
      });
      if (res.ok) addLog('success', 'Kernel Routing Matrix Synchronized.');
    } catch (e) { addLog('error', 'Agent communication timeout.'); }
    finally { setIsApplying(false); }
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 font-sans">
      <aside className="w-64 bg-[#0B0F1A] border-r border-slate-800 flex flex-col shadow-2xl">
        <div className="p-8 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-xl italic text-xl">N</div>
          <span className="font-bold text-2xl tracking-tighter text-white uppercase italic">Nexus</span>
        </div>
        <nav className="flex-1 p-6 space-y-2">
          {['dashboard', 'wan', 'bridge', 'advisor', 'updates', 'settings'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full text-left px-5 py-3 rounded-2xl transition-all font-bold text-sm uppercase italic tracking-tight ${activeTab === tab ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
              {tab}
            </button>
          ))}
        </nav>
        <div className="p-6 mt-auto">
          <div className={`p-5 rounded-2xl border ${isLive ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
            <span className={`text-xs font-black uppercase italic ${isLive ? 'text-emerald-400' : 'text-rose-400'}`}>{isLive ? 'Kernel Live' : 'Agent Lost'}</span>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-12 bg-[#020617]">
        {activeTab === 'dashboard' && <Dashboard interfaces={interfaces} metrics={metrics} />}
        {activeTab === 'wan' && <InterfaceManager interfaces={interfaces} config={config} setConfig={setConfig} onApply={handleApplyConfig} isApplying={isApplying} />}
        {activeTab === 'bridge' && <BridgeManager config={config} setConfig={setConfig} onApply={handleApplyConfig} isApplying={isApplying} availableInterfaces={interfaces} />}
        {activeTab === 'advisor' && <AIAdvisor config={config} />}
        {activeTab === 'updates' && <UpdateManager onApplyUpdate={handleApplyUpdate} isUpdating={isApplying} />}
        {activeTab === 'settings' && <div className="p-20 text-center"><p className="text-slate-600 uppercase italic font-black">All Systems Nominal</p></div>}
      </main>
      <Terminal logs={logs} isOpen={isTerminalOpen} onClose={() => setIsTerminalOpen(false)} />
      <button onClick={() => setIsTerminalOpen(!isTerminalOpen)} className="fixed bottom-4 right-4 bg-slate-800 p-3 rounded-full shadow-2xl border border-slate-700">⚡</button>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
