import React, { useState, useEffect, useRef } from 'react';

interface UpdateManagerProps {
  onApplyUpdate: () => void;
  isUpdating: boolean;
}

interface Commit {
  hash: string;
  msg: string;
  author: string;
  date: string;
}

const UpdateManager: React.FC<UpdateManagerProps> = ({ onApplyUpdate, isUpdating }) => {
  const [gitRepo, setGitRepo] = useState('https://github.com/Djnirds1984/Nexus-Router-OS.git');
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [logs, setLogs] = useState<string[]>(['Ready for system maintenance.']);
  const [showCommitHistory, setShowCommitHistory] = useState(false);
  const [backupExists, setBackupExists] = useState(true);

  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-10));
  };

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const checkUpdates = () => {
    setChecking(true);
    addLog(`Probing repository: ${gitRepo}...`);
    // Simulate GitHub API fetch
    setTimeout(() => {
      setChecking(false);
      setUpdateAvailable(true);
      setShowCommitHistory(true);
      addLog('New build v1.2.5 detected on branch [main].');
    }, 1500);
  };

  const handleUpdate = () => {
    addLog('Initiating Pre-Update Snapshot...');
    setTimeout(() => {
      addLog('Backup Snapshot Created: nexus_backup_stable_prev.tar.gz');
      onApplyUpdate();
      addLog('Kernel patch in progress...');
    }, 1000);
  };

  const handleRestore = () => {
    if (confirm('DANGER: System will rollback to the last stable snapshot. All unsaved changes will be lost. Proceed?')) {
      addLog('RESTORE INITIATED: Reverting kernel and UI layers...');
      setTimeout(() => {
        addLog('Rollback Successful. System state: v1.2.4-STABLE');
        alert('System restored to last fixed version.');
      }, 2000);
    }
  };

  const downloadBackup = () => {
    addLog('Generating configuration archive...');
    setTimeout(() => {
      addLog('Download ready: nexus_recovery_bundle.zip');
      // Simple simulation of a download
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent("Nexus Recovery Key: " + Math.random().toString(36)));
      element.setAttribute('download', "nexus_recovery.txt");
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }, 800);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">System Updater</h1>
          <p className="text-slate-400 mt-1 font-medium italic">Continuous Deployment & Disaster Recovery Engine</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Build</div>
            <div className="text-emerald-400 font-mono text-sm font-bold">v1.2.4-stable</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Repo & Update Control */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 backdrop-blur-md">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-2xl shadow-inner">🐙</div>
              <div>
                <h3 className="text-lg font-black text-white uppercase italic tracking-tight">Source Repository</h3>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Point to the deployment branch</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input 
                  type="text" 
                  value={gitRepo}
                  onChange={(e) => setGitRepo(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className="w-full bg-black/40 border border-slate-800 rounded-2xl px-6 py-4 text-sm font-mono text-blue-400 focus:border-blue-500 outline-none transition-all placeholder:text-slate-700"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={checkUpdates}
                  disabled={checking || isUpdating}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 border border-slate-700 text-xs uppercase tracking-[0.2em]"
                >
                  {checking ? 'POLLING GITHUB...' : 'CHECK UPDATES'}
                </button>
                <button 
                  onClick={handleUpdate}
                  disabled={!updateAvailable || isUpdating}
                  className={`flex-1 font-black py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-30 text-xs uppercase tracking-[0.2em] shadow-xl ${updateAvailable ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}`}
                >
                  {isUpdating ? 'UPDATING CORE...' : 'UPDATE NOW'}
                </button>
              </div>
            </div>
          </div>

          {/* Commits / Change Log */}
          {showCommitHistory && (
            <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 animate-in zoom-in-95 duration-300">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-8 italic">Latest Commit Changes</h3>
              <div className="space-y-4">
                {[
                  { hash: '8f2a1b3', msg: 'Merge branch "feature/kernel-optimize"', author: 'nexus-dev', date: '2 days ago' },
                  { hash: '4c9d5e1', msg: 'fix: Multi-WAN latency polling frequency', author: 'root', date: '5 days ago' },
                  { hash: '1a2b3c4', msg: 'chore: update gemini-pro models and tools', author: 'nexus-dev', date: '1 week ago' },
                ].map((commit) => (
                  <div key={commit.hash} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-slate-800/50 hover:border-blue-500/30 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-[10px] text-blue-500 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/10 uppercase font-black">
                        {commit.hash}
                      </div>
                      <div>
                        <div className="text-sm text-slate-300 font-bold group-hover:text-white">{commit.msg}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-black tracking-tighter italic">{commit.author} • {commit.date}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Maintenance & Backup */}
        <div className="space-y-6">
          <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 backdrop-blur-md">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-8">Disaster Recovery</h3>
            
            <div className="space-y-4">
              <button 
                onClick={downloadBackup}
                className="w-full flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl hover:bg-emerald-500/10 transition-all group"
              >
                <div className="text-left">
                  <div className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-1">Download Backup</div>
                  <div className="text-[10px] text-slate-500 uppercase italic">Local Offline Snapshot</div>
                </div>
                <span className="text-xl group-hover:translate-y-1 transition-transform">📥</span>
              </button>

              <button 
                onClick={handleRestore}
                disabled={!backupExists}
                className="w-full flex items-center justify-between p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl hover:bg-rose-500/10 transition-all group disabled:opacity-20"
              >
                <div className="text-left">
                  <div className="text-xs font-black text-rose-500 uppercase tracking-widest mb-1">Restore System</div>
                  <div className="text-[10px] text-slate-500 uppercase italic">Revert to v1.2.4-fixed</div>
                </div>
                <span className="text-xl group-hover:rotate-180 transition-transform duration-500">🔄</span>
              </button>
            </div>
          </div>

          <div className="bg-black/60 p-8 rounded-[2.5rem] border border-slate-800 shadow-inner">
             <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Process Logs</h3>
             <div 
              ref={logRef}
              className="h-40 overflow-y-auto font-mono text-[10px] space-y-2 custom-scrollbar pr-2"
            >
               {logs.map((log, i) => (
                 <div key={i} className="text-slate-500 hover:text-blue-400 transition-colors">
                    <span className="opacity-40">{'>'}</span> {log}
                 </div>
               ))}
               {isUpdating && <div className="text-blue-400 animate-pulse tracking-widest italic font-black uppercase">SYNCING HARDWARE...</div>}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateManager;
