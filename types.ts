
export enum WanStatus {
  UP = 'UP',
  DOWN = 'DOWN',
  STANDBY = 'STANDBY'
}

export enum RouterMode {
  LOAD_BALANCER = 'LOAD_BALANCER',
  FAILOVER = 'FAILOVER'
}

export interface WanInterface {
  id: string;
  name: string;
  interfaceName: string; // e.g., eth0, enp1s0
  status: WanStatus;
  gateway: string;
  ipAddress: string;
  weight: number; // For load balancing
  priority: number; // For failover
  throughput: {
    rx: number;
    tx: number;
  };
  latency: number;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  uptime: string;
  activeSessions: number;
}

export interface NetworkConfig {
  mode: RouterMode;
  wanInterfaces: WanInterface[];
  dnsServers: string[];
}

export interface TerminalLog {
  id: string;
  type: 'info' | 'command' | 'success' | 'error';
  message: string;
  timestamp: Date;
}
