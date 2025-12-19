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
  memoryUsage: string;
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
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-blue-400 border border-blue-500/20 uppercase font-mono">{wan.interfaceName}</span>
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
 * COMPONENT: BRIDGE & DHCP MANAGER
 */
const BridgeManager = ({ allInterfaces, bridges, setBridges, onApply, activeWanNames }: any) => {
  const [newBridgeName, setNewBridgeName] = useState('br0');

  const availableForBridge = useMemo(() => {
    return allInterfaces.filter((iface: any) => !activeWanNames.includes(iface.interfaceName));
  }, [allInterfaces, activeWanNames]);

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

  const removeBridge = (id: string) => {
    setBridges(bridges.filter((b: any) => b.id !== id));
  };

  const toggleIface = (bridgeId: string, ifaceName: string) => {
    setBridges(bridges.map((b: any) => {
      if (b.id !== bridgeId) return b;
      const isMember = b.interfaces.includes(ifaceName);
      return {
        ...b,
        interfaces: isMember 
          ? b.interfaces.filter((i: string) => i !== ifaceName)
          : [...b.interfaces, ifaceName]
      };
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
                <button onClick={() => removeBridge(bridge.id)} className="text-rose-500 hover:text-rose-400 text-[10px] font-black uppercase tracking-widest bg-rose-500/5 px-3 py-1 rounded-lg border border-rose-500/10">DELETE</button>
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
                         {availableForBridge.length === 0 && (
                            <span className="text-[10px] text-slate-600 italic">No LAN-eligible ports available (All in WAN mode)</span>
                         )}
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
                           <input 
                             type="text" disabled={!bridge.dhcpEnabled}
                             value={bridge.dhcpStart}
                             onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, dhcpStart: e.target.value} : b))}
                             className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-300 outline-none focus:border-emerald-500 disabled:opacity-30"
                           />
                        </div>
                        <div>
                           <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">End IP</label>
                           <input 
                             type="text" disabled={!bridge.dhcpEnabled}
                             value={bridge.dhcpEnd}
                             onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, dhcpEnd: e.target.value} : b))}
                             className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-300 outline-none focus:border-emerald-500 disabled:opacity-30"
                           />
                        </div>
                      </div>
                      <div>
                         <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Lease Expiration</label>
                         <input 
                           type="text" disabled={!bridge.dhcpEnabled}
                           value={bridge.leaseTime}
                           onChange={e => setBridges(bridges.map((b: any) => b.id === bridge.id ? {...b, leaseTime: e.target.value} : b))}
                           className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-300 outline-none focus:border-emerald-500 disabled:opacity-30"
                         />
                      </div>
                   </div>
                </div>
             </div>
          </div>
        ))}

        <button 
          onClick={onApply}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all uppercase tracking-widest mt-6"
        >
          APPLY & SAVE CONFIG TO KERNEL
        </button>
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
        contents: `Analyze this real Ubuntu router configuration for optimization. Configuration: ${JSON.stringify(config)}. Provide performance tips, nftables commands, and security hardening.`,
      });
      setAdvice(response.text || 'No data returned from AI core.');
    } catch (e) {
      setAdvice('Connection to AI Neuralink interrupted.');
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900/60 p-10 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-md">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-white">Nexus AI Advisor</h2>
        <button onClick={getAdvice} disabled={loading} className="bg-blue-600 px-8 py-3 rounded-2xl text-xs font-bold text-white">
          {loading ? 'SYNCHRONIZING...' : 'ANALYZE TOPOLOGY'}
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
  const [metrics, setMetrics] = useState<SystemMetrics>({ cpuUsage: 0, memoryUsage: '0', temp: '0', uptime: '', activeSessions: 0 });
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
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const fixDnsConflict = async () => {
    try {
      const res = await fetch(`${API_BASE}/system/fix-dns-conflict`, { method: 'POST' });
      const data = await res.json();
      alert('DNS Conflict Resolution Result:\n' + data.log.join('\n'));
    } catch (e) { alert('Failed to fix DNS conflict.'); }
  };

  const commitConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
      const data = await res.json();
      if (data.success) alert('Sync Success:\n' + data.log.join('\n'));
    } catch(e) { alert('Sync Failed.'); }
  };

  const commitBridges = async () => {
    try {
      const res = await fetch(`${API_BASE}/bridges/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bridges }) });
      const data = await res.json();
      if (data.success) alert('Bridge Sync Success:\n' + data.log.join('\n'));
      refreshData();
    } catch(e) { alert('Bridge Sync Failed.'); }
  };

  const activeWanNames = useMemo(() => config.wanInterfaces.filter((wan: any) => wan.gateway && wan.gateway !== 'None').map((wan: any) => wan.interfaceName), [config.wanInterfaces]);
  const bridgedInterfaceNames = useMemo(() => bridges.flatMap(b => b.interfaces), [bridges]);
  const eligibleWanInterfaces = useMemo(() => config.wanInterfaces.filter((wan: any) => !bridgedInterfaceNames.includes(wan.interfaceName)), [config.wanInterfaces, bridgedInterfaceNames]);

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive}>
      {activeTab === 'dashboard' && <Dashboard wanInterfaces={config.wanInterfaces} metrics={metrics} />}
      {activeTab === 'wan' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="bg-slate-900/60 p-10 rounded-3xl border border-slate-800 backdrop-blur-md">
              <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Multi-WAN Orchestration</h2>
              
              {/* Mode Selection Grid */}
              <div className="flex gap-4 mb-10">
                 <button 
                   onClick={() => setConfig({...config, mode: RouterMode.LOAD_BALANCER})}
                   className={`flex-1 p-6 rounded-2xl border transition-all text-left group ${config.mode === RouterMode.LOAD_BALANCER ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                 >
                    <div className={`font-bold transition-colors ${config.mode === RouterMode.LOAD_BALANCER ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>Load Balancer (Active-Active)</div>
                    <div className="text-[11px] mt-1 opacity-60 font-mono">Parallel IP multiplexing for maximum aggregate bandwidth.</div>
                 </button>
                 <button 
                   onClick={() => setConfig({...config, mode: RouterMode.FAILOVER})}
                   className={`flex-1 p-6 rounded-2xl border transition-all text-left group ${config.mode === RouterMode.FAILOVER ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                 >
                    <div className={`font-bold transition-colors ${config.mode === RouterMode.FAILOVER ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>Auto Failover (High Availability)</div>
                    <div className="text-[11px] mt-1 opacity-60 font-mono">Priority-based routing with automatic outage recovery.</div>
                 </button>
              </div>

              <div className="grid grid-cols-1 gap-6 mb-10">
                {eligibleWanInterfaces.map((wan: any) => (
                  <div key={wan.id} className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 shadow-inner group transition-all hover:border-slate-600">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                       <div className="flex-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Custom Interface Identity</label>
                          <input 
                            type="text" 
                            value={wan.name} 
                            onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, name: e.target.value} : w)})}
                            className="bg-transparent border-b border-slate-800 focus:border-blue-500 outline-none text-xl font-bold text-white w-full md:w-64 pb-1"
                            placeholder="Rename interface..."
                          />
                       </div>
                       <div className="flex items-center gap-3">
                         <div className={`px-4 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase flex items-center gap-2 ${wan.status === WanStatus.UP ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${wan.status === WanStatus.UP ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></div>
                            {wan.status}
                         </div>
                         <span className="text-[10px] bg-slate-900 px-3 py-1.5 rounded border border-slate-800 text-blue-400 font-mono font-black uppercase tracking-widest">{wan.interfaceName}</span>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                       <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-600 font-black uppercase mb-1 tracking-widest">Global IP</div>
                          <div className="text-sm font-mono text-slate-300">{wan.ipAddress}</div>
                       </div>
                       <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-600 font-black uppercase mb-1 tracking-widest">Gateway</div>
                          <div className="text-sm font-mono text-slate-300">{wan.gateway}</div>
                       </div>
                       <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-600 font-black uppercase mb-1 tracking-widest">RX Throughput</div>
                          <div className="text-sm font-mono text-emerald-400 font-bold">{wan.throughput?.rx.toFixed(2) || '0.00'} Mbps</div>
                       </div>
                       <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-600 font-black uppercase mb-1 tracking-widest">TX Throughput</div>
                          <div className="text-sm font-mono text-blue-400 font-bold">{wan.throughput?.tx.toFixed(2) || '0.00'} Mbps</div>
                       </div>
                    </div>

                    {config.mode === RouterMode.LOAD_BALANCER ? (
                      <div className="space-y-3 bg-blue-600/5 p-4 rounded-xl border border-blue-500/10">
                        <div className="flex justify-between items-center">
                           <div className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Weight Distribution Value: <span className="text-white text-sm ml-2">{wan.weight || 1}</span></div>
                           <div className="text-[9px] text-slate-600 italic">High weight = More packets routed via this path</div>
                        </div>
                        <input 
                          type="range" min="1" max="100" value={wan.weight || 1}
                          onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, weight: parseInt(e.target.value)} : w)})}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 transition-all hover:accent-blue-400"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2 bg-purple-600/5 p-4 rounded-xl border border-purple-500/10">
                        <label className="text-[10px] text-purple-500 font-black uppercase tracking-widest block mb-2">Hierarchy Priority Index</label>
                        <select 
                          value={wan.priority || 1}
                          onChange={(e) => setConfig({...config, wanInterfaces: config.wanInterfaces.map((w: any) => w.id === wan.id ? {...w, priority: parseInt(e.target.value)} : w)})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-300 outline-none focus:border-purple-500 transition-all cursor-pointer"
                        >
                           <option value={1}>01 - PRIMARY INTERFACE (ACTIVE)</option>
                           <option value={2}>02 - SECONDARY BACKUP (HOT-STANDBY)</option>
                           <option value={3}>03 - EMERGENCY CHANNEL (FAILOVER)</option>
                        </select>
                      </div>
                    )}
                  </div>
                ))}
                {eligibleWanInterfaces.length === 0 && (
                   <div className="p-20 bg-slate-950/50 border border-dashed border-slate-800 rounded-2xl text-center flex flex-col items-center gap-4">
                      <div className="text-4xl grayscale opacity-30">🔌</div>
                      <div className="text-slate-500 text-sm font-mono uppercase tracking-widest">No available WAN hardware. (All ports are currently bridged)</div>
                   </div>
                )}
              </div>
              <button onClick={commitConfig} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all uppercase tracking-widest">APPLY & SAVE WAN CONFIG TO KERNEL</button>
           </div>
        </div>
      )}
      {activeTab === 'bridge' && <BridgeManager allInterfaces={config.wanInterfaces} bridges={bridges} setBridges={setBridges} onApply={commitBridges} activeWanNames={activeWanNames} />}
      {activeTab === 'advisor' && <AIAdvisor config={config} />}
      {activeTab === 'settings' && (
        <div className="bg-slate-900/60 p-12 rounded-3xl border border-slate-800 text-center">
           <h2 className="text-2xl font-bold text-white mb-6">System Diagnostic Tools</h2>
           <div className="bg-slate-950/80 p-8 rounded-2xl border border-rose-500/20 text-left max-w-xl mx-auto space-y-4">
              <h3 className="text-rose-400 font-bold flex items-center gap-2"><span>⚠️</span> DHCP / DNS Port Conflict Tool</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ubuntu's default <code className="text-blue-400">systemd-resolved</code> often occupies Port 53, preventing <code className="text-emerald-400">dnsmasq</code> from starting.
                Clicking the button below will disable the systemd listener to allow Nexus DHCP/DNS services to take control.
              </p>
              <button onClick={fixDnsConflict} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl text-xs font-black shadow-lg shadow-rose-600/20 active:scale-95 transition-all">
                FIX PORT 53 CONFLICT (systemd-resolved)
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
