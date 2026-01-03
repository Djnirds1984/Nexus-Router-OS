import React, { useState, useEffect } from 'react';
import { PPPoEServerConfig, PPPoESecret, PPPoEProfile, PPPoEActiveConnection } from '../types';

const PPPoEManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'servers' | 'secrets' | 'active'>('servers');
  const [config, setConfig] = useState<{
    servers: PPPoEServerConfig[];
    secrets: PPPoESecret[];
    profiles: PPPoEProfile[];
  }>({ servers: [], secrets: [], profiles: [] });
  const [activeSessions, setActiveSessions] = useState<PPPoEActiveConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchActive();
    const interval = setInterval(fetchActive, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/pppoe/config');
      const data = await res.json();
      // Ensure arrays exist
      setConfig({
        servers: data.servers || [],
        secrets: data.secrets || [],
        profiles: data.profiles || []
      });
      setIsLoading(false);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchActive = async () => {
    try {
      const res = await fetch('/api/pppoe/active');
      const data = await res.json();
      setActiveSessions(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const saveConfig = async (newConfig: typeof config) => {
    setConfig(newConfig);
    setIsSaving(true);
    try {
      await fetch('/api/pppoe/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const addServer = () => {
    const newServer: PPPoEServerConfig = {
      id: Math.random().toString(36).slice(2),
      interfaceName: 'eth1',
      serviceName: 'Nexus',
      defaultProfile: 'default',
      authentication: 'chap',
      enabled: false
    };
    saveConfig({ ...config, servers: [...config.servers, newServer] });
  };

  const updateServer = (id: string, updates: Partial<PPPoEServerConfig>) => {
    const newServers = config.servers.map(s => s.id === id ? { ...s, ...updates } : s);
    saveConfig({ ...config, servers: newServers });
  };

  const deleteServer = (id: string) => {
    saveConfig({ ...config, servers: config.servers.filter(s => s.id !== id) });
  };

  const addSecret = () => {
    const newSecret: PPPoESecret = {
      id: Math.random().toString(36).slice(2),
      username: 'user',
      password: 'password',
      service: 'pppoe',
      callerId: 'any',
      profile: 'default',
      localAddress: '10.0.0.1',
      remoteAddress: '10.0.0.100',
      enabled: true
    };
    saveConfig({ ...config, secrets: [...config.secrets, newSecret] });
  };

  const updateSecret = (id: string, updates: Partial<PPPoESecret>) => {
    const newSecrets = config.secrets.map(s => s.id === id ? { ...s, ...updates } : s);
    saveConfig({ ...config, secrets: newSecrets });
  };

  const deleteSecret = (id: string) => {
    saveConfig({ ...config, secrets: config.secrets.filter(s => s.id !== id) });
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-700">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">PPPoE Manager</h1>
          <p className="text-slate-400 mt-1 font-medium">Access Concentrator & Subscriber Management</p>
        </div>
        {isSaving && (
           <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl text-blue-400 font-bold text-xs uppercase tracking-widest animate-pulse">
             Saving...
           </div>
        )}
      </header>

      <div className="flex gap-2 bg-slate-900/40 p-2 rounded-2xl border border-slate-800 w-fit backdrop-blur-md">
        <button
          onClick={() => setActiveTab('servers')}
          className={`px-6 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${activeTab === 'servers' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Servers
        </button>
        <button
          onClick={() => setActiveTab('secrets')}
          className={`px-6 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${activeTab === 'secrets' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Secrets (Users)
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-6 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${activeTab === 'active' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Active Sessions
        </button>
      </div>

      {activeTab === 'servers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={addServer} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
              + Add Server
            </button>
          </div>
          {config.servers.map(srv => (
            <div key={srv.id} className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Interface</label>
                  <input 
                    value={srv.interfaceName} 
                    onChange={(e) => updateServer(srv.id, { interfaceName: e.target.value })}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Service Name</label>
                  <input 
                    value={srv.serviceName} 
                    onChange={(e) => updateServer(srv.id, { serviceName: e.target.value })}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</label>
                  <button 
                    onClick={() => updateServer(srv.id, { enabled: !srv.enabled })}
                    className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${srv.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/50 text-slate-500 border-slate-700'}`}
                  >
                    {srv.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div className="flex items-end justify-end">
                  <button onClick={() => deleteServer(srv.id)} className="text-rose-500 hover:text-rose-400 font-black text-xs uppercase tracking-widest px-4 py-3">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
          {config.servers.length === 0 && (
            <div className="text-center py-12 text-slate-600 font-bold uppercase tracking-widest text-xs">
              No PPPoE Servers Configured
            </div>
          )}
        </div>
      )}

      {activeTab === 'secrets' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={addSecret} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
              + Add User
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {config.secrets.map(secret => (
              <div key={secret.id} className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md hover:border-blue-500/20 transition-all">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Username</label>
                    <input 
                      value={secret.username} 
                      onChange={(e) => updateSecret(secret.id, { username: e.target.value })}
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Password</label>
                    <input 
                      type="password"
                      value={secret.password} 
                      onChange={(e) => updateSecret(secret.id, { password: e.target.value })}
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Remote Address</label>
                    <input 
                      value={secret.remoteAddress} 
                      onChange={(e) => updateSecret(secret.id, { remoteAddress: e.target.value })}
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</label>
                    <button 
                      onClick={() => updateSecret(secret.id, { enabled: !secret.enabled })}
                      className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${secret.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/50 text-slate-500 border-slate-700'}`}
                    >
                      {secret.enabled ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                  <div className="flex items-end justify-end">
                    <button onClick={() => deleteSecret(secret.id)} className="text-rose-500 hover:text-rose-400 font-black text-xs uppercase tracking-widest px-4 py-3">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'active' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800/50">
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Interface</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">User</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Remote Address</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">MAC Address</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Uptime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {activeSessions.map(session => (
                  <tr key={session.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-6 font-mono text-xs font-bold text-blue-400">{session.interface}</td>
                    <td className="p-6 font-bold text-slate-300 text-sm">{session.username}</td>
                    <td className="p-6 font-mono text-xs text-slate-400">{session.remoteAddress}</td>
                    <td className="p-6 font-mono text-xs text-slate-500">{session.callerId}</td>
                    <td className="p-6 font-mono text-xs text-emerald-400">{session.uptime}</td>
                  </tr>
                ))}
                {activeSessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-600 font-bold uppercase tracking-widest text-xs">
                      No Active Sessions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PPPoEManager;
