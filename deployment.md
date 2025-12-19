# 🌐 Nexus Router OS: The Definitive Deployment Guide

This guide provides the mandatory, end-to-end instructions to deploy Nexus Router OS on an Ubuntu x64 machine. **This project MUST be installed in `/var/www/html/Nexus-Router-Os`.**

---

## 🛠️ 1. Environment Preparation
Run these commands as `root` or with `sudo`.

```bash
# Update Ubuntu and install critical dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install git nodejs npm nginx iproute2 net-tools fuser dnsmasq bridge-utils -y

# Disable default systemd-resolved to avoid DNS port conflicts (optional, if using dnsmasq for all DNS)
# sudo systemctl stop systemd-resolved
# sudo systemctl disable systemd-resolved
```

---

## 📂 2. Installation (Mandatory Path)
You must use the specific directory `/var/www/html/Nexus-Router-Os`.

```bash
# 1. Clean existing attempts and create the core directory
sudo rm -rf /var/www/html/Nexus-Router-Os
sudo mkdir -p /var/www/html/Nexus-Router-Os
sudo chown -R $USER:$USER /var/www/html/Nexus-Router-Os

# 2. Clone the Official Repository
cd /var/www/html/Nexus-Router-Os
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git .

# 3. CRITICAL: Backend Dependency Setup
# This resolves "502 Bad Gateway" and service failures.
sudo npm install express cors --save
```

---

## ⚡ 3. Nexus Agent Service Configuration
The Hardware Agent manages the Linux Kernel and needs to run as a persistent service.

1.  **Create the Service File**:
    ```bash
    sudo nano /etc/systemd/system/nexus-agent.service
    ```

2.  **Paste this exact content**:
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
    StandardOutput=append:/var/log/nexus-agent.log
    StandardError=append:/var/log/nexus-agent.log

    [Install]
    WantedBy=multi-user.target
    ```

3.  **Enable and Start the Service**:
    ```bash
    # Kill any process using port 3000 to avoid EADDRINUSE
    sudo fuser -k 3000/tcp || true
    
    sudo systemctl daemon-reload
    sudo systemctl enable nexus-agent
    sudo systemctl restart nexus-agent
    ```

---

## 🌐 4. Kernel Routing & DHCP Configuration
Ensure the Ubuntu kernel is optimized and dnsmasq is ready for DHCP.

```bash
# Optimize Kernel
sudo tee /etc/sysctl.d/99-nexus-router.conf <<EOF
net.ipv4.ip_forward=1
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.all.send_redirects=0
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
EOF

sudo sysctl -p /etc/sysctl.d/99-nexus-router.conf

# Prepare dnsmasq for Nexus management
sudo mkdir -p /etc/dnsmasq.d
sudo systemctl enable dnsmasq
```

---

## 🎨 5. Nginx Web Server (Proxy) Setup
Configure Nginx to serve the dashboard and route API requests to the Agent.

1.  **Create the Nginx Configuration**:
    ```bash
    sudo nano /etc/nginx/sites-available/nexus
    ```

2.  **Paste this configuration**:
    ```nginx
    server {
        listen 80;
        server_name _;
        root /var/www/html/Nexus-Router-Os;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://127.0.0.1:3000/api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
    }
    ```

3.  **Activate the Site**:
    ```bash
    sudo ln -s /etc/nginx/sites-available/nexus /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo systemctl restart nginx
    ```

---

## ✅ 6. Final Launch
Navigate to your Ubuntu machine's IP in a web browser.
1. Go to the **Multi-WAN** tab to define your Internet ports.
2. Use the **Bridge & DHCP** tab to merge your LAN ports (e.g., `eth1`, `eth2`) into `br0`.
3. Enable **DHCP Server** on your bridge to automatically assign IPs to local devices.
4. Click **"Synchronize Bridge & DHCP to Kernel"**.

---

## 🆘 Troubleshooting
- **DHCP Not Working**: Check dnsmasq status: `sudo systemctl status dnsmasq`.
- **Bridge Issues**: Check active bridges: `brctl show` or `ip link show type bridge`.
- **Logs**: View detailed agent logs at `cat /var/log/nexus-agent.log`.
