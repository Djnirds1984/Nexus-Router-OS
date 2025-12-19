
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WanInterface, SystemMetrics, WanStatus } from '../types';

interface DashboardProps {
  wanInterfaces: WanInterface[];
  metrics: SystemMetrics;
}

const Dashboard: React.FC<DashboardProps> = ({ wanInterfaces, metrics }) => {
  const chartData = useMemo(() => {
    // Simulated history for the chart
    return Array.from({ length: 20 }).map((_, i) => ({
      time: i,
      wan1: 300 + Math.random() * 200,
      wan2: 50 + Math.random() * 50,
    }));
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">System Dashboard</h1>
          <p className="text-slate-400 mt-1">Ubuntu x64 Router Runtime • Stable Version 1.2.4</p>
        </div>
        <div className="text-right">
          <div className="text-slate-500 text-[10px] font-black tracking-[0.2em] mb-1">SESSION UPTIME</div>
          <div className="text-white font-mono text-xl tabular-nums">{metrics.uptime}</div>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">CPU Core Load</div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-white tabular-nums">{metrics.cpuUsage.toFixed(1)}%</span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full mb-2 overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${metrics.cpuUsage > 80 ? 'bg-rose-500' : 'bg-blue-500'}`} 
                style={{ width: `${metrics.cpuUsage}%` }} 
              />
            </div>
          </div>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Memory Runtime</div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-white tabular-nums">{metrics.memoryUsage.toFixed(1)} GB</span>
            <span className="text-[10px] text-slate-500 font-bold mb-1.5">/ 16.0</span>
          </div>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Kernel Streams</div>
          <div className="text-2xl font-bold text-white tabular-nums">{metrics.activeSessions}</div>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">ICMP Latency</div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">{wanInterfaces[0]?.latency.toFixed(0)} <span className="text-xs font-medium text-slate-500">ms</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Traffic Chart */}
        <div className="lg:col-span-2 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2 h-4 bg-blue-500 rounded-sm"></span>
              Aggregate Throughput
            </h2>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fiber Primary</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Starlink Backup</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorWan1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorWan2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#475569" fontSize={10} fontWeight="bold" tickFormatter={(val) => `${val}M`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="wan1" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorWan1)" animationDuration={1000} />
                <Area type="monotone" dataKey="wan2" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorWan2)" animationDuration={1000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Host Identity Card */}
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 flex flex-col justify-between">
           <div>
              <h2 className="text-lg font-bold text-white mb-6 tracking-tight">Host Identity</h2>
              <div className="space-y-4">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Architecture</div>
                  <div className="text-sm font-mono text-blue-400">Ubuntu 24.04.1 LTS (x86_64)</div>
                </div>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Kernel Release</div>
                  <div className="text-sm font-mono text-slate-300">6.8.0-45-generic</div>
                </div>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Proxy Server</div>
                  <div className="text-sm font-mono text-slate-300">nginx/1.28.0</div>
                </div>
              </div>
           </div>
           
           <div className="mt-8 pt-8 border-t border-slate-800/50">
              <div className="flex items-center justify-between text-xs font-bold">
                 <span className="text-slate-500">FIREWALL</span>
                 <span className="text-emerald-500">NFTABLES: ACTIVE</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold mt-2">
                 <span className="text-slate-500">ACCELERATION</span>
                 <span className="text-blue-500">BBR: ENABLED</span>
              </div>
           </div>
        </div>
      </div>

      {/* Interface List */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800 bg-slate-800/20">
          <h2 className="text-lg font-bold text-white tracking-tight">Interface Orchestration</h2>
        </div>
        <div className="divide-y divide-slate-800">
          {wanInterfaces.map((wan) => (
            <div key={wan.id} className="p-6 flex items-center justify-between hover:bg-slate-800/30 transition-all group">
              <div className="flex items-center gap-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg transition-transform group-hover:scale-110 ${
                  wan.status === WanStatus.UP ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                }`}>
                  {wan.status === WanStatus.UP ? '✓' : '!'}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white text-lg tracking-tight">{wan.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 text-blue-400 border border-blue-500/20 font-mono font-bold">{wan.interfaceName}</span>
                  </div>
                  <div className="text-xs font-mono text-slate-500 mt-1">{wan.ipAddress} • <span className="text-slate-600">Gateway: {wan.gateway}</span></div>
                </div>
              </div>
              
              <div className="flex items-center gap-16">
                <div className="text-right">
                  <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1.5">Network Load</div>
                  <div className="text-sm font-mono flex gap-4">
                    <span className="text-emerald-400 font-bold">↓ {wan.throughput.rx.toFixed(1)} Mbps</span>
                    <span className="text-blue-400 font-bold">↑ {wan.throughput.tx.toFixed(1)} Mbps</span>
                  </div>
                </div>
                <div className="text-right w-24">
                  <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1.5">Reliability</div>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full border tracking-widest transition-colors ${
                    wan.status === WanStatus.UP ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/5 text-rose-400 border-rose-500/20'
                  }`}>
                    {wan.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;