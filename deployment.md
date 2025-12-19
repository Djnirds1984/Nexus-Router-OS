# 🌐 Nexus Router OS: Definitive Ubuntu x64 Deployment Guide

This document provides the mandatory steps to deploy Nexus Router OS on an Ubuntu x64 machine. Following these steps exactly will resolve the "502 Bad Gateway" and "nexus-agent.service" failures.

---

## 🛠️ 1. Prerequisites & Clean Slate
Ensure you are logged in as `root` or have full `sudo` access.

```bash
# Update system and install core requirements
sudo apt update && sudo apt upgrade -y
sudo apt install git nodejs npm nginx iproute2 net-tools fuser -y
```

---

## 📂 2. Mandatory Installation Path
The project **MUST** reside in `/var/www/html/Nexus-Router-Os`. If it is anywhere else, the service will fail.

```bash
# 1. Clean existing attempts and create directory
sudo rm -rf /var/www/html/Nexus-Router-Os
sudo mkdir -p /var/www/html/Nexus-Router-Os
sudo chown -R $USER:$USER /var/www/html/Nexus-Router-Os

# 2. Clone the Repository
cd /var/www/html/Nexus-Router-Os
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git .

# 3. CRITICAL: Install Backend Dependencies
# This step fixes the "1/FAILURE" exit code.
sudo npm install express cors --save
```

---

## ⚡ 3. Hardware Agent (Systemd Service)
The Hardware Agent manages your Linux Kernel. It must run as `root`.

1.  **Create/Edit Service File**:
    ```bash
    sudo nano /etc/systemd/system/nexus-agent.service
    ```

2.  **Paste this EXACT configuration**:
    ```ini
    [Unit]
    Description=Nexus Router Core Agent
    After=network.target

    [Service]
    Type=simple
    User=root
    WorkingDirectory=/var/www/html/Nexus-Router-Os
    # Use 'which node' to verify path if this fails. Default is /usr/bin/node
    ExecStart=/usr/bin/node /var/www/html/Nexus-Router-Os/server.js
    Restart=always
    RestartSec=5
    StandardOutput=append:/var/log/nexus-agent.log
    StandardError=append:/var/log/nexus-agent.log

    [Install]
    WantedBy=multi-user.target
    ```

3.  **Activate Agent**:
    ```bash
    # Kill any process accidentally using the port
    sudo fuser -k 3000/tcp || true
    
    sudo systemctl daemon-reload
    sudo systemctl enable nexus-agent
    sudo systemctl restart nexus-agent
    ```

---

## 🌐 4. Kernel Routing Optimization
Enable the Ubuntu PC to actually forward packets between WAN interfaces.

```bash
sudo tee /etc/sysctl.d/99-nexus-router.conf <<EOF
net.ipv4.ip_forward=1
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.all.send_redirects=0
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
EOF

sudo sysctl -p /etc/sysctl.d/99-nexus-router.conf
```

---

## 🎨 5. Nginx Reverse Proxy Config
Connect the frontend dashboard to the hardware agent.

1.  **Create Config**:
    ```bash
    sudo nano /etc/nginx/sites-available/nexus
    ```

2.  **Paste this configuration**:
    ```nginx
    server {
        listen 80;
        server_name _; # Or your IP address
        root /var/www/html/Nexus-Router-Os;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        # Proxy API requests to the Hardware Agent on port 3000
        location /api/ {
            proxy_pass http://127.0.0.1:3000/api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            
            # Timeout settings for long-running kernel apply operations
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
    }
    ```

3.  **Enable Site**:
    ```bash
    sudo ln -s /etc/nginx/sites-available/nexus /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo systemctl restart nginx
    ```

---

## 🆘 Troubleshooting Agent Failures
If `systemctl status nexus-agent` still shows `failed`:

1.  **Check logs**: `cat /var/log/nexus-agent.log`
2.  **Test manually**: `cd /var/www/html/Nexus-Router-Os && sudo node server.js`
    - If it says `Cannot find module 'express'`, run `npm install express` again.
    - If it says `EADDRINUSE`, run `sudo fuser -k 3000/tcp`.
3.  **Verify Node Path**: Run `which node`. If it returns `/usr/local/bin/node`, update the `ExecStart` path in your `.service` file.
