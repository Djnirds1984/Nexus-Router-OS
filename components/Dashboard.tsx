
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
          <h1 className="text-3xl font-bold text-white">Network Overview</h1>
          <p className="text-slate-400 mt-1">Real-time performance metrics for your Ubuntu x64 Router.</p>
        </div>
        <div className="text-right">
          <div className="text-slate-500 text-sm font-medium">UPTIME</div>
          <div className="text-white font-mono text-xl">{metrics.uptime}</div>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <div className="text-slate-400 text-sm font-medium mb-1">CPU Load</div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-white">{metrics.cpuUsage.toFixed(1)}%</span>
            <div className="flex-1 h-2 bg-slate-800 rounded-full mb-1.5 overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${metrics.cpuUsage}%` }} />
            </div>
          </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <div className="text-slate-400 text-sm font-medium mb-1">Memory</div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-white">{metrics.memoryUsage.toFixed(1)} GB</span>
            <span className="text-xs text-slate-500 mb-1">/ 16 GB</span>
          </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <div className="text-slate-400 text-sm font-medium mb-1">Active Sessions</div>
          <div className="text-2xl font-bold text-white">{metrics.activeSessions}</div>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <div className="text-slate-400 text-sm font-medium mb-1">Primary WAN Latency</div>
          <div className="text-2xl font-bold text-emerald-400">{wanInterfaces[0]?.latency.toFixed(0)} ms</div>
        </div>
      </div>

      {/* Traffic Chart */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-white">Aggregated Throughput (Mbps)</h2>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs text-slate-400">WAN 1</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-500" />
              <span className="text-xs text-slate-400">WAN 2</span>
            </div>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorWan1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorWan2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#475569" fontSize={12} tickFormatter={(val) => `${val}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Area type="monotone" dataKey="wan1" stroke="#3b82f6" fillOpacity={1} fill="url(#colorWan1)" />
              <Area type="monotone" dataKey="wan2" stroke="#06b6d4" fillOpacity={1} fill="url(#colorWan2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interface List */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">WAN Interface Status</h2>
        </div>
        <div className="divide-y divide-slate-800">
          {wanInterfaces.map((wan) => (
            <div key={wan.id} className="p-6 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${wan.status === WanStatus.UP ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  🌐
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{wan.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">{wan.interfaceName}</span>
                  </div>
                  <div className="text-sm text-slate-500">{wan.ipAddress} • GW: {wan.gateway}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-12">
                <div className="text-right">
                  <div className="text-xs text-slate-500 font-medium uppercase mb-1">Traffic</div>
                  <div className="text-sm">
                    <span className="text-emerald-400">↓ {wan.throughput.rx.toFixed(1)} Mbps</span>
                    <span className="text-slate-600 mx-2">|</span>
                    <span className="text-blue-400">↑ {wan.throughput.tx.toFixed(1)} Mbps</span>
                  </div>
                </div>
                <div className="text-right w-24">
                  <div className="text-xs text-slate-500 font-medium uppercase mb-1">Status</div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    wan.status === WanStatus.UP ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/20 text-rose-400 border border-rose-500/20'
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
