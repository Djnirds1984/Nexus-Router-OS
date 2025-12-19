
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
          <div className="space-y-8 animate-in fade-in duration-700">
             <header>
                <h1 className="text-3xl font-bold text-white tracking-tight">System Runtime</h1>
                <p className="text-slate-400 mt-1">Ubuntu x86_64 host environment optimization.</p>
             </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-50"></div>
                  <h3 className="text-lg font-bold text-white mb-2">Kernel Forwarding</h3>
                  <p className="text-sm text-slate-500 mb-6">Status of IPv4/IPv6 packet traversal.</p>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></div>
                    <span className="text-xs font-mono text-emerald-400 font-bold">ENABLED</span>
                  </div>
               </div>

               <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 opacity-50"></div>
                  <h3 className="text-lg font-bold text-white mb-2">Security Hardening</h3>
                  <p className="text-sm text-slate-500 mb-6">Sysctl parameters for network protection.</p>
                  <button className="text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors">OPTIMIZE NOW →</button>
               </div>

               <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 opacity-50"></div>
                  <h3 className="text-lg font-bold text-white mb-2">Process Control</h3>
                  <p className="text-sm text-slate-500 mb-6">PM2 / Systemd service management.</p>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-400 font-mono">nginx:up</span>
                    <span className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-400 font-mono">pm2:active</span>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900/50 p-12 rounded-3xl border border-slate-800/50 text-center border-dashed">
              <div className="text-4xl mb-4">🛠️</div>
              <h2 className="text-xl font-bold text-white mb-2">Advanced Config</h2>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">Access low-level hardware offload settings and PCIe interface diagnostic tools.</p>
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
      
      {/* Footer Diagnostic Bar */}
      <div className="fixed bottom-0 right-0 left-64 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 px-6 py-2.5 flex items-center justify-between z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Runtime</span>
            <span className="text-[10px] font-mono text-blue-400 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">/var/www/html/nexus-os</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ownership</span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">www-data:www-data</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 mr-4">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Nginx Verified</span>
           </div>
           <button 
             onClick={() => setIsTerminalOpen(!isTerminalOpen)}
             className="text-[10px] font-black text-slate-300 hover:text-white transition-all bg-slate-800 hover:bg-slate-700 px-4 py-1.5 rounded-lg border border-slate-700 shadow-lg active:scale-95"
           >
             {isTerminalOpen ? 'CLOSE CONSOLE' : 'OPEN CONSOLE (ALT+T)'}
           </button>
        </div>
      </div>

      <Terminal logs={logs} isOpen={isTerminalOpen} onClose={() => setIsTerminalOpen(false)} />
    </Layout>
  );
};

export default App;
