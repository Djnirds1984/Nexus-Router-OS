
# Nexus Router OS: Deployment Guide (Ubuntu x64)

This guide provides the necessary steps to deploy the **Nexus Router OS** management dashboard and configure your Ubuntu x64 PC as a professional Multi-WAN router with Load Balancing and Auto-Failover capabilities.

---

## 1. Hardware Requirements

To use this system as a router, your Ubuntu PC requires:
*   **Architecture:** x86_64 (Intel/AMD).
*   **NICs:** At least 3 Ethernet ports (1 for LAN, 2 for WAN interfaces).
*   **Storage:** 16GB+ (Dashboard + Linux OS).
*   **RAM:** 2GB minimum (8GB+ recommended).

---

## 2. Host OS Preparation (Ubuntu 24.04 LTS)

### Enable IPv4 Forwarding
Run the following commands to enable routing:
```bash
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Install Essential Networking Tools
```bash
sudo apt update
sudo apt install -y iproute2 nftables curl nodejs npm nginx
```

---

## 3. Dashboard Installation

### Step 1: Clone and Install
```bash
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git
cd Nexus-Router-OS
npm install
```

### Step 2: Environment Configuration
Ensure your Gemini API Key is available to power the **AI Advisor**:
```bash
export API_KEY='your_google_gemini_api_key'
```

### Step 3: Production Service
It is recommended to use `pm2` to keep the dashboard running:
```bash
sudo npm install -g pm2
pm2 start npm --name "nexus-os" -- run dev
```

---

## 4. Nginx Configuration (Default Site)

Instead of creating a new configuration, we will modify the default Ubuntu Nginx site to proxy traffic to our dashboard.

### Step 1: Edit Default Configuration
```bash
sudo nano /etc/nginx/sites-available/default
```

### Step 2: Update the 'location /' block
Find the `location /` block inside the `server` block and replace it with the following:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html index.htm;

    server_name _;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Step 3: Restart Nginx
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 5. Configuring Multi-WAN

1.  **Orchestrate:** Go to the **Multi-WAN** tab in the dashboard.
2.  **Select Mode:** Choose between `LOAD BALANCER` or `AUTO FAILOVER`.
3.  **Generate Advice:** Navigate to the **AI Advisor** tab.
4.  **Execute:** Copy the generated commands and execute them in your terminal with `sudo`.

---

## 6. Security Hardening

*   **UFW:** `sudo ufw allow 80/tcp` (Nginx) and `sudo ufw allow 22/tcp` (SSH).
*   **Kernel:** Use the AI Advisor's suggested `sysctl` hardening commands.

---
*Repository: https://github.com/Djnirds1984/Nexus-Router-OS.git*
