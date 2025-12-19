# 🌐 Nexus OS Router: Absolute Ubuntu x64 Deployment Manual

This is the definitive guide to deploying the Nexus Router OS. Following these instructions will transform a standard Ubuntu x64 PC into a professional Multi-WAN Load Balancer and Failover Router.

---

## 🏗️ 1. Hardware Preparation
*   **Host**: Ubuntu 24.04 LTS (x86_64).
*   **Network**: At least 3 Physical Ethernet Ports (1 LAN, 2 WAN).
*   **User**: Must have `sudo` privileges.

---

## 🚀 FAST FIX: For "Bad Gateway" or "Failed Start"
If your agent isn't starting, run these three commands immediately:
```bash
cd /var/www/html/Nexus-Router-Os
sudo npm install express cors --save
sudo systemctl restart nexus-agent
```

---

## 🐧 2. System Prerequisites
Run these commands to install the necessary engine components:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install git nodejs npm nginx iproute2 net-tools -y
```

---

## 📂 3. Repository Installation (Mandatory Path)
The project **must** be installed in `/var/www/html/Nexus-Router-Os`.

```bash
# 1. Create the directory and set ownership
sudo mkdir -p /var/www/html/Nexus-Router-Os
sudo chown -R $USER:$USER /var/www/html/Nexus-Router-Os

# 2. Clone the repository into the specific directory
cd /var/www/html/Nexus-Router-Os
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git .

# 3. Install the Backend Agent dependencies (MANDATORY)
sudo npm install express cors --save
```

---

## ⚡ 4. Nexus Core Agent (Backend Daemon)
The backend agent manages the Linux Kernel. It must run as `root` for `iproute2` access.

1.  **Create Service File**:
    ```bash
    sudo nano /etc/systemd/system/nexus-agent.service
    ```
2.  **Paste Configuration**:
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
    RestartSec=10
    StartLimitIntervalSec=0

    [Install]
    WantedBy=multi-user.target
    ```
3.  **Start the Service**:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable nexus-agent
    sudo systemctl restart nexus-agent
    ```

---

## 🌐 5. Kernel Optimization & Routing
Execute these commands to enable the Ubuntu PC to function as a router:

```bash
# Enable Packet Forwarding and BBR High-Speed Congestion Control
sudo tee -a /etc/sysctl.conf <<EOF
net.ipv4.ip_forward=1
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.all.send_redirects=0
EOF

# Apply kernel parameters immediately
sudo sysctl -p
```

---

## 🎨 6. Nginx Web Server Configuration
Point the web server to the Nexus Router OS directory.

1.  **Configure Nginx**:
    ```bash
    sudo nano /etc/nginx/sites-available/nexus
    ```
2.  **Paste Configuration**:
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
            proxy_pass http://localhost:3000/api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            
            # Diagnostic headers
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
    ```
3.  **Activate and Restart**:
    ```bash
    sudo ln -s /etc/nginx/sites-available/nexus /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo systemctl restart nginx
    ```

---

## 🆘 Troubleshooting 502 Bad Gateway
If you see **"Failed to communicate with Hardware Agent"** or **502 Bad Gateway**:

1.  **Manual Start Check**:
    Run the server manually to see the error message:
    ```bash
    cd /var/www/html/Nexus-Router-Os
    sudo node server.js
    ```
    (If it says "Cannot find module", you missed `npm install`)

2.  **Check Service Status**:
    ```bash
    sudo systemctl status nexus-agent
    ```

3.  **Check Logs**:
    ```bash
    sudo journalctl -u nexus-agent -n 50 --no-pager
    ```

4.  **Check Port Collision**:
    Ensure no other process is using port 3000:
    ```bash
    sudo fuser -k 3000/tcp
    sudo systemctl restart nexus-agent
    ```

---

## 🔍 7. Verification & Launch
1.  Navigate to `http://<YOUR_UBUNTU_IP>` in your browser.
2.  Check the **Sidebar Status**: It must show **"Hardware Native"** (Green).
3.  Go to **Multi-WAN**: Verify that your real hardware interfaces (e.g., `eth0`, `enp1s0`) are detected.
