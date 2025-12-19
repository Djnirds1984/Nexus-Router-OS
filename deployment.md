# 🌐 Nexus Router OS: The Definitive Deployment Guide

This project **MUST** be installed in `/var/www/html/Nexus-Router-Os`.

---

## 🛠️ 1. Environment Preparation & DNS Fix
Run these as `root` to avoid port conflicts with the DHCP server.

```bash
# Update Ubuntu
sudo apt update && sudo apt upgrade -y
sudo apt install git nodejs npm nginx iproute2 net-tools fuser dnsmasq bridge-utils -y

# CRITICAL: Resolve Port 53 Conflict (for DHCP/DNS support)
# This stops systemd-resolved from blocking Port 53.
sudo systemctl stop systemd-resolved
sudo systemctl disable systemd-resolved
# Ensure /etc/resolv.conf is handled by your ISP or manually
sudo rm /etc/resolv.conf
echo "nameserver 1.1.1.1" | sudo tee /etc/resolv.conf
```

---

## 📂 2. Installation
```bash
sudo mkdir -p /var/www/html/Nexus-Router-Os
sudo chown -R $USER:$USER /var/www/html/Nexus-Router-Os
cd /var/www/html/Nexus-Router-Os
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git .
sudo npm install express cors --save
```

---

## ⚡ 3. Nexus Agent Service
```bash
sudo nano /etc/systemd/system/nexus-agent.service
```

Paste:
```ini
[Unit]
Description=Nexus Router Core Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/html/Nexus-Router-Os
ExecStart=/usr/bin/node /var/www/html/Nexus-Router-Os/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable nexus-agent
sudo systemctl restart nexus-agent
```

---

## ✅ 4. Finalizing
1. Open the UI in your browser.
2. Go to **System** tab and click **"Fix DNS Conflict"** if `dnsmasq` fails to start.
3. Your bridges and DHCP servers will now save persistently in `nexus-config.json`.
