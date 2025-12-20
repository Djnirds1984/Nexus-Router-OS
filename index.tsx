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

/**
 * API DISCOVERY
 */
const getApiBase = () => {
  const host = window.location.hostname || 'localhost';
  return `http://${host}:3000/api`;
};

const API_BASE = getApiBase();

/**
 * COMPONENT: BRIDGE & DHCP MANAGER
 */
const BridgeManager = ({ config, setConfig, onApply, isApplying }: { config: NetworkConfig, setConfig: any, onApply: () => void, isApplying: boolean }) => {
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

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Bridge & DHCP Fabric</h1>
          <p className="text-slate-400 mt-1 font-medium">Virtual LAN Segmentation & IP Assignment Engine</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={onApply}
            disabled={isApplying}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-8 rounded-2xl shadow-xl shadow-blue-600/20 disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center gap-2"
          >
            {isApplying ? 'COMMITTING...' : 'SAVE CONFIGURATION'}
          </button>
          <button 
            onClick={addBridge}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-8 rounded-2xl shadow-xl shadow-emerald-600/20 transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center gap-2"
          >
            <span>+</span> Create Bridge
          </button>
        </div>
      </header>

      {config.bridges.length === 0 ? (
        <div className="bg-slate-900/40 p-20 rounded-[2.5rem] border border-slate-800 border-dashed text-center">
          <div className="text-4xl mb-4 opacity-20">🌉</div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No Bridges Configured</p>
          <p className="text-slate-600 text-[10px] mt-2 uppercase">Interface definitions are pulled from nexus-config.json</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {config.bridges.map(bridge => (
            <div key={bridge.id} className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <div className="text-8xl font-black italic uppercase tracking-tighter">{bridge.name}</div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative z-10">
                {/* Bridge Basics */}
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Bridge Name</label>
                    <input 
                      type="text" 
                      value={bridge.name} 
                      onChange={(e) => updateBridge(bridge.id, { name: e.target.value })}
                      className="bg-black/40 border border-slate-800 rounded-xl px-5 py-3 w-full text-white font-mono font-bold outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Local IP Address</label>
                    <input 
                      type="text" 
                      value={bridge.ipAddress} 
                      onChange={(e) => updateBridge(bridge.id, { ipAddress: e.target.value })}
                      className="bg-black/40 border border-slate-800 rounded-xl px-5 py-3 w-full text-white font-mono font-bold outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <button 
                    onClick={() => deleteBridge(bridge.id)}
                    className="text-rose-500 text-[10px] font-black uppercase tracking-widest hover:text-rose-400 transition-colors"
                  >
                    Remove Bridge
                  </button>
                </div>

                {/* DHCP Settings */}
                <div className="lg:col-span-2 space-y-6 bg-black/20 p-8 rounded-3xl border border-slate-800/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest italic">DHCP Server Configuration</h3>
                    <div 
                      onClick={() => updateBridge(bridge.id, { dhcpEnabled: !bridge.dhcpEnabled })}
                      className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${bridge.dhcpEnabled ? 'bg-emerald-600' : 'bg-slate-800'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${bridge.dhcpEnabled ? 'left-7' : 'left-1'}`} />
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity ${bridge.dhcpEnabled ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Range Start</label>
                      <input 
                        type="text" 
                        value={bridge.dhcpStart} 
                        onChange={(e) => updateBridge(bridge.id, { dhcpStart: e.target.value })}
                        className="bg-black/40 border border-slate-800 rounded-xl px-5 py-3 w-full text-white font-mono font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Range End</label>
                      <input 
                        type="text" 
                        value={bridge.dhcpEnd} 
                        onChange={(e) => updateBridge(bridge.id, { dhcpEnd: e.target.value })}
                        className="bg-black/40 border border-slate-800 rounded-xl px-5 py-3 w-full text-white font-mono font-bold outline-none"
                      />
                    </div>
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
 * COMPONENT: SYSTEM SETTINGS
 */
const SystemSettings = ({ metrics }: { metrics: SystemMetrics }) => {
  const [ipForwarding, setIpForwarding] = useState(true);
  const [bbr, setBbr] = useState(true);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">System Core</h1>
        <p className="text-slate-400 mt-1 font-medium">Kernel Diagnostics & Global Optimization Control</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Core Control */}
        <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 backdrop-blur-md">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Networking Fabric</h3>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-6 bg-black/20 rounded-2xl border border-slate-800/50">
              <div>
                <div className="text-white font-bold text-sm uppercase tracking-tight mb-1">IP Forwarding</div>
                <div className="text-slate-500 text-[10px] font-medium leading-relaxed uppercase">Enable kernel packet routing between interfaces</div>
              </div>
              <div 
                onClick={() => setIpForwarding(!ipForwarding)}
                className={`w-14 h-7 rounded-full relative cursor-pointer transition-colors ${ipForwarding ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-slate-800'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${ipForwarding ? 'left-8' : 'left-1'}`} />
              </div>
            </div>

            <div className="flex items-center justify-between p-6 bg-black/20 rounded-2xl border border-slate-800/50">
              <div>
                <div className="text-white font-bold text-sm uppercase tracking-tight mb-1">TCP BBR Optimization</div>
                <div className="text-slate-500 text-[10px] font-medium leading-relaxed uppercase">Google's Bottleneck Bandwidth and RTT algorithm</div>
              </div>
              <div 
                onClick={() => setBbr(!bbr)}
                className={`w-14 h-7 rounded-full relative cursor-pointer transition-colors ${bbr ? 'bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${bbr ? 'left-8' : 'left-1'}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 backdrop-blur-md flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Maintenance Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black py-4 px-6 rounded-2xl border border-slate-700 text-[10px] uppercase tracking-[0.2em] transition-all">Flush Logs</button>
              <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black py-4 px-6 rounded-2xl border border-slate-700 text-[10px] uppercase tracking-[0.2em] transition-all">Clear ARP</button>
              <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black py-4 px-6 rounded-2xl border border-slate-700 text-[10px] uppercase tracking-[0.2em] transition-all">Fix DNS Port 53</button>
              <button className="bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 font-black py-4 px-6 rounded-2xl border border-rose-500/20 text-[10px] uppercase tracking-[0.2em] transition-all">Reboot Agent</button>
            </div>
          </div>

          <div className="mt-12 p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
            <div className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2">Build Signature</div>
            <div className="text-xs font-mono text-slate-400">NEXUS_OS_CORE v1.3.0_LINUX_X64_RELEASE</div>
            <div className="text-[10px] text-slate-600 mt-1 uppercase font-bold tracking-tighter">Authorized deployment only</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * COMPONENT: INTERFACE MANAGER (MULTI-WAN)
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
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto relative bg-[#020617] scroll-smooth">
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
    if (!selectedIface && interfaces.length > 0) {
      const primary = interfaces.find(i => i.internetHealth === 'HEALTHY') || interfaces[0];
      setSelectedIface(primary.interfaceName);
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
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Host Dashboard</h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Real-time Linux Router Telemetry</p>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${metrics.dnsResolved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'}`}>
              {metrics.dnsResolved ? 'Internet: Linked' : 'Internet: Failed'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-600 font-black tracking-widest uppercase mb-1">Session Duration</div>
          <div className="text-2xl font-mono text-white font-bold tracking-tighter tabular-nums">{metrics.uptime || '--:--:--'}</div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Aggregate RX</h3>
          <div className="text-4xl font-mono text-emerald-400 font-bold tracking-tighter tabular-nums">{aggregateTraffic.rx.toFixed(2)} <span className="text-sm font-sans font-medium text-slate-500 uppercase tracking-widest">Mbps</span></div>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Aggregate TX</h3>
          <div className="text-4xl font-mono text-blue-400 font-bold tracking-tighter tabular-nums">{aggregateTraffic.tx.toFixed(2)} <span className="text-sm font-sans font-medium text-slate-500 uppercase tracking-widest">Mbps</span></div>
        </div>
        
        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md overflow-hidden">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Multi-Core Usage</h3>
          <div className="space-y-3 custom-scrollbar max-h-40 overflow-y-auto">
             {metrics.cores && metrics.cores.length > 0 ? metrics.cores.map((usage, idx) => (
                <div key={idx} className="group">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest group-hover:text-blue-400 transition-colors">CPU {idx}</span>
                    <span className="text-[10px] font-mono text-white font-bold">{usage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-800/50">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out ${usage > 80 ? 'bg-rose-500' : usage > 50 ? 'bg-amber-500' : 'bg-blue-500'} shadow-[0_0_8px_currentColor] opacity-90`} 
                      style={{ width: `${usage}%`, color: usage > 80 ? '#f43f5e' : usage > 50 ? '#f59e0b' : '#3b82f6' }} 
                    />
                  </div>
                </div>
             )) : (
                <div className="text-4xl font-mono text-white font-bold tabular-nums tracking-tighter">{metrics.cpuUsage.toFixed(0)}%</div>
             )}
          </div>
        </div>

        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl backdrop-blur-md">
          <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6">Physical RAM</h3>
          <div className="text-4xl font-mono text-white font-bold tracking-tighter tabular-nums">{metrics.memoryUsage} <span className="text-sm font-sans font-medium text-slate-500 uppercase tracking-widest">GB</span></div>
          <div className="mt-2 text-[10px] text-slate-600 font-black uppercase tracking-widest italic">Used of {metrics.totalMem} GB Host Total</div>
          <div className="mt-3 w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-800/50">
             <div className="h-full bg-slate-400 transition-all duration-700" style={{ width: `${(parseFloat(metrics.memoryUsage)/parseFloat(metrics.totalMem || "1"))*100}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#0B0F1A] p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase italic tracking-tight">
              <span className="w-2 h-6 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              Traffic Monitor: <span className="text-emerald-400 font-mono tracking-tighter">{selectedIface.toUpperCase()}</span>
            </h2>
            <select 
              value={selectedIface}
              onChange={(e) => setSelectedIface(e.target.value)}
              className="bg-slate-950 text-blue-400 border border-slate-800 rounded-2xl px-6 py-2.5 text-xs font-black outline-none font-mono focus:border-blue-500 cursor-pointer uppercase"
            >
              {interfaces.map(iface => (
                <option key={iface.interfaceName} value={iface.interfaceName}>{iface.interfaceName}</option>
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
              <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-blue-400 font-mono border border-blue-500/20 uppercase tracking-widest font-black">Link Live</span>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {interfaces.map(iface => (
                <div 
                  key={iface.id} 
                  onClick={() => setSelectedIface(iface.interfaceName)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between ${selectedIface === iface.interfaceName ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'}`}
                >
                   <div className="flex items-center gap-4">
                      <div className={`w-2.5 h-2.5 rounded-full ${iface.internetHealth === 'HEALTHY' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]'}`} />
                      <div>
                        <div className="text-sm font-black text-white font-mono uppercase tracking-tighter">{iface.interfaceName}</div>
                        <div className="text-[10px] text-slate-500 font-mono tracking-tight tabular-nums">{iface.ipAddress}</div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className={`text-xs font-mono font-black ${iface.internetHealth === 'HEALTHY' ? 'text-emerald-400' : 'text-rose-500'}`}>{iface.latency}ms</div>
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
  const [config, setConfig] = useState<NetworkConfig>({ mode: RouterMode.LOAD_BALANCER, wanInterfaces: [], bridges: [] });
  const [isApplying, setIsApplying] = useState(false);

  const refreshData = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const [ifaceRes, metricRes, configRes] = await Promise.all([
        fetch(`${API_BASE}/interfaces`, { signal: controller.signal }),
        fetch(`${API_BASE}/metrics`, { signal: controller.signal }),
        fetch(`${API_BASE}/config`, { signal: controller.signal })
      ]);
      clearTimeout(timeoutId);

      if (ifaceRes.ok && metricRes.ok) {
        const ifaces = await ifaceRes.json();
        const met = await metricRes.json();
        setInterfaces(ifaces);
        setMetrics(met);
        
        // Load settings from config endpoint
        if (configRes.ok) {
          const savedConfig = await configRes.json();
          // Initial sync of bridge/wan settings
          if (config.bridges.length === 0 && savedConfig.bridges && savedConfig.bridges.length > 0) {
            setConfig(prev => ({ ...prev, bridges: savedConfig.bridges }));
          }
        }

        if (config.wanInterfaces.length === 0 && ifaces.length > 0) {
          setConfig(prev => ({ ...prev, wanInterfaces: ifaces }));
        }
        setIsLive(true);
      } else {
        setIsLive(false);
      }
    } catch (e) { setIsLive(false); }
  }, [config]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 1000); 
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
      if (res.ok) alert("KERNEL SYNC: Configuration tables updated successfully.");
    } catch (e) { alert("AGENT ERROR: Communication lost."); }
    finally { setIsApplying(false); }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isLive={isLive}>
      {activeTab === 'dashboard' && <Dashboard interfaces={interfaces} metrics={metrics} />}
      {activeTab === 'wan' && <InterfaceManager interfaces={interfaces} config={config} setConfig={setConfig} onApply={handleApplyConfig} isApplying={isApplying} />}
      {activeTab === 'bridge' && <BridgeManager config={config} setConfig={setConfig} onApply={handleApplyConfig} isApplying={isApplying} />}
      {activeTab === 'advisor' && <div className="p-32 text-center text-slate-700 font-mono text-xs tracking-widest uppercase opacity-40">AI Advisor Online</div>}
      {activeTab === 'settings' && <SystemSettings metrics={metrics} />}
    </Layout>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
