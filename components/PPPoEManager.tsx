import React, { useState, useEffect } from 'react';
import { PPPoEServerConfig, PPPoESecret, PPPoEProfile, PPPoEActiveConnection } from '../types';

const PPPoEManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'servers' | 'secrets' | 'active' | 'profiles'>('servers');
  const [config, setConfig] = useState<{
    servers: PPPoEServerConfig[];
    secrets: PPPoESecret[];
    profiles: PPPoEProfile[];
  }>({ servers: [], secrets: [], profiles: [] });
  const [activeSessions, setActiveSessions] = useState<PPPoEActiveConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [netdevs, setNetdevs] = useState<Array<{ name: string; customName?: string; type: 'physical' | 'bridge' }>>([]);
  const [netdevsError, setNetdevsError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, { interface?: string; serverIp?: string; serviceName?: string }>>({});
  // Server IP edit buffer per-server to allow user typing without immediate persistence
  const [serverIpEdit, setServerIpEdit] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchConfig();
    fetchActive();
    const interval = setInterval(fetchActive, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchNetdevs();
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
      // Initialize server IP edit buffers from matching default profile.localAddress
      const ipMap: Record<string, string> = {};
      (data.servers || []).forEach((srv: PPPoEServerConfig) => {
        const prof = (data.profiles || []).find((p: PPPoEProfile) => p.name === (srv.defaultProfile || ''));
        ipMap[srv.id] = prof?.localAddress || '';
      });
      setServerIpEdit(ipMap);
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

  const fetchNetdevs = async () => {
    try {
      setNetdevsError(null);
      const res = await fetch('/api/netdevs');
      const data = await res.json();
      const list = (data.interfaces || []).map((i: any) => ({
        name: i.name,
        customName: i.customName,
        type: i.type === 'bridge' ? 'bridge' : 'physical'
      }));
      setNetdevs(list);
    } catch (e) {
      setNetdevsError('Failed to load interfaces');
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

  const isValidIPv4 = (ip: string) => {
    const parts = ip.trim().split('.');
    if (parts.length !== 4) return false;
    return parts.every(p => /^[0-9]+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
  };

  const setServerError = (id: string, field: keyof (typeof serverErrors[string])) => (msg?: string) => {
    setServerErrors(prev => ({ ...prev, [id]: { ...prev[id], [field]: msg || undefined } }));
  };

  const getProfileByName = (name: string) => config.profiles.find(p => p.name === name);
  const upsertProfile = (profile: PPPoEProfile) => {
    const exists = config.profiles.find(p => p.id === profile.id);
    const profiles = exists ? config.profiles.map(p => p.id === profile.id ? profile : p) : [...config.profiles, profile];
    saveConfig({ ...config, profiles });
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
        <button
          onClick={() => setActiveTab('profiles')}
          className={`px-6 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${activeTab === 'profiles' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Profiles
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
                  <div className="relative">
                    <select
                      value={srv.interfaceName}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setServerError(srv.id, 'interface')('Interface is required');
                        } else {
                          setServerError(srv.id, 'interface')(undefined);
                        }
                        updateServer(srv.id, { interfaceName: val });
                      }}
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50 appearance-none"
                    >
                      <option value="">Select Interface</option>
                      {netdevs.map(dev => {
                        const isVlan = dev.name.includes('.');
                        const label =
                          `${dev.customName || dev.name}` +
                          `  • ${isVlan ? 'VLAN' : (dev.type === 'bridge' ? 'Bridge' : 'Physical')}` +
                          (dev.customName ? `  (${dev.name})` : '');
                        return <option key={dev.name} value={dev.name}>{label}</option>;
                      })}
                      {netdevsError && <option value={srv.interfaceName}>{srv.interfaceName}</option>}
                    </select>
                    {serverErrors[srv.id]?.interface && (
                      <div className="mt-1 text-rose-400 text-[10px] font-black uppercase tracking-widest">{serverErrors[srv.id]?.interface}</div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Service Name</label>
                  <input 
                    value={srv.serviceName} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val.trim()) setServerError(srv.id, 'serviceName')('Service Name is required');
                      else setServerError(srv.id, 'serviceName')(undefined);
                      updateServer(srv.id, { serviceName: val });
                    }}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50"
                  />
                  {serverErrors[srv.id]?.serviceName && (
                    <div className="mt-1 text-rose-400 text-[10px] font-black uppercase tracking-widest">{serverErrors[srv.id]?.serviceName}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Authentication</label>
                  <select
                    value={srv.authentication}
                    onChange={(e) => updateServer(srv.id, { authentication: e.target.value as PPPoEServerConfig['authentication'] })}
                    className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50 appearance-none"
                  >
                    <option value="pap">PAP</option>
                    <option value="chap">CHAP</option>
                    <option value="mschap1">MSCHAPv1</option>
                    <option value="mschap2">MSCHAPv2</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Server IP</label>
                  <input
                    // Use buffered value and only persist on blur to avoid premature invalid states
                    value={serverIpEdit[srv.id] ?? ''}
                    onChange={(e) => {
                      const ip = e.target.value;
                      setServerIpEdit(prev => ({ ...prev, [srv.id]: ip }));
                      if (ip && !isValidIPv4(ip)) {
                        setServerError(srv.id, 'serverIp')('Invalid IPv4 address');
                      } else {
                        setServerError(srv.id, 'serverIp')(undefined);
                      }
                    }}
                    onBlur={() => {
                      const ip = (serverIpEdit[srv.id] || '').trim();
                      // Persist only if empty or valid IPv4; empty clears validation but skips save
                      if (!ip) { setServerError(srv.id, 'serverIp')(undefined); return; }
                      if (!isValidIPv4(ip)) { setServerError(srv.id, 'serverIp')('Invalid IPv4 address'); return; }
                      const prof = getProfileByName(srv.defaultProfile || '');
                      if (prof && prof.localAddress !== ip) {
                        // Persist to profiles to maintain backward-compatible storage
                        upsertProfile({ ...prof, localAddress: ip });
                      }
                    }}
                    placeholder="e.g. 10.0.0.1"
                    className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50"
                  />
                  {serverErrors[srv.id]?.serverIp && (
                    <div className="mt-1 text-rose-400 text-[10px] font-black uppercase tracking-widest">{serverErrors[srv.id]?.serverIp}</div>
                  )}
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

      {activeTab === 'profiles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                const newProf: PPPoEProfile = {
                  id: Math.random().toString(36).slice(2),
                  name: 'default',
                  localAddress: '10.0.0.1',
                  remoteAddressPool: '10.0.0.100-10.0.0.200',
                  dnsServer: '8.8.8.8',
                  rateLimit: '10M/10M',
                  onlyOne: true
                };
                saveConfig({ ...config, profiles: [...config.profiles, newProf] });
              }}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
            >
              + Add Profile
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {config.profiles.map(profile => (
              <div key={profile.id} className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Name</label>
                    <input
                      value={profile.name}
                      onChange={(e) => upsertProfile({ ...profile, name: e.target.value })}
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Local Address</label>
                    <input
                      value={profile.localAddress}
                      onChange={(e) => upsertProfile({ ...profile, localAddress: e.target.value })}
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Remote Pool</label>
                    <input
                      value={profile.remoteAddressPool}
                      onChange={(e) => upsertProfile({ ...profile, remoteAddressPool: e.target.value })}
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">DNS Server</label>
                    <input
                      value={profile.dnsServer}
                      onChange={(e) => upsertProfile({ ...profile, dnsServer: e.target.value })}
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rate Limit</label>
                    <input
                      value={profile.rateLimit}
                      onChange={(e) => upsertProfile({ ...profile, rateLimit: e.target.value })}
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Only One Session</label>
                    <button
                      onClick={() => upsertProfile({ ...profile, onlyOne: !profile.onlyOne })}
                      className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${profile.onlyOne ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/50 text-slate-500 border-slate-700'}`}
                    >
                      {profile.onlyOne ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>
                {/* Credentials are managed in the Secrets tab only; Profiles handles non-credential attributes */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Apply to Server</label>
                    <select
                      value=""
                      onChange={(e) => {
                        const serverId = e.target.value;
                        const srv = config.servers.find(s => s.id === serverId);
                        if (srv) updateServer(srv.id, { defaultProfile: profile.name });
                      }}
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50 appearance-none"
                    >
                      <option value="">Select Server</option>
                      {config.servers.map(s => (
                        <option key={s.id} value={s.id}>{s.serviceName} • {s.interfaceName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => saveConfig({ ...config, profiles: config.profiles.filter(p => p.id !== profile.id) })}
                    className="text-rose-500 hover:text-rose-400 font-black text-xs uppercase tracking-widest px-4 py-3"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {config.profiles.length === 0 && (
              <div className="text-center py-12 text-slate-600 font-bold uppercase tracking-widest text-xs">
                No Profiles Configured
              </div>
            )}
          </div>
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
