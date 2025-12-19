
import React, { useEffect, useRef } from 'react';
import { TerminalLog } from '../types';

interface TerminalProps {
  logs: TerminalLog[];
  isOpen: boolean;
  onClose: () => void;
}

const Terminal: React.FC<TerminalProps> = ({ logs, isOpen, onClose }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-64 right-0 z-50 bg-black/95 border-t border-slate-700 h-80 flex flex-col font-mono text-sm shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500" />
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="ml-2 text-slate-400 font-bold text-xs uppercase tracking-widest">Router System Console</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
        {logs.length === 0 && (
          <div className="text-slate-600 italic">No activity recorded. Waiting for commands...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3">
            <span className="text-slate-600 shrink-0">[{log.timestamp.toLocaleTimeString()}]</span>
            <span className={
              log.type === 'command' ? 'text-blue-400' :
              log.type === 'success' ? 'text-emerald-400' :
              log.type === 'error' ? 'text-rose-400' :
              'text-slate-300'
            }>
              {log.type === 'command' && <span className="mr-2">root@nexus:~#</span>}
              {log.message}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default Terminal;
