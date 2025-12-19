# 🌐 Nexus OS Router: Full Ubuntu x64 Deployment Manual

This guide covers the complete installation of the Nexus Router OS from scratch on an Ubuntu x64 PC. This system enables real-world Multi-WAN Load Balancing, Auto-Failover, and AI-driven network optimization.

---

## 🏗️ 1. Hardware Requirements
*   **CPU**: x86_64 (Intel/AMD) with 2+ cores.
*   **RAM**: 2GB+ (4GB recommended).
*   **NICs (Network Interfaces)**: 
    *   **Port 1 (LAN)**: Connect to your internal network.
    *   **Port 2 (WAN1)**: Primary ISP.
    *   **Port 3 (WAN2)**: Secondary ISP.
*   **Storage**: 16GB+ SSD.

---

## 🐧 2. Ubuntu OS Setup
1.  Download and install **Ubuntu 24.04 LTS**.
2.  Enable **OpenSSH Server** during installation.
3.  Once installed, log in and update the system:
    ```bash
    sudo apt update && sudo apt upgrade -y
    ```

---

## 📂 3. Repository Installation
You must clone the official Nexus Router repository to your host machine.

```bash
# 1. Install Git and Node.js dependencies
sudo apt install git nodejs npm nginx -y

# 2. Clone the repository from GitHub
cd /opt
sudo git clone https://github.com/Djnirds1984/Nexus-Router-OS.git nexus
sudo chown -R $USER:$USER /opt/nexus
cd /opt/nexus

# 3. Install Core Agent dependencies
npm install express cors
```

---

## ⚡ 4. Deploying the Nexus Core Agent (Backend)
The Core Agent allows the browser UI to talk to the Linux Kernel. It must run as root.

1.  Create the system service:
    ```bash
    sudo nano /etc/systemd/system/nexus-agent.service
    ```
2.  Paste the following:
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
3.  Enable and start the service:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable nexus-agent
    sudo systemctl start nexus-agent
    ```

---

## 🌐 5. Kernel Networking Optimization
Run these commands to prepare Ubuntu for high-speed routing:

```bash
# Enable IPv4 Forwarding and BBR Congestion Control
sudo tee -a /etc/sysctl.conf <<EOF
net.ipv4.ip_forward=1
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.all.send_redirects=0
EOF

# Apply the changes
sudo sysctl -p
```

---

## 🎨 6. Serving the Dashboard (Frontend)
Nginx will host the Nexus Dashboard.

1.  Copy the frontend files:
    ```bash
    sudo cp /opt/nexus/index.html /var/www/html/
    sudo cp /opt/nexus/index.tsx /var/www/html/
    ```
2.  Verify Nginx is running:
    ```bash
    sudo systemctl restart nginx
    ```

---

## 🔍 7. Post-Installation Check
1.  Open your browser to `http://<your-pc-ip>`.
2.  Confirm the **"Kernel Bridge"** status in the sidebar is **Green (Hardware Native)**.
3.  Navigate to **Multi-WAN** to see your physical interfaces listed (e.g., `enp1s0`, `enp2s0`).
4.  Configure your weights/priorities and click **"Sync Config to Ubuntu Kernel"**.

---

## 🧠 8. AI Advisor Integration
To enable the AI Neuralink:
1.  Obtain a Gemini API key from Google AI Studio.
2.  The application will request your API key via the **"AI Advisor"** tab or you can set the `API_KEY` environment variable in the agent service.

---

## 🆘 Troubleshooting
*   **"Simulated Env" status**: Ensure the `nexus-agent` is running on port 3000. Check logs with `sudo journalctl -u nexus-agent -f`.
*   **No Interfaces Found**: Ensure your user has permissions to run `ip` commands or that the agent is running as `root`.