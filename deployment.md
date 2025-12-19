
# Nexus Router OS: Deployment Guide (Ubuntu x64)

This guide provides the necessary steps to deploy the **Nexus Router OS** management dashboard and configure your Ubuntu x64 PC as a professional Multi-WAN router with Load Balancing and Auto-Failover capabilities.

---

## 1. Hardware Requirements

To use this system as a router, your Ubuntu PC requires:
*   **Architecture:** x86_64 (Intel/AMD).
*   **NICs:** At least 3 Ethernet ports (1 for LAN, 2 for WAN interfaces).
    *   Recommended: Intel i225/i226 or Realtek 2.5G NICs.
*   **Storage:** 16GB+ (Dashboard + Linux OS).
*   **RAM:** 2GB minimum (8GB+ recommended for heavy state tracking).

---

## 2. Host OS Preparation (Ubuntu 24.04 LTS)

Before running the dashboard, the Ubuntu kernel must be configured to allow packet forwarding.

### Enable IPv4 Forwarding
Run the following commands to enable routing:
```bash
# Enable forwarding immediately
sudo sysctl -w net.ipv4.ip_forward=1

# Persist changes across reboots
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Install Essential Networking Tools
The dashboard generates commands for these utilities:
```bash
sudo apt update
sudo apt install -y iproute2 nftables curl nodejs npm
```

---

## 3. Dashboard Installation

The Nexus OS dashboard is a React-based interface used to orchestrate the Linux `iproute2` and `nftables` stacks.

### Step 1: Clone and Install
```bash
git clone https://github.com/YOUR_USERNAME/nexus-router-os.git
cd nexus-router-os
npm install
```

### Step 2: Environment Configuration
Ensure your Gemini API Key is available in your environment to power the **AI Advisor**:
```bash
export API_KEY='your_google_gemini_api_key'
```

### Step 3: Launch the Dashboard
```bash
# Start the management UI
npm run dev
```
The dashboard will be accessible at `http://your-pc-ip:5173`.

---

## 4. Configuring Multi-WAN

Nexus OS uses a "Management Interface" approach. It does not directly execute root-level commands for security reasons. Instead:

1.  **Orchestrate:** Go to the **Multi-WAN** tab in the dashboard.
2.  **Select Mode:** Choose between `LOAD BALANCER` or `AUTO FAILOVER`.
3.  **Generate Advice:** Navigate to the **AI Advisor** tab. It will analyze your current configuration and generate a specific script for your Ubuntu kernel.
4.  **Execute:** Copy the generated commands from the **Implementation** panel or the **System Console** and execute them in your Ubuntu terminal with `sudo`.

---

## 5. Automated System Integration (Advanced)

To allow the dashboard to apply changes directly (Active Orchestration), you can set up a simple bridge service or use the generated commands in a Netplan configuration.

### Example: Netplan Multi-WAN (Static)
If you are using the Load Balancing mode, the AI Advisor will suggest a structure similar to this in `/etc/netplan/01-netcfg.yaml`:

```yaml
network:
  version: 2
  ethernets:
    enp1s0: # WAN 1
      dhcp4: yes
      routes:
        - to: default
          via: 192.168.1.1
          metric: 100
    enp2s0: # WAN 2
      dhcp4: yes
      routes:
        - to: default
          via: 192.168.100.1
          metric: 200
```

---

## 6. Security Hardening

When deploying on a real PC, ensure the following:
1.  **UFW/Firewall:** Only allow access to the dashboard (Port 5173) from the LAN interface.
2.  **SSH:** Disable password authentication and use SSH keys.
3.  **Kernel Hardening:** The **AI Advisor** provides `sysctl` commands for protection against IP spoofing and SYN flood attacks.

---

## Troubleshooting

*   **Interface not showing:** Run `ip link show` to verify your physical interface names (e.g., `eth0` vs `enp1s0`) and update them in `services/mockNetworkService.ts`.
*   **AI Advisor Offline:** Verify your `API_KEY` is correctly exported and you have an active internet connection on at least one WAN link.

---
*Created by Nexus OS AI Deployment Engine*
