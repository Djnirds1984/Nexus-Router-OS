# Nexus OS: Ubuntu x64 Router Deployment Guide

Follow these steps to turn your PC into a high-performance Multi-WAN Load Balancer.

## 🏗️ 1. Hardware Preparation
1.  **Network Interface Cards (NICs)**: Ensure your PC has at least 3 Ethernet ports (1 for LAN, 2 for WAN/ISPs).
2.  **Cabling**: Connect your Primary ISP to the first port (e.g., `enp1s0`) and your Backup ISP to the second port (e.g., `enp2s0`).
3.  **OS**: Install **Ubuntu 24.04 LTS x64**.

## 🛠️ 2. Core Agent Installation
The Core Agent bridges the web UI to the Linux Kernel.

```bash
# 1. Update system and install Node.js
sudo apt update && sudo apt install nodejs npm -y

# 2. Create project directory
sudo mkdir -p /opt/nexus
sudo chown $USER:$USER /opt/nexus
cd /opt/nexus

# 3. Initialize and install dependencies
npm init -y
npm install express cors

# 4. Copy server.js to this directory
# (Save the server.js code from this project into /opt/nexus/server.js)
```

## ⚡ 3. Setting up Nexus as a System Service
Ensure the router agent starts automatically on boot.

1. Create a service file: `sudo nano /etc/systemd/system/nexus-agent.service`
2. Paste the following:
```ini
[Unit]
Description=Nexus Router Core Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nexus
ExecStart=/usr/bin/node /opt/nexus/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```
3. Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable nexus-agent
sudo systemctl start nexus-agent
```

## 🌐 4. Kernel Network Configuration
Enable packet forwarding and BBR (Bottleneck Bandwidth and RTT) for better performance.

```bash
# Append to sysctl.conf
sudo tee -a /etc/sysctl.conf <<EOF
net.ipv4.ip_forward=1
net.ipv4.tcp_congestion_control=bbr
net.core.default_qdisc=fq
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.all.send_redirects=0
EOF

# Apply changes
sudo sysctl -p
```

## 🎨 5. Serve the Dashboard
You can serve the `index.html` and `index.tsx` using Nginx:
```bash
sudo apt install nginx -y
sudo cp -r /your/project/files/* /var/www/html/
sudo systemctl restart nginx
```

## 🔍 6. Final Validation
- Access the dashboard at `http://your-ip-address`.
- Check bottom-left status: **Hardware Native (Green)** means successful kernel connection.
- Click **Analyze Topology** in the AI Advisor to get custom `nftables` rules for your specific hardware.
