# 🌐 Nexus OS Router: Absolute Ubuntu x64 Deployment Manual

This is the definitive guide to deploying the Nexus Router OS. Following these instructions will transform a standard Ubuntu x64 PC into a professional Multi-WAN Load Balancer and Failover Router.

---

## 🏗️ 1. Hardware Preparation
*   **Host**: Ubuntu 24.04 LTS (x86_64).
*   **Network**: At least 3 Physical Ethernet Ports (1 LAN, 2 WAN).
*   **User**: Must have `sudo` privileges.

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

# 3. Install the Backend Agent dependencies
# IMPORTANT: Use --legacy-peer-deps to resolve Recharts/React version conflicts
npm install express cors --legacy-peer-deps
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

    [Install]
    WantedBy=multi-user.target
    ```
3.  **Start the Service**:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable nexus-agent
    sudo systemctl start nexus-agent
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
        }
    }
    ```
3.  **Activate and Restart**:
    ```bash
    sudo ln -s /etc/nginx/sites-available/nexus /etc/nginx/sites-enabled/
    sudo rm /etc/nginx/sites-enabled/default
    sudo systemctl restart nginx
    ```

---

## 🔍 7. Verification & Launch
1.  Navigate to `http://<YOUR_UBUNTU_IP>` in your browser.
2.  Check the **Sidebar Status**: It must show **"Hardware Native"** (Green).
3.  Go to **Multi-WAN**: Verify that your real hardware interfaces (e.g., `eth0`, `enp1s0`) are detected.
4.  Configure your weights/priorities and click **"Sync Config to Ubuntu Kernel"**.

---

## 🧠 8. AI Advisor & Updates
*   **AI**: Enter your Gemini API Key in the **AI Advisor** tab to get live optimization scripts based on your specific traffic patterns.
*   **Updates**: Use the **Updates** tab to pull the latest changes directly from the repository. The system will automatically run `git pull` and restart services.
