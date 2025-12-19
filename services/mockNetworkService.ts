
import { WanStatus, RouterMode, WanInterface, SystemMetrics } from '../types';

export const INITIAL_WAN_INTERFACES: WanInterface[] = [
  {
    id: 'wan1',
    name: 'Fiber Primary (ISP-A)',
    interfaceName: 'enp1s0',
    status: WanStatus.UP,
    gateway: '192.168.1.1',
    ipAddress: '102.45.21.8',
    weight: 70,
    priority: 1,
    throughput: { rx: 450, tx: 120 },
    latency: 12
  },
  {
    id: 'wan2',
    name: 'Starlink Backup (ISP-B)',
    interfaceName: 'enp2s0',
    status: WanStatus.UP,
    gateway: '192.168.100.1',
    ipAddress: '98.12.33.45',
    weight: 30,
    priority: 2,
    throughput: { rx: 85, tx: 15 },
    latency: 45
  }
];

export const getMockMetrics = (): SystemMetrics => ({
  cpuUsage: 8 + Math.random() * 4,
  memoryUsage: 1.8 + Math.random() * 0.4,
  uptime: '0d 00h 05m',
  activeSessions: 85 + Math.floor(Math.random() * 15)
});

export const simulateTraffic = (wan: WanInterface): WanInterface => {
  const variation = (Math.random() - 0.5) * 20;
  return {
    ...wan,
    throughput: {
      rx: Math.max(5, wan.throughput.rx + variation),
      tx: Math.max(2, wan.throughput.tx + variation / 2)
    },
    latency: Math.max(5, wan.latency + (Math.random() - 0.5) * 4)
  };
};
