import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WanInterface, SystemMetrics, WanStatus } from '../types';

interface DashboardProps {
  wanInterfaces: WanInterface[];
  metrics: any; // Using any to handle the extra totalMem added in App.tsx
}

const Dashboard: React.FC<DashboardProps> = ({ wanInterfaces, metrics }) => {
  const [selectedIface, setSelectedIface] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);

  // Smart selection: pick the healthiest interface if none selected or if selected is offline
  useEffect(() => {
    const currentSelected = wanInterfaces.find(i => i.interfaceName === selectedIface);
    const healthyOne = wanInterfaces.find(i => (i as any).internetHealth === 'HEALTHY');
    
    if ((!selectedIface || (currentSelected && (currentSelected as any).internetHealth !== 'HEALTHY')) && healthyOne) {
      setSelectedIface(healthyOne.interfaceName);
    } else if (!selectedIface && wanInterfaces.length > 0) {
      setSelectedIface(wanInterfaces[0].interfaceName);
    }
  }, [wanInterfaces, selectedIface]);

  // Traffic history tracker
  useEffect(() => {
    if (!selectedIface) return;
    const currentData = wanInterfaces.find(i => i.interfaceName === selectedIface);
    if (!currentData) return;
    
    setHistory(prev => {
      const newEntry = { 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
        rx: currentData.throughput.rx, 
        tx: currentData.throughput.tx 
      };
      return [...prev, newEntry].slice(-40);
    });
  }, [wanInterfaces, selectedIface]);

  const aggregateTraffic = useMemo(() => {
    return wanInterfaces.reduce((acc, curr) => ({
      rx: acc.rx + (curr.throughput?.rx || 0),
      tx: acc.tx + (curr.throughput?.tx || 0)
    }), { rx: 0, tx: 0 });
  }, [wanInterfaces]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Host Dashboard</h1>
          <p className="text-slate-400 mt-1 font-medium uppercase text-[10px] tracking-widest">Real-time Ubuntu Core Telemetry</p>
        </div>
        <div className="text-right">
          <div className="text-slate-500 text-[10px] font-black tracking-[0.2em] mb-1">SESSION UPTIME</div>
          <div className="text-white font-mono text-xl tabular-nums font-bold">{metrics.uptime || 'BOOTING...'}</div>
        </div>
      </header>

      {/* Real Hardware Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 p-6 rounded-[1.5rem] border border-slate-800 backdrop-blur-sm">
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Live CPU Core Load</div>
          <div className="flex flex-col gap-3">
            <span className="text-3xl font-black text-white tabular-nums tracking-tighter">{metrics.cpuUsage.toFixed(0)}%</span>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`h-full transition-all duration-700 ease-out ${metrics.cpuUsage > 80 ? 'bg-rose-500' : 'bg-blue-600'} shadow-[0_0_10px_rgba(37,99,235,0.4)]`} 
                style={{ width: `${metrics.cpuUsage}%` }} 
              />
            </div>
          </div>
        </div>
        
        <div className="bg-slate-900/50 p-6 rounded-[1.5rem] border border-slate-800 backdrop-blur-sm">
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Memory Utilization</div>
          <div className="flex flex-col gap-1">
            <div className="flex items-end gap-1">
              <span className="text-3xl font-black text-white tabular-nums tracking-tighter">{metrics.memoryUsage}</span>
              <span className="text-xs text-slate-500 font-black uppercase mb-1.5">GB Used</span>
            </div>
            <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Total capacity: {metrics.totalMem || '16.00'} GB</div>
            <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
               <div className="h-full bg-slate-600" style={{ width: `${((metrics.memoryUsage / (metrics.totalMem || 16)) * 100).toFixed(0)}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[1.5rem] border border-slate-800 backdrop-blur-sm">
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Total Downstream</div>
          <div className="text-3xl font-black text-emerald-400 tabular-nums tracking-tighter">
            {aggregateTraffic.rx.toFixed(2)} <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Mbps</span>
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[1.5rem] border border-slate-800 backdrop-blur-sm">
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Total Upstream</div>
          <div className="text-3xl font-black text-blue-400 tabular-nums tracking-tighter">
            {aggregateTraffic.tx.toFixed(2)} <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Mbps</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Traffic Chart */}
        <div className="lg:col-span-2 bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-2xl relative">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-lg font-black text-white flex items-center gap-3 uppercase italic tracking-tight">
              <span className="w-2 h-6 bg-blue-500 rounded shadow-[0_0_12px_rgba(59,130,246,0.3)]" />
              Traffic Monitor: <span className="text-blue-400 font-mono tracking-tighter">{selectedIface.toUpperCase()}</span>
            </h2>
            <select 
              value={selectedIface}
              onChange={(e) => setSelectedIface(e.target.value)}
              className="bg-slate-950 text-slate-300 border border-slate-800 rounded-xl px-4 py-2 text-[10px] font-black outline-none font-mono focus:border-blue-500 cursor-pointer uppercase tracking-widest"
            >
              {wanInterfaces.map(iface => (
                <option key={iface.interfaceName} value={iface.interfaceName}>{iface.interfaceName}</option>
              ))}
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#475569" fontSize={10} fontWeight="bold" tickFormatter={(val) => `${val}M`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', borderRadius: '16px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="rx" name="Download" stroke="#10b981" strokeWidth={3} fill="url(#colorRx)" isAnimationActive={false} />
                <Area type="monotone" dataKey="tx" name="Upload" stroke="#3b82f6" strokeWidth={3} fill="url(#colorTx)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Column */}
        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden flex flex-col shadow-2xl">
          <div className="p-8 border-b border-slate-800 bg-slate-800/10">
             <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Interface Matrix</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {wanInterfaces.map((wan) => (
              <div key={wan.id} onClick={() => setSelectedIface(wan.interfaceName)} className={`p-5 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between ${selectedIface === wan.interfaceName ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full ${(wan as any).internetHealth === 'HEALTHY' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]'}`} />
                  <div>
                    <div className="text-sm font-black text-white font-mono uppercase tracking-tighter">{wan.interfaceName}</div>
                    <div className="text-[10px] text-slate-500 font-mono tracking-tight tabular-nums">{wan.ipAddress}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-mono font-black ${(wan as any).internetHealth === 'HEALTHY' ? 'text-emerald-400' : 'text-rose-500'}`}>{wan.latency}ms</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
