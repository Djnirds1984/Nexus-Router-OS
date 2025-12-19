
import React, { useState, useEffect } from 'react';
import { NetworkConfig } from '../types';
import { getNetworkAdvice, AdviceResult } from '../services/geminiService';

interface AIAdvisorProps {
  config: NetworkConfig;
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ config }) => {
  const [advice, setAdvice] = useState<AdviceResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchAdvice = async () => {
    setLoading(true);
    const result = await getNetworkAdvice(config);
    setAdvice(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchAdvice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">AI Architecture Advisor</h1>
          <p className="text-slate-400 mt-1">Intelligent insights for Ubuntu networking powered by Gemini.</p>
        </div>
        <button 
          onClick={fetchAdvice}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Thinking...
            </>
          ) : '🔄 Regenerate Analysis'}
        </button>
      </header>

      {loading ? (
        <div className="bg-slate-900 p-20 rounded-2xl border border-slate-800 flex flex-col items-center justify-center space-y-8 shadow-2xl">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-500/10 rounded-full" />
            <div className="absolute inset-0 w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-4 bg-blue-500/20 rounded-full flex items-center justify-center text-2xl animate-pulse">🧠</div>
          </div>
          <div className="text-center max-w-sm">
            <h3 className="text-xl font-bold text-white mb-2">Analyzing Host Topology</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              We're querying Google Search for the latest Ubuntu 24.04 kernel best practices and Multi-WAN optimization tricks...
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Expert Analysis</h3>
              <div className="text-slate-300 leading-relaxed text-lg whitespace-pre-wrap font-serif italic">
                {advice?.text || "Generating analysis..."}
              </div>
            </div>

            {advice?.sources && advice.sources.length > 0 && (
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Grounding Sources</h3>
                <div className="flex flex-wrap gap-3">
                  {advice.sources.map((source, idx) => (
                    <a 
                      key={idx} 
                      href={source.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-bold bg-slate-950 border border-slate-800 px-4 py-2 rounded-lg text-blue-400 hover:text-blue-300 hover:border-blue-500/50 transition-all"
                    >
                      {source.title} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-125 transition-transform duration-500">💡</div>
              <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2 text-sm">
                <span>⚡</span> Performance Tip
              </h3>
              <p className="text-sm text-blue-100/80 leading-relaxed">
                "Ubuntu's default TCP stack is optimized for server workloads. For routing, you should enable <strong>TCP BBR</strong> to handle packet loss on saturated links more gracefully."
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Implementation</h3>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">BASH/SUDO</span>
              </div>
              <div className="space-y-3 font-mono text-[11px]">
                {advice?.commands.map((cmd, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 rounded-lg text-slate-400 border border-slate-800/50 group hover:border-blue-500/30 transition-colors">
                    <span className="text-blue-500/50 mr-2">$</span>
                    {cmd}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAdvisor;
