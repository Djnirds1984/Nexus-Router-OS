import React, { useState } from 'react';

interface UpdateManagerProps {
  onApplyUpdate: () => void;
  isUpdating: boolean;
}

const UpdateManager: React.FC<UpdateManagerProps> = ({ onApplyUpdate, isUpdating }) => {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkUpdates = () => {
    setChecking(true);
    // Simulate GitHub API call
    setTimeout(() => {
      setChecking(false);
      setUpdateAvailable(true);
    }, 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Software Updates</h1>
          <p className="text-slate-400 mt-1">Manage firmware and dashboard versions via GitHub.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest">Connected Repository</div>
            <div className="text-blue-400 font-mono text-sm underline decoration-blue-500/30 underline-offset-4">
              Djnirds1984/Nexus-Router-OS
            </div>
          </div>
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xl shadow-inner">🐙</div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Version Status Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl shadow-black/20">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Current Version</h3>
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-4xl font-bold text-white mb-1 tracking-tighter">v1.2.4</div>
                <div className="text-xs text-slate-500 font-mono">Build: x64-202410-STABLE</div>
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-500/5">
                ✓
              </div>
            </div>
            
            <button 
              onClick={checkUpdates}
              disabled={checking || isUpdating}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 border border-slate-700 hover:border-slate-600"
            >
              {checking ? 'FETCHING GITHUB...' : 'CHECK FOR UPDATES'}
            </button>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 border-dashed">
            <h4 className="text-sm font-bold text-slate-400 mb-4">Update Channel</h4>
            <div className="space-y-3">
              {['Stable (Recommended)', 'Beta', 'Nightly / Edge'].map((channel) => (
                <label key={channel} className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-4 h-4 rounded-full border-2 border-slate-700 flex items-center justify-center ${channel.includes('Stable') ? 'border-blue-500' : ''}`}>
                    {channel.includes('Stable') && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                  </div>
                  <span className={`text-sm ${channel.includes('Stable') ? 'text-white font-medium' : 'text-slate-500 group-hover:text-slate-300'}`}>
                    {channel}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Change Log / Advice */}
        <div className="lg:col-span-2 space-y-6">
          {updateAvailable ? (
            <div className="bg-blue-600/10 border border-blue-500/30 p-8 rounded-2xl animate-in zoom-in-95 duration-300 shadow-2xl shadow-blue-500/5">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    Update v1.2.5 Available
                    <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">New</span>
                  </h3>
                  <p className="text-blue-300/70 text-sm mt-1 italic">Released on Oct 24, 2024</p>
                </div>
                <button 
                  onClick={onApplyUpdate}
                  disabled={isUpdating}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                >
                  {isUpdating ? 'UPDATING...' : 'INSTALL NOW'}
                </button>
              </div>

              <div className="bg-slate-950/50 rounded-xl p-6 border border-blue-500/10 mb-6 shadow-inner">
                <h4 className="text-blue-400 text-xs font-bold uppercase mb-4 tracking-widest">Patch Highlights</h4>
                <ul className="space-y-3 text-slate-300 text-sm">
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>Enhanced <strong>nftables</strong> offloading for Intel 12th Gen CPUs.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>Improved <strong>Failover</strong> detection speed from 500ms to 200ms.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>Fixed UI glitch in the Multi-WAN weight slider on mobile devices.</span>
                  </li>
                </ul>
              </div>
              
              <div className="text-xs text-blue-300/50">
                Warning: System will restart the dashboard service during installation. Existing network traffic will not be interrupted if kernel bypass is enabled.
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 p-12 rounded-2xl border border-slate-800 text-center flex flex-col items-center justify-center shadow-lg shadow-black/20">
              <div className="text-6xl mb-6 grayscale opacity-20">🚀</div>
              <h3 className="text-xl font-bold text-white tracking-tight">System Up to Date</h3>
              <p className="text-slate-500 mt-2 max-w-xs mx-auto text-sm">
                Your Nexus OS is running the latest stable build from <code className="text-slate-400">main</code>.
              </p>
            </div>
          )}

          <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-lg shadow-black/10">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Commit History</h3>
            <div className="space-y-6">
              {[
                { hash: '8f2a1b3', msg: 'Merge branch "feature/kernel-optimize"', author: 'nexus-dev', date: '2 days ago' },
                { hash: '4c9d5e1', msg: 'fix: Multi-WAN latency polling frequency', author: 'root', date: '5 days ago' },
                { hash: '1a2b3c4', msg: 'chore: update gemini-pro models and tools', author: 'nexus-dev', date: '1 week ago' },
              ].map((commit) => (
                <div key={commit.hash} className="flex items-center justify-between group cursor-help hover:bg-slate-800/20 -mx-4 px-4 py-2 rounded-xl transition-all">
                  <div className="flex items-center gap-4">
                    <div className="font-mono text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                      {commit.hash}
                    </div>
                    <div>
                      <div className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">{commit.msg}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-tighter">{commit.author} • {commit.date}</div>
                    </div>
                  </div>
                  <div className="text-slate-700 group-hover:text-slate-500 transition-colors">↗</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateManager;