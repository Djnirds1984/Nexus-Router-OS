
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
  pppoe?: {
    servers: PPPoEServerConfig[];
    secrets: PPPoESecret[];
    profiles: PPPoEProfile[];
  };
}

export interface TerminalLog {
  id: string;
  type: 'info' | 'command' | 'success' | 'error';
  message: string;
  timestamp: Date;
}

export interface PPPoEServerConfig {
  id: string;
  interfaceName: string;
  serviceName: string;
  defaultProfile: string; // Profile name
  authentication: 'pap' | 'chap' | 'mschap1' | 'mschap2';
  enabled: boolean;
}

export interface PPPoESecret {
  id: string;
  username: string;
  password: string;
  service: string; // 'pppoe' usually
  callerId: string; // MAC address or 'any'
  profile: string; // Profile name
  localAddress: string;
  remoteAddress: string;
  comment?: string;
  enabled: boolean;
  dueDate?: string;
  status?: 'ACTIVE' | 'GRACE' | 'EXPIRED';
}

export interface PPPoEProfile {
  id: string;
  name: string;
  localAddress: string;
  remoteAddressPool: string;
  dnsServer: string;
  rateLimit: string; // e.g. "10M/10M"
  onlyOne: boolean; // Only one session per user
  billingName?: string;
  price?: number;
  currency?: string;
  billingPeriodDays?: number;
  defaultDueDate?: string;
  gracePeriodDays?: number;
  ipPool?: string;
}

export interface PPPoEActiveConnection {
  id: string;
  username: string;
  interface: string;
  remoteAddress: string;
  uptime: string;
  callerId: string; // MAC
}
