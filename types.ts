
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

export interface BridgeConfig {
  id: string;
  name: string; // e.g. br0
  interfaces: string[]; // member interfaces
  ipAddress: string;
  netmask: string;
  dhcpEnabled: boolean;
  dhcpStart: string;
  dhcpEnd: string;
  leaseTime: string;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  uptime: string;
  activeSessions: number;
}

export interface FirewallRule {
  id: string;
  type: 'INPUT' | 'FORWARD';
  proto: 'tcp' | 'udp' | 'icmp' | 'any';
  port?: string;
  src?: string;
  action: 'ACCEPT' | 'DROP' | 'REJECT';
  enabled: boolean;
}

export interface NetworkConfig {
  mode: RouterMode;
  wanInterfaces: WanInterface[];
  dnsServers: string[];
  firewallRules?: FirewallRule[];
  dhcp?: { interfaceName: string; enabled: boolean; start: string; end: string; leaseTime: string };
  bridges?: any[];
}

export interface TerminalLog {
  id: string;
  type: 'info' | 'command' | 'success' | 'error';
  message: string;
  timestamp: Date;
}
