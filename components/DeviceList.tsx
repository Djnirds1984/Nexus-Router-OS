import React, { useState, useEffect } from 'react';

interface Device {
  mac: string;
  ip: string;
  hostname: string;
  leaseTime: string;
}

const DeviceList: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await fetch(`http://${window.location.hostname || 'localhost'}:3000/api/devices`);
        if (res.ok) {
          const data = await res.json();
          setDevices(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-700">
      <header>
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Connected Devices</h1>
        <p className="text-slate-400 mt-1 font-medium">Real-time LAN client discovery & lease management.</p>
      </header>

      <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800 backdrop-blur-md overflow-hidden">
        <div className="p-8 border-b border-slate-800">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            Active Clients <span className="text-slate-500 text-lg font-bold">({devices.length})</span>
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950/50 text-slate-500 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-8 py-4">Hostname</th>
                <th className="px-8 py-4">IP Address</th>
                <th className="px-8 py-4">MAC Address</th>
                <th className="px-8 py-4">Lease Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-8 text-center text-slate-500">Scanning network...</td></tr>
              ) : devices.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-8 text-center text-slate-500">No devices found.</td></tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.mac} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-8 py-4 font-bold text-white">{device.hostname}</td>
                    <td className="px-8 py-4 font-mono text-blue-400">{device.ip}</td>
                    <td className="px-8 py-4 font-mono text-slate-500">{device.mac}</td>
                    <td className="px-8 py-4 text-sm text-slate-400">{device.leaseTime}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DeviceList;
