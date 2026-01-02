
import React, { useState, useEffect, useCallback } from 'react';

interface WifiNetwork {
  ssid: string;
  signal: number;
  security: string;
}

interface WifiStatus {
  available: boolean;
  connected: boolean;
  ssid?: string;
  interface?: string;
  state?: string;
  error?: string;
}

const API_BASE = `http://${window.location.hostname || 'localhost'}:3000/api`;

const WifiManager: React.FC = () => {
  const [status, setStatus] = useState<WifiStatus>({ available: false, connected: false });
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<WifiNetwork | null>(null);
  const [password, setPassword] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-5));

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/wifi/status`);
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      // console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleScan = async () => {
    setScanning(true);
    addLog('Scanning for networks...');
    try {
      const res = await fetch(`${API_BASE}/wifi/scan`);
      const data = await res.json();
      setNetworks(data);
      addLog(`Found ${data.length} networks.`);
    } catch (e) {
      addLog('Scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedNetwork) return;
    setConnecting(true);
    addLog(`Connecting to ${selectedNetwork.ssid}...`);
    try {
      const res = await fetch(`${API_BASE}/wifi/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid: selectedNetwork.ssid, password })
      });
      const data = await res.json();
      if (res.ok) {
        addLog('Connection successful!');
        setSelectedNetwork(null);
        setPassword('');
        fetchStatus();
      } else {
        addLog(`Error: ${data.error}`);
      }
    } catch (e) {
      addLog('Connection failed.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect from current WiFi network?')) return;
    try {
      await fetch(`${API_BASE}/wifi/disconnect`, { method: 'POST' });
      addLog('Disconnected.');
      fetchStatus();
    } catch (e) {
      addLog('Disconnect failed.');
    }
  };

  if (!status.available) {
    return (
      <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 backdrop-blur-md text-center">
        <h2 className="text-2xl font-bold text-slate-500 uppercase italic">WiFi Hardware Not Detected</h2>
        <p className="text-slate-600 mt-2">No compatible wireless interface found on this system.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${status.connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Wireless Interface</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">{status.interface}</span>
                {status.connected ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> CONNECTED: {status.ssid}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-500">DISCONNECTED</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {status.connected && (
              <button 
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-all"
              >
                DISCONNECT
              </button>
            )}
            <button 
              onClick={handleScan}
              disabled={scanning}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {scanning ? 'SCANNING...' : 'SCAN NETWORKS'}
            </button>
          </div>
        </div>

        {logs.length > 0 && (
          <div className="bg-black/30 p-3 rounded-xl mb-6 font-mono text-[10px] text-slate-400">
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}

        <div className="space-y-2">
          {networks.length === 0 && !scanning && (
            <div className="text-center py-8 text-slate-500 text-sm italic">
              No networks found. Click Scan to search.
            </div>
          )}
          
          {networks.map((net) => (
            <div key={net.ssid} className="group flex items-center justify-between p-4 bg-slate-800/30 hover:bg-slate-800/60 rounded-2xl border border-transparent hover:border-slate-700 transition-all cursor-pointer" onClick={() => setSelectedNetwork(net)}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${net.signal > 70 ? 'bg-emerald-500' : net.signal > 40 ? 'bg-amber-500' : 'bg-red-500'}`} />
                <span className="font-bold text-slate-200">{net.ssid}</span>
                {net.security !== 'OPEN' && <span className="text-[10px] text-slate-500 uppercase tracking-wider">🔒 {net.security}</span>}
              </div>
              <div className="text-xs font-mono text-slate-500">{net.signal}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Connection Modal */}
      {selectedNetwork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-1">Connect to {selectedNetwork.ssid}</h3>
            <p className="text-sm text-slate-400 mb-6">Enter the password for this network.</p>
            
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white mb-6 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              autoFocus
            />
            
            <div className="flex gap-3">
              <button 
                onClick={() => { setSelectedNetwork(null); setPassword(''); }}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
              >
                CANCEL
              </button>
              <button 
                onClick={handleConnect}
                disabled={connecting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {connecting ? 'CONNECTING...' : 'CONNECT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WifiManager;
