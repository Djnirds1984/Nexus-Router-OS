# 🌐 Nexus OS Router: The Ultimate Ubuntu x64 Deployment Guide

This guide provides the complete, step-by-step instructions to turn a standard Ubuntu PC into a high-performance, AI-powered Multi-WAN Router.

---

## 🏗️ 1. Hardware Requirements
*   **CPU**: x86_64 (Intel/AMD) with at least 2 cores.
*   **RAM**: 2GB minimum (4GB recommended for AI heavy workloads).
*   **NICs (Network Cards)**: 
    *   **1x LAN Port**: For your internal network switch/access point.
    *   **2x (or more) WAN Ports**: For your ISP connections (Fiber, Starlink, 5G, etc.).
*   **Storage**: 16GB+ SSD.

---

## 🐧 2. Operating System Setup
1.  Install **Ubuntu 24.04 LTS (Server or Desktop)**.
2.  During installation, ensure **OpenSSH Server** is enabled for remote management.
3.  Perform a full system update:
    ```bash
    sudo apt update && sudo apt upgrade -y
    ```

---

## 🛠️ 3. Core Dependencies Installation
Nexus OS requires Node.js for the hardware agent and Nginx to serve the dashboard.

```bash
# Install Node.js, NPM, and Nginx
sudo apt install nodejs npm nginx git -y

# Verify versions
node -v  # Should be 18.x or higher
```

---

## 📂 4. Project Initialization (GitHub Setup)
If you are pulling from a repository, follow these steps:

```bash
# Create the Nexus system directory
sudo mkdir -p /opt/nexus
sudo chown $USER:$USER /opt/nexus
cd /opt/nexus

# Clone the project (Replace with your actual repo URL if hosted)
# git clone https://github.com/YourUsername/Nexus-Router-OS.git .

# Alternatively, manually create the files:
# Create server.js (Copy code from project files)
# Create index.html and index.tsx (Copy code from project files)

# Install Agent dependencies
npm init -y
npm install express cors
```

---

## ⚡ 5. Deploying the Nexus Core Agent (Backend)
The agent needs to run as `root` to modify routing tables. We use `systemd` to ensure it starts on boot.

1.  Create the service file:
    ```bash
    sudo nano /etc/systemd/system/nexus-agent.service
    ```
2.  Paste the following configuration:
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
3.  Enable and start:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable nexus-agent
    sudo systemctl start nexus-agent
    ```

---

## 🌐 6. Kernel Hardening & Performance Tuning
To act as a router, the Ubuntu kernel must be configured to forward packets and use high-speed congestion algorithms.

1.  Open sysctl config: `sudo nano /etc/sysctl.conf`
2.  Append these optimized parameters:
    ```ini
    # Enable IPv4 Forwarding
    net.ipv4.ip_forward=1

    # Enable BBR TCP Congestion Control (Google's algo for better speed)
    net.core.default_qdisc=fq
    net.ipv4.tcp_congestion_control=bbr

    # Protect against spoofing
    net.ipv4.conf.all.rp_filter=1
    net.ipv4.conf.default.rp_filter=1

    # Maximize network buffer sizes
    net.core.rmem_max=16777216
    net.core.wmem_max=16777216
    ```
3.  Apply the parameters:
    ```bash
    sudo sysctl -p
    ```

---

## 🎨 7. Serving the Dashboard (Frontend)
Nginx will serve the React-based UI.

1.  Copy the frontend files to the web root:
    ```bash
    sudo cp /opt/nexus/index.html /var/www/html/
    sudo cp /opt/nexus/index.tsx /var/www/html/
    # Ensure standard permissions
    sudo chown -R www-data:www-data /var/www/html
    ```
2.  Configure Nginx to allow larger payloads and CORS if necessary, though the defaults for a single-page app usually suffice.
3.  Restart Nginx:
    ```bash
    sudo systemctl restart nginx
    ```

---

## 🧠 8. AI Advisor Configuration
To use the **AI Advisor (Gemini)**, you must ensure the environment has access to an API Key.
The UI expects `process.env.API_KEY`. In the `index.html` file, you should replace the empty string in the global `window.process` object with your actual Gemini API key if not handled by a secure vault.

---

## 🔍 9. Final Verification
1.  Open your browser and navigate to `http://<your-router-ip>`.
2.  Check the **Kernel Bridge** indicator in the bottom-left sidebar.
    *   **Green (Hardware Native)**: Successfully talking to the Ubuntu Agent.
    *   **Amber (Simulated)**: Check if `nexus-agent` is running (`sudo systemctl status nexus-agent`).
3.  Go to the **Multi-WAN** tab and click **Sync Config to Ubuntu Kernel**. 
4.  Run `ip route` in your terminal to see the real-time multipath routes applied by Nexus OS!

---

## 🆘 Troubleshooting
*   **Error: Permission Denied**: Ensure `server.js` is running as `root` (via the systemd service).
*   **Dashboard shows no interfaces**: Ensure `iproute2` is installed (`sudo apt install iproute2 -y`).
*   **AI fails**: Check browser console for Gemini API errors or quota limits.
