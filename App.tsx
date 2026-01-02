import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Interfaces from './components/Interfaces';
import InterfaceManager from './components/InterfaceManager';
import AIAdvisor from './components/AIAdvisor';
import UpdateManager from './components/UpdateManager';
import Terminal from './components/Terminal';
import DeviceList from './components/DeviceList';
import WifiManager from './components/WifiManager';
import { NetworkConfig, RouterMode, SystemMetrics, TerminalLog, WanInterface } from './types';

const API_BASE = `http://${window.location.hostname || 'localhost'}:3000/api`;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [metrics, setMetrics] = useState<SystemMetrics>({ cpuUsage: 0, memoryUsage: 0, uptime: '0s', activeSessions: 0 });
  const [currentConfig, setCurrentConfig] = useState<NetworkConfig>({
    mode: RouterMode.LOAD_BALANCER,
    wanInterfaces: [],
    dnsServers: ['8.8.8.8', '1.1.1.1']
  });
  const [appliedConfig, setAppliedConfig] = useState<NetworkConfig>(currentConfig);
  const [isApplying, setIsApplying] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  // Fetch real data from hardware agent
  const refreshHardwareData = useCallback(async () => {
    try {
      const [ifRes, metRes] = await Promise.all([
        fetch(`${API_BASE}/interfaces`),
        fetch(`${API_BASE}/metrics`)
      ]);
      
      if (ifRes.ok && metRes.ok) {
        const ifaces: WanInterface[] = await ifRes.json();
        const metData = await metRes.json();
        
        // Convert string mem stats to numbers for the metrics state
        setMetrics({
          cpuUsage: metData.cpuUsage,
          memoryUsage: parseFloat(metData.memoryUsage),
          totalMem: parseFloat(metData.totalMem), // Added to metrics to show RAM stats
          uptime: metData.uptime,
          activeSessions: metData.activeSessions
        } as any);

        setCurrentConfig(prev => {
          // Keep current user-adjusted weights/priorities if they haven't been committed yet
          const mergedInterfaces = ifaces.map(realIface => {
            const existing = prev.wanInterfaces.find(p => p.interfaceName === realIface.interfaceName);
            return existing ? { ...realIface, weight: existing.weight, priority: existing.priority } : realIface;
          });
          
          return { ...prev, wanInterfaces: mergedInterfaces };
        });
      }
    } catch (e) {
      console.warn("Hardware Agent Link Failure");
    }
  }, []);

  useEffect(() => {
    refreshHardwareData();
    const timer = setInterval(refreshHardwareData, 1000); // 1s sync for "moving" effect
    return () => clearInterval(timer);
  }, [refreshHardwareData]);

  const addLog = useCallback((type: TerminalLog['type'], message: string) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type,
      message,
      timestamp: new Date()
    }].slice(-50));
  }, []);

  const handleApply = async () => {
    setIsApplying(true);
    setIsTerminalOpen(true);
    addLog('info', `Deploying routing tables for ${currentConfig.mode}...`);
    try {
      const res = await fetch(`${API_BASE}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfig)
      });
      if (res.ok) {
        addLog('success', 'Kernel Routing Matrix Synchronized.');
        setAppliedConfig({ ...currentConfig });
      } else {
        addLog('error', 'Agent rejected configuration update.');
      }
    } catch (err) {
      addLog('error', 'Hardware Agent communication timeout.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    setIsTerminalOpen(true);
    addLog('info', 'Executing software layer upgrade...');
    await new Promise(r => setTimeout(r, 2000));
    addLog('success', 'Build v1.3.0 deployed successfully.');
    setIsUpdating(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard wanInterfaces={currentConfig.wanInterfaces} metrics={metrics} />;
      case 'interfaces':
        return <Interfaces />;
      case 'wan':
        return (
          <InterfaceManager 
            config={currentConfig} 
            appliedConfig={appliedConfig}
            setConfig={setCurrentConfig} 
            onApply={handleApply}
            isApplying={isApplying}
          />
        );
      case 'devices':
        return <DeviceList />;
      case 'advisor':
        return <AIAdvisor config={currentConfig} />;
      case 'updates':
        return <UpdateManager onApplyUpdate={handleApplyUpdate} isUpdating={isUpdating} />;
      case 'settings':
        return (
          <div className="space-y-8 p-12 max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white uppercase italic tracking-widest">System Settings</h1>
              <p className="text-slate-400 mt-2">Hardware Configuration & Diagnostics</p>
            </div>
            
            <WifiManager />

            <div className="bg-slate-900/50 p-10 rounded-3xl border border-slate-800 border-dashed text-center">
               <div className="text-emerald-500 font-mono text-sm mb-4">KERNEL_VERSION: {metrics.uptime ? 'STABLE' : 'LINKING...'}</div>
               <p className="text-slate-500 text-xs uppercase tracking-widest font-black">All hardware systems nominal.</p>
            </div>
          </div>
        );
      default:
        return <Dashboard wanInterfaces={currentConfig.wanInterfaces} metrics={metrics} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="relative pb-24">
        {renderContent()}
      </div>
      
      <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 px-6 py-2.5 flex items-center justify-between z-40">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hardware Link</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Host</span>
            <span className="text-[10px] font-mono text-blue-400">ubuntu-router-x64</span>
          </div>
        </div>
        <button 
          onClick={() => setIsTerminalOpen(!isTerminalOpen)}
          className="text-[10px] font-black text-slate-300 hover:text-white transition-all bg-slate-800 px-4 py-1.5 rounded-lg border border-slate-700 active:scale-95"
        >
          {isTerminalOpen ? 'CLOSE CONSOLE' : 'SYSTEM LOGS'}
        </button>
      </div>

      <Terminal logs={logs} isOpen={isTerminalOpen} onClose={() => setIsTerminalOpen(false)} />
    </Layout>
  );
};

export default App;
