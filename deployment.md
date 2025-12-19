# 🌐 Nexus OS Router: Absolute Ubuntu x64 Deployment Manual

This guide transforms a standard Ubuntu x64 PC into a professional Multi-WAN Load Balancer.

---

## 🚀 CRITICAL: Fix 502 Bad Gateway / Crash Loop
If `systemctl status nexus-agent` shows **failed**, the Node environment is missing dependencies because of frontend peer conflicts. Run this exact sequence:

```bash
# 1. Enter directory
cd /var/www/html/Nexus-Router-Os

# 2. Force clean install of ONLY backend dependencies
# This avoids the React 19 / Recharts conflict
sudo rm -rf node_modules package-lock.json
sudo npm install express cors --save

# 3. Restart the agent
sudo systemctl restart nexus-agent

# 4. Verify it's running
sudo systemctl status nexus-agent
```

---

## 📂 1. Directory Setup (Mandatory)
The app **must** reside in `/var/www/html/Nexus-Router-Os`.

```bash
sudo mkdir -p /var/www/html/Nexus-Router-Os
sudo chown -R $USER:$USER /var/www/html/Nexus-Router-Os
cd /var/www/html/Nexus-Router-Os
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git .
```

---

## ⚡ 2. Systemd Service Config
Ensure the service is configured to restart and has a 10s delay to prevent crash-rate-limiting.

```bash
sudo nano /etc/systemd/system/nexus-agent.service
```

**Paste this exact content:**
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

```bash
sudo systemctl daemon-reload
sudo systemctl enable nexus-agent
sudo systemctl start nexus-agent
```

---

## 🎨 3. Nginx Web Config
```bash
sudo nano /etc/nginx/sites-available/nexus
```

**Paste this:**
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
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/nexus /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx
```

---

## 🔍 4. Verification
1. Open browser to `http://<IP_ADDRESS>`.
2. Check if **"Hardware Native"** (Green) appears in the sidebar.
3. If still red/yellow, run `sudo journalctl -u nexus-agent -n 20` to see real-time error logs.
