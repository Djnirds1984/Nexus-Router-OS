import React, { useState } from 'react';
import { NetworkConfig, FirewallRule } from '../types';

interface FirewallManagerProps {
  config: NetworkConfig;
  setConfig: (config: NetworkConfig) => void;
  onApply: () => void;
  isApplying: boolean;
}

const FirewallManager: React.FC<FirewallManagerProps> = ({
  config,
  setConfig,
  onApply,
  isApplying
}) => {
  const [newRule, setNewRule] = useState<Partial<FirewallRule>>({
    type: 'INPUT',
    proto: 'tcp',
    action: 'ACCEPT',
    enabled: true,
    port: '',
    src: ''
  });

  const rules = config.firewallRules || [];

  const addRule = () => {
    const rule: FirewallRule = {
      id: Math.random().toString(36).substr(2, 9),
      type: newRule.type as any,
      proto: newRule.proto as any,
      port: newRule.port || '',
      src: newRule.src || '',
      action: newRule.action as any,
      enabled: true
    };
    setConfig({
      ...config,
      firewallRules: [...rules, rule]
    });
    setNewRule({ ...newRule, port: '', src: '' });
  };

  const removeRule = (id: string) => {
    setConfig({
      ...config,
      firewallRules: rules.filter(r => r.id !== id)
    });
  };

  const toggleRule = (id: string) => {
     setConfig({
      ...config,
      firewallRules: rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    });
  };

  return (
     <div className="space-y-8 pb-32 animate-in fade-in duration-700">
       {/* Header */}
       <header className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Firewall</h1>
          <p className="text-slate-400 mt-1 font-medium">Traffic Control & Security Rules</p>
        </div>
        <button 
            onClick={onApply}
            disabled={isApplying}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 px-8 rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest text-xs"
          >
            {isApplying ? 'APPLYING...' : 'APPLY RULES'}
          </button>
      </header>

      {/* Add Rule Form */}
      <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800">
         <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">Add New Rule</h3>
         <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <select 
              value={newRule.type}
              onChange={e => setNewRule({...newRule, type: e.target.value as any})}
              className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none"
            >
              <option value="INPUT">INPUT (Local)</option>
              <option value="FORWARD">FORWARD (Routing)</option>
            </select>
            <select 
              value={newRule.proto}
              onChange={e => setNewRule({...newRule, proto: e.target.value as any})}
              className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none"
            >
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="icmp">ICMP</option>
              <option value="any">ANY</option>
            </select>
            <input
              type="text"
              placeholder="Port (e.g. 80, 443)"
              value={newRule.port}
              onChange={e => setNewRule({...newRule, port: e.target.value})}
              className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none"
            />
            <input
              type="text"
              placeholder="Source IP (Optional)"
              value={newRule.src}
              onChange={e => setNewRule({...newRule, src: e.target.value})}
              className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none"
            />
             <select 
              value={newRule.action}
              onChange={e => setNewRule({...newRule, action: e.target.value as any})}
              className="bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none"
            >
              <option value="ACCEPT">ACCEPT</option>
              <option value="DROP">DROP</option>
              <option value="REJECT">REJECT</option>
            </select>
            <button onClick={addRule} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/20 active:scale-95 transition-all">
              ADD RULE
            </button>
         </div>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.length === 0 ? (
           <div className="text-center py-12 text-slate-500 text-sm">No active firewall rules</div>
        ) : (
          rules.map((rule, idx) => (
            <div key={rule.id} className={`bg-slate-900/40 p-4 rounded-2xl border flex items-center justify-between group transition-all ${rule.enabled ? 'border-slate-800 hover:border-blue-500/30' : 'border-slate-800 opacity-60'}`}>
              <div className="flex items-center gap-6">
                <div className="font-mono text-xs text-slate-500 w-8">#{idx + 1}</div>
                <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${rule.action === 'ACCEPT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {rule.action}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">{rule.type}</span>
                  <span className="text-[10px] text-slate-500 font-mono uppercase">{rule.proto} {rule.port ? `:${rule.port}` : ''}</span>
                </div>
                {rule.src && (
                   <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Source</span>
                    <span className="text-xs font-mono text-blue-400">{rule.src}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                 <button onClick={() => toggleRule(rule.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${rule.enabled ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                   {rule.enabled ? 'Active' : 'Disabled'}
                 </button>
                 <button onClick={() => removeRule(rule.id)} className="p-2 text-slate-500 hover:text-rose-400 transition-colors">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                 </button>
              </div>
            </div>
          ))
        )}
      </div>
     </div>
  );
};

export default FirewallManager;
