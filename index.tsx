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
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-widest font-black">Kernel Link</div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isLive ? 'Hardware Native' : 'Connecting...'}
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
  const historyLimit = 60;

  useEffect(() => {
    if (!selectedIface && interfaces.length > 0) {
      setSelectedIface(interfaces[0].interfaceName);
    }
  }, [interfaces, selectedIface]);

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

  const activeIfaceData = useMemo(() => interfaces.find(i => i.interfaceName === selectedIface), [interfaces, selectedIface]);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">System Dashboard</h1>
          <p className="text-slate-400 mt-1 font-medium">Network Overview</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500 font-black tracking-widest uppercase">CPU Usage</div>
          <div className="text-2xl font-mono text-blue-400 font-bold">{metrics.cpuUsage.toFixed(1)}%</div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Memory</h3>
          <div className="text-3xl font-mono text-white font-bold">{metrics.memoryUsage} GB</div>
          <div className="text-xs text-slate-500 mt-1">/ {metrics.totalMem} GB Total</div>
        </div>
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Uptime</h3>
          <div className="text-xl font-mono text-white font-bold">{metrics.uptime || '0m'}</div>
        </div>
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Temperature</h3>
          <div className="text-3xl font-mono text-amber-500 font-bold">{metrics.temp || '--'}</div>
        </div>
      </div>

      <div className="bg-slate-900/60 p-8 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-4 bg-emerald-500 rounded-sm" /> Live Traffic: {selectedIface.toUpperCase()}
          </h2>
          <select 
            value={selectedIface}
            onChange={(e) => setSelectedIface(e.target.value)}
            className="bg-slate-950 text-blue-400 border border-slate-700 rounded-xl px-4 py-2 text-xs font-bold outline-none"
          >
            {interfaces.map(iface => (
              <option key={iface.interfaceName} value={iface.interfaceName}>{iface.interfaceName.toUpperCase()}</option>
            ))}
          </select>
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
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
              <Area name="RX" type="monotone" dataKey="rx" stroke="#10b981" strokeWidth={3} fill="url(#colorRx)" isAnimationActive={false} />
              <Area name="TX" type="monotone" dataKey="tx" stroke="#3b82f6" strokeWidth={3} fill="url(#colorTx)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENT: MULTI-WAN MANAGER
 */
const MultiWanManager = ({ config, setConfig, onApply, liveInterfaces, isSaving }: any) => {
  // Filter only interfaces that are NOT bridges and NOT members of bridges
  const filteredInterfaces = useMemo(() => {
    return liveInterfaces.filter((iface: WanInterface) => 
      !iface.interfaceName.startsWith('br') && !iface.isBridgeMember
    );
  }, [liveInterfaces]);

  // Synchronize config wanInterfaces with available ones
  useEffect(() => {
    const validNames = new Set(filteredInterfaces.map((i: any) => i.interfaceName));
    const cleaned = config.wanInterfaces.filter((w: any) => validNames.has(w.interfaceName));
    
    // Add missing ones if they are unassigned
    const currentNames = new Set(cleaned.map((w: any) => w.interfaceName));
    const toAdd = filteredInterfaces.filter((i: any) => !currentNames.has(i.interfaceName)).map((i: any) => ({
      id: i.id,
      name: i.name,
      interfaceName: i.interfaceName,
      weight: i.weight || 1,
      priority: i.priority || 1
    }));

    if (toAdd.length > 0) {
      setConfig({ ...config, wanInterfaces: [...cleaned, ...toAdd] });
    } else if (cleaned.length !== config.wanInterfaces.length) {
      setConfig({ ...config, wanInterfaces: cleaned });
    }
  }, [filteredInterfaces]);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900/60 p-10 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-6">Multi-WAN Orchestration</h2>
        <div className="flex gap-4 mb-10">
          <button onClick={() => setConfig({...config, mode: RouterMode.LOAD_BALANCER})} className={`flex-1 p-6 rounded-2xl border transition-all text-left ${config.mode === RouterMode.LOAD_BALANCER ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-950/50 border-slate-800 text-slate-500'}`}>
            <div className="font-bold">Load Balancer</div>
            <div className="text-[11px] mt-1 opacity-60">Multiplex traffic across all ports.</div>
          </button>
          <button onClick={() => setConfig({...config, mode: RouterMode.FAILOVER})} className={`flex-1 p-6 rounded-2xl border transition-all text-left ${config.mode === RouterMode.FAILOVER ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-950/50 border-slate-800 text-slate-500'}`}>
            <div className="font-bold">Auto Failover</div>
            <div className="text-[11px] mt-1 opacity-60">Backup port logic for 24/7 uptime.</div>
          </button>
        </div>

        <div className="space-y-6 mb-10">
          {config.wanInterfaces.length === 0 ? (
            <div className="p-12 border-2 border-dashed border-slate-800 rounded-3xl text-center text-slate-500">
              No WAN-eligible interfaces. (Ports used in Bridges are automatically excluded here).
            </div>
          ) : config.wanInterfaces.map((wan: any) => {
            const live = liveInterfaces.find((l: any) => l.interfaceName === wan.interfaceName) || wan;
            return (
              <div key={wan.id} className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-6">
                   <div className="text-xl font-bold text-white">{live.interfaceName.toUpperCase()} <span className="text-xs text-slate-500 font-normal">({wan.name})</span></div>
                   <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase border ${live.status === WanStatus.UP ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>{live.status}</span>
                </div>
                {config.mode === RouterMode.LOAD_BALANCER ? (
                  <div className="space-y-2">
                    <label className="text-[10px] text-blue-500 font-black uppercase">Weight: {wan.weight}%</label>
                    <input type="range" min="1" max="100" value={wan.weight} onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, weight: parseInt(e.target.value)} : w)})} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  </div>
                ) : (
                  <select value={wan.priority} onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, priority: parseInt(e.target.value)} : w)})} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300">
                    <option value={1}>PRIMARY (P1)</option>
                    <option value={2}>BACKUP (P2)</option>
                    <option value={3}>COLD STANDBY (P3)</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
        <button 
          onClick={onApply} 
          disabled={isSaving || config.wanInterfaces.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold uppercase tracking-widest shadow-xl transition-all"
        >
          {isSaving ? 'APPLYING...' : 'SYNC WAN TO KERNEL'}
        </button>
      </div>
    </div>
  );
};

/**
 * COMPONENT: BRIDGE MANAGER
 */
const BridgeManager = ({ liveInterfaces, bridges, setBridges, onApply, isSaving }: any) => {
  const [newBridgeName, setNewBridgeName] = useState('br0');
  
  const addBridge = () => {
    const newBridge: BridgeConfig = { id: Math.random().toString(36).substr(2, 9), name: newBridgeName, interfaces: [], ipAddress: '192.168.10.1', netmask: '24', dhcpEnabled: true, dhcpStart: '192.168.10.100', dhcpEnd: '192.168.10.200', leaseTime: '12h' };
    setBridges([...bridges, newBridge]);
  };

  const toggleInterface = (bridgeId: string, ifaceName: string) => {
    setBridges(bridges.map((b: any) => {
      if (b.id !== bridgeId) return b;
      const isMember = b.interfaces.includes(ifaceName);
      return { 
        ...b, 
        interfaces: isMember ? b.interfaces.filter((i: string) => i !== ifaceName) : [...b.interfaces, ifaceName] 
      };
    }));
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Bridge & DHCP</h1>
          <p className="text-slate-500 text-sm">Create LAN segments from physical ports.</p>
        </div>
        <div className="flex gap-2">
          <input type="text" value={newBridgeName} onChange={e => setNewBridgeName(e.target.value)} className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-white outline-none w-24" />
          <button onClick={addBridge} className="bg-blue-600 px-6 py-2 rounded-xl text-xs font-bold text-white">ADD BRIDGE</button>
        </div>
      </header>

      {bridges.map((bridge: BridgeConfig) => (
        <div key={bridge.id} className="bg-slate-900/60 p-8 rounded-3xl border border-slate-800 shadow-xl">
          <div className="flex justify-between items-start mb-6">
             <h3 className="text-xl font-bold text-white">{bridge.name}</h3>
             <button onClick={() => setBridges(bridges.filter((b: any) => b.id !== bridge.id))} className="text-rose-500 text-xs font-bold uppercase">REMOVE</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="space-y-4">
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Select Ports (Excludes from WAN)</div>
                <div className="flex flex-wrap gap-2">
                   {liveInterfaces.filter((i:any) => !i.interfaceName.startsWith('br')).map((iface: any) => {
                      const isTakenByOther = bridges.some((b: any) => b.id !== bridge.id && b.interfaces.includes(iface.interfaceName));
                      return (
                        <button 
                          key={iface.id} 
                          disabled={isTakenByOther}
                          onClick={() => toggleInterface(bridge.id, iface.interfaceName)}
                          className={`px-4 py-2 rounded-xl border text-[10px] font-black transition-all ${bridge.interfaces.includes(iface.interfaceName) ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-900 text-slate-500 border-slate-800'} ${isTakenByOther ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                           {iface.interfaceName.toUpperCase()}
                        </button>
                      );
                   })}
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <input type="text" value={bridge.ipAddress} onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, ipAddress: e.target.value} : b))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white" placeholder="LAN IP" />
                   <input type="text" value={bridge.netmask} onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, netmask: e.target.value} : b))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white" placeholder="Mask (CIDR)" />
                </div>
             </div>
             <div className={`p-6 rounded-2xl border transition-all ${bridge.dhcpEnabled ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-950/50 border-slate-800'}`}>
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-sm font-bold text-white uppercase tracking-widest">DHCP Status</h4>
                  <button onClick={() => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, dhcpEnabled: !b.dhcpEnabled} : b))} className={`px-6 py-1.5 rounded-full text-[10px] font-black transition-all ${bridge.dhcpEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                     {bridge.dhcpEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" value={bridge.dhcpStart} onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, dhcpStart: e.target.value} : b))} className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300" placeholder="Start IP" disabled={!bridge.dhcpEnabled} />
                  <input type="text" value={bridge.dhcpEnd} onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, dhcpEnd: e.target.value} : b))} className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300" placeholder="End IP" disabled={!bridge.dhcpEnabled} />
                </div>
             </div>
          </div>
        </div>
      ))}
      <button onClick={onApply} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold uppercase tracking-widest shadow-xl transition-all">
        {isSaving ? 'APPLYING TO KERNEL...' : 'SAVE BRIDGE SETTINGS'}
      </button>
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
        
        if (!isInitialized) {
          setBridges(sBridges || []);
          setWanConfig({ 
             mode: RouterMode.LOAD_BALANCER, 
             wanInterfaces: ifaces
              .filter((i:any) => !i.interfaceName.startsWith('br') && !i.isBridgeMember)
              .map((i:any) => ({
                id: i.id,
                name: i.name,
                interfaceName: i.interfaceName,
                weight: i.weight || 1,
                priority: i.priority || 1
             }))
          });
          setIsInitialized(true);
        }
        setIsLive(true);
      }
    } catch (e) { setIsLive(false); }
  }, [isInitialized]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 2000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const commitWan = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/apply`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(wanConfig) 
      });
      if (res.ok) alert('Multi-WAN Routing Applied.');
      else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch(e) { alert('Network Error.'); }
    setIsSaving(false);
  };

  const commitBridges = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/bridges/apply`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ bridges }) 
      });
      if (res.ok) alert('Bridge Topology Applied. (Interfaces assigned to bridges are now excluded from WAN)');
      else alert('Error Applying Bridges.');
    } catch(e) { alert('Network Error.'); }
    setIsSaving(false);
  };

  const rescueInternet = async () => {
     if (!confirm("Rescue Mode will attempt to restore basic internet by wiping routing tables and forcing a single gateway. Proceed?")) return;
     try {
        await fetch(`${API_BASE}/apply`, { 
           method: 'POST', 
           headers: { 'Content-Type': 'application/json' }, 
           body: JSON.stringify({ mode: 'FAILOVER', wanInterfaces: interfaces.map(i => ({...i, priority: 1})) }) 
        });
        alert("Rescue sequence completed. Check connectivity.");
        window.location.reload();
     } catch(e) { alert("Rescue failed."); }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive}>
      {activeTab === 'dashboard' && <Dashboard interfaces={interfaces} metrics={metrics} />}
      {activeTab === 'wan' && <MultiWanManager config={wanConfig} setConfig={setWanConfig} onApply={commitWan} liveInterfaces={interfaces} isSaving={isSaving} />}
      {activeTab === 'bridge' && <BridgeManager liveInterfaces={interfaces} bridges={bridges} setBridges={setBridges} onApply={commitBridges} isSaving={isSaving} />}
      {activeTab === 'settings' && (
        <div className="bg-slate-900/60 p-12 rounded-3xl border border-slate-800 text-center shadow-2xl">
           <h2 className="text-2xl font-bold text-white mb-8 tracking-tight">System Identity</h2>
           <div className="bg-rose-500/5 p-8 rounded-3xl border border-rose-500/20 max-w-xl mx-auto space-y-4">
             <h3 className="text-rose-500 font-black text-xs uppercase mb-4 tracking-[0.2em]">Safety & Rescue Tools</h3>
             <button onClick={rescueInternet} className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-xl text-xs font-black shadow-lg shadow-amber-600/20 active:scale-95 transition-all">
                EMERGENCY CONNECTIVITY RESCUE
             </button>
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
