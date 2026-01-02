# 🌐 Nexus Router OS Deployment Guide

This project MUST be installed in `/var/www/html/Nexus-Router-Os` on an Ubuntu Linux router.

## 1. Prerequisites
- OS: Ubuntu 22.04/24.04 (systemd ≥ 245)
- Runtime: Node.js ≥ 18, npm
- Packages: `dnsmasq`, `iproute2`, `iptables` (or `nftables`), `jq`, `curl`, `git`
- Browser: Recent Chromium/Firefox for UI access

## 2. Environment Setup
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y dnsmasq iproute2 iptables jq curl git nodejs npm
# Enable IPv4 forwarding (persistent)
echo "net.ipv4.ip_forward=1" | sudo tee /etc/sysctl.d/99-nexus-forward.conf
sudo sysctl --system
```
Note: Do NOT disable `systemd-resolved` unless you plan to run DNS on the router. Nexus uses DHCP-only mode by default (`port=0`) to avoid DNS port conflicts.

## 3. Install Nexus Router OS
```bash
sudo mkdir -p /var/www/html/Nexus-Router-Os
sudo chown -R root:root /var/www/html/Nexus-Router-Os
cd /var/www/html/Nexus-Router-Os
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git .
npm install
```

## 4. Nexus Agent Service
```bash
sudo tee /etc/systemd/system/nexus-agent.service > /dev/null <<'EOF'
[Unit]
Description=Nexus Router Core Agent
After=network.target
Requires=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/html/Nexus-Router-Os
ExecStart=/usr/bin/node /var/www/html/Nexus-Router-Os/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now nexus-agent
```
Optional API auth: create a token to protect endpoints.
```bash
echo "<your-strong-token>" | sudo tee /etc/nexus/api.token > /dev/null
sudo systemctl restart nexus-agent
```

## 5. Web Interface (nginx)
Install and configure nginx to serve the UI and proxy API requests to the agent.
```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
```
Default site config:
```bash
sudo tee /etc/nginx/sites-available/default > /dev/null <<'EOF'
server {
  listen 80 default_server;
  server_name _;
  root /var/www/html/Nexus-Router-Os;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
EOF
sudo nginx -t
sudo systemctl reload nginx
```
Optional firewall:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 3000/tcp
```
## 6. DHCP Integration (dnsmasq)
The agent writes `/etc/dnsmasq.d/nexus-dhcp.conf` when you save DHCP settings in the UI. To ensure service order:
```ini
# /etc/systemd/system/dnsmasq.service.d/override.conf
[Unit]
After=nexus-agent.service
Requires=nexus-agent.service
```
```bash
sudo mkdir -p /etc/systemd/system/dnsmasq.service.d
sudo tee /etc/systemd/system/dnsmasq.service.d/override.conf > /dev/null <<'EOF'
[Unit]
After=nexus-agent.service
Requires=nexus-agent.service
EOF
sudo systemctl daemon-reload
sudo systemctl restart dnsmasq
```

## 7. Persistence & Backup
- Config: `/var/www/html/Nexus-Router-Os/nexus-config.json`
- Backup: `/var/www/html/Nexus-Router-Os/nexus-config.backup.json` (auto-saved on apply)
- Init log: `/var/log/nexus-init.log`
- Agent log: `/var/log/nexus-agent.log`
The agent restores from backup on boot if the primary config is missing and reapplies DHCP.

## 8. Post-Deployment Verification
```bash
# Initialization and logs
curl -s http://localhost:3000/api/init/status | jq
journalctl -u nexus-agent -f
journalctl -u dnsmasq -f

# DHCP status
curl -s http://localhost:3000/api/dhcp/status | jq

# Interfaces & metrics
curl -s http://localhost:3000/api/interfaces | jq
curl -s http://localhost:3000/api/metrics | jq
```
Client verification (Windows):
```powershell
ipconfig /release
ipconfig /renew
nslookup google.com
```

## 9. Rollback Procedures
```bash
# Restore previous config
cp /var/www/html/Nexus-Router-Os/nexus-config.backup.json /var/www/html/Nexus-Router-Os/nexus-config.json
systemctl restart nexus-agent

# Remove DHCP config and restart
rm -f /etc/dnsmasq.d/nexus-dhcp.conf
systemctl restart dnsmasq

# Clear NAT (iptables)
iptables -t nat -F POSTROUTING
iptables -F FORWARD
```
Disable agent (if needed):
```bash
sudo systemctl disable --now nexus-agent
```

## 10. Monitoring & Logging
- Agent: `/var/log/nexus-agent.log`, `journalctl -u nexus-agent -f`
- Init: `/var/log/nexus-init.log`
- DHCP: `journalctl -u dnsmasq -f`
Optional log rotation:
```bash
sudo tee /etc/logrotate.d/nexus > /dev/null <<'EOF'
/var/log/nexus-*.log {
  weekly
  rotate 4
  compress
  missingok
  notifempty
}
EOF
```

## 11. Deployment Notes
- Install path must remain `/var/www/html/Nexus-Router-Os`.
- Agent requires root to perform network changes.
- WAN detection uses the system default route; ensure the correct interface is primary.
- Avoid multiple DHCP servers on the same subnet.
Refer to README.md for project overview; this document focuses on deployment only.
