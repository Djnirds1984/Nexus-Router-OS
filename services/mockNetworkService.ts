
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
  cpuUsage: 12 + Math.random() * 5,
  memoryUsage: 2.4,
  uptime: '45d 12h 03m',
  activeSessions: 142 + Math.floor(Math.random() * 20)
});

export const simulateTraffic = (wan: WanInterface): WanInterface => {
  const variation = (Math.random() - 0.5) * 10;
  return {
    ...wan,
    throughput: {
      rx: Math.max(0, wan.throughput.rx + variation),
      tx: Math.max(0, wan.throughput.tx + variation / 2)
    },
    latency: Math.max(5, wan.latency + (Math.random() - 0.5) * 2)
  };
};
