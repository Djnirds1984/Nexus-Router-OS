
import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import InterfaceManager from './components/InterfaceManager';
import AIAdvisor from './components/AIAdvisor';
import UpdateManager from './components/UpdateManager';
import Terminal from './components/Terminal';
import { NetworkConfig, RouterMode, SystemMetrics, TerminalLog } from './types';
import { INITIAL_WAN_INTERFACES, getMockMetrics, simulateTraffic } from './services/mockNetworkService';
import { getNetworkAdvice } from './services/geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [metrics, setMetrics] = useState<SystemMetrics>(getMockMetrics());
  const [currentConfig, setCurrentConfig] = useState<NetworkConfig>({
    mode: RouterMode.LOAD_BALANCER,
    wanInterfaces: INITIAL_WAN_INTERFACES,
    dnsServers: ['8.8.8.8', '1.1.1.1']
  });
  const [appliedConfig, setAppliedConfig] = useState<NetworkConfig>(currentConfig);
  const [isApplying, setIsApplying] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  // Update metrics and traffic periodically
  useEffect(() => {
    const timer = setInterval(() => {
      setMetrics(getMockMetrics());
      setCurrentConfig(prev => ({
        ...prev,
        wanInterfaces: prev.wanInterfaces.map(simulateTraffic)
      }));
      setAppliedConfig(prev => ({
        ...prev,
        wanInterfaces: prev.wanInterfaces.map(simulateTraffic)
      }));
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  const addLog = (type: TerminalLog['type'], message: string) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type,
      message,
      timestamp: new Date()
    }].slice(-50));
  };

  const handleApply = async () => {
    setIsApplying(true);
    setIsTerminalOpen(true);
    addLog('info', `Initiating configuration deployment for ${currentConfig.mode}...`);
    try {
      addLog('info', 'Contacting Nexus AI for optimized command sequences...');
      const advice = await getNetworkAdvice(currentConfig);
      addLog('info', 'Generated command pipeline:');
      for (const cmd of advice.commands) {
        addLog('command', cmd);
        await new Promise(r => setTimeout(r, 600));
        addLog('success', `Executed: OK`);
      }
      addLog('success', 'Configuration successfully synchronized with kernel.');
      setAppliedConfig({ ...currentConfig });
    } catch (err) {
      addLog('error', 'Critical failure during kernel synchronization.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    setIsTerminalOpen(true);
    addLog('info', 'Connecting to github.com/Djnirds1984/Nexus-Router-OS...');
    
    const updateSteps = [
      { cmd: 'git remote -v', msg: 'Verifying upstream repository...' },
      { cmd: 'git fetch origin main', msg: 'Fetching delta packets from main branch...' },
      { cmd: 'git pull origin main', msg: 'Applying filesystem patches...' },
      { cmd: 'npm install --frozen-lockfile', msg: 'Re-evaluating dependency tree...' },
      { cmd: 'npm run build', msg: 'Building optimized production bundles...' },
      { cmd: 'systemctl restart nginx', msg: 'Purging edge cache and restarting proxy...' }
    ];

    for (const step of updateSteps) {
      addLog('info', step.msg);
      addLog('command', step.cmd);
      await new Promise(r => setTimeout(r, 1000));
      addLog('success', 'OK');
    }

    addLog('success', 'System upgraded to v1.2.5. Initializing hot-reload...');
    setTimeout(() => {
      setIsUpdating(false);
      window.location.reload();
    }, 2000);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard wanInterfaces={currentConfig.wanInterfaces} metrics={metrics} />;
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
      case 'advisor':
        return <AIAdvisor config={currentConfig} />;
      case 'updates':
        return <UpdateManager onApplyUpdate={handleApplyUpdate} isUpdating={isUpdating} />;
      case 'settings':
        return (
          <div className="bg-slate-900 p-12 rounded-2xl border border-slate-800 text-center animate-in fade-in zoom-in-95 shadow-2xl">
            <h1 className="text-2xl font-bold text-white mb-4">Kernel & System Runtime</h1>
            <p className="text-slate-400 max-w-md mx-auto mb-8">Low-level optimization for Ubuntu x86_64 host system.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {[
                { label: 'Sysctl Hardening', desc: 'IPv4/IPv6 forwarding & hardening' },
                { label: 'SSH Hardening', desc: 'Key-based auth & port change' },
                { label: 'Hardware Offload', desc: 'SR-IOV & DPDK settings' },
                { label: 'Firmware Updates', desc: 'Check for microcode updates' }
              ].map(item => (
                <div key={item.label} className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-left hover:border-blue-500/50 transition-all cursor-pointer group active:scale-95 shadow-lg shadow-black/20">
                  <div className="font-bold text-white group-hover:text-blue-400 transition-colors">{item.label}</div>
                  <div className="text-xs text-slate-500 mt-1 uppercase tracking-tight opacity-70">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return <Dashboard wanInterfaces={currentConfig.wanInterfaces} metrics={metrics} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
      <Terminal logs={logs} isOpen={isTerminalOpen} onClose={() => setIsTerminalOpen(false)} />
    </Layout>
  );
};

export default App;
