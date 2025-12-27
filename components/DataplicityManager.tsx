import React, { useEffect, useState } from 'react';

type DataplicityStatus = {
  installed: boolean;
  running: boolean;
  serial?: string;
  version?: string;
  log?: string[];
};

const getApiBase = () => {
  const host = window.location.hostname || 'localhost';
  return `http://${host}:3000/api`;
};

const API_BASE = getApiBase();

const DataplicityManager: React.FC = () => {
  const [status, setStatus] = useState<DataplicityStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installCmd, setInstallCmd] = useState('');
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dataplicity/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch Dataplicity status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleInstall = async () => {
    if (!installCmd.trim()) return;
    setInstalling(true);
    setError('');
    
    // Extract ID if user pasted full command, or use as is if it's just the code?
    // Actually, backend can handle the parsing or just run the command if safe.
    // To be safe, let's extract the ID or validate the command structure.
    // Common: curl -s https://www.dataplicity.com/<ID>.py | sudo python3
    // Or just: https://www.dataplicity.com/<ID>.py
    
    try {
      const res = await fetch(`${API_BASE}/dataplicity/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: installCmd })
      });
      
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Installation failed');
      }
      
      await fetchStatus();
      setInstallCmd('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header>
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Dataplicity Manager</h1>
        <p className="text-slate-400 mt-1 font-medium italic">Remote Shell & Device Management</p>
      </header>

      {status?.installed ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-6">
            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Service Status</h3>
            
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${status.running ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
              <div className="text-xl font-bold text-white tracking-tight">
                {status.running ? 'ACTIVE & RUNNING' : 'STOPPED'}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800/50">
               <div>
                 <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Serial Number</div>
                 <div className="font-mono text-blue-400 text-lg">{status.serial || 'Unknown'}</div>
               </div>
               {status.version && (
                 <div>
                   <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Agent Version</div>
                   <div className="font-mono text-slate-300">{status.version}</div>
                 </div>
               )}
            </div>

            <button 
              onClick={fetchStatus} 
              disabled={loading}
              className="mt-4 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-widest transition-all"
            >
              {loading ? 'REFRESHING...' : 'REFRESH STATUS'}
            </button>
          </div>

          <div className="bg-[#0B0F1A] p-8 rounded-[2.5rem] border border-slate-800 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-3xl mb-2">
              ☁️
            </div>
            <h3 className="text-xl font-bold text-white">Remote Access Ready</h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              Your device is connected to Dataplicity. You can access the remote shell from your dashboard at <a href="https://www.dataplicity.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">dataplicity.com</a>.
            </p>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto bg-slate-900/40 p-10 rounded-[3rem] border border-slate-800 text-center space-y-8">
           <div className="space-y-2">
             <div className="w-20 h-20 bg-slate-800 rounded-3xl mx-auto flex items-center justify-center text-4xl mb-6 shadow-xl shadow-black/20">
               🔌
             </div>
             <h2 className="text-3xl font-black text-white tracking-tight">Connect to Dataplicity</h2>
             <p className="text-slate-400">Enter your installation command to enable remote access.</p>
           </div>

           <div className="space-y-4 text-left max-w-xl mx-auto">
             <div className="bg-black/40 p-6 rounded-2xl border border-slate-800">
               <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Installation Command</label>
               <textarea 
                 value={installCmd}
                 onChange={e => setInstallCmd(e.target.value)}
                 placeholder="curl -s https://www.dataplicity.com/xxxx.py | sudo python3"
                 className="w-full bg-transparent border-none outline-none text-slate-300 font-mono text-xs h-24 resize-none placeholder:text-slate-700"
               />
             </div>
             
             {error && (
               <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold">
                 Error: {error}
               </div>
             )}

             <button
               onClick={handleInstall}
               disabled={installing || !installCmd.trim()}
               className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${installing ? 'bg-slate-700 text-slate-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-95'}`}
             >
               {installing ? 'INSTALLING...' : 'RUN INSTALLER'}
             </button>
             
             <p className="text-[10px] text-slate-600 text-center">
               The installer will run using Python 3 as requested. This process may take a minute.
             </p>
           </div>
        </div>
      )}
    </div>
  );
};

export default DataplicityManager;
