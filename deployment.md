# Nexus Router OS: Production Deployment Guide (Ubuntu x64)

This guide provides the final, stable configuration to fix **403 Forbidden**, **MIME type (octet-stream)**, and **PM2 PID invalid** errors.

---

## 🏗️ 1. System Preparation
Run these commands to ensure your Ubuntu environment has the correct stack.

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Git and Nginx
sudo apt install git nginx -y

# 3. Install Node.js 20 (Required for PM2 and background tasks)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Install PM2 Globally
sudo npm install pm2 -g
```

---

## 📂 2. Clean Installation (Web Root)
Ensure the files are placed correctly in `/var/www/html`.

```bash
# 1. Clear out existing files
sudo rm -rf /var/www/html/*

# 2. Clone the repository
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git /tmp/nexus-os

# 3. Move files to web root (including hidden files)
sudo cp -r /tmp/nexus-os/* /var/www/html/
sudo cp -r /tmp/nexus-os/.* /var/www/html/ 2>/dev/null || true

# 4. FIX PERMISSIONS (Prevents 403 Errors)
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
```

---

## 🛠️ 3. Nginx Configuration (The "MIME Fix")
This configuration forces Nginx to tell the browser that `.tsx` and `.ts` files are JavaScript modules.

1. Open the default site config:
   `sudo nano /etc/nginx/sites-available/default`

2. Replace the **entire contents** with this exact block:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html;
    server_name _;

    # Support for React Routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # CRITICAL: Fix for "MIME type application/octet-stream"
    location ~* \.(tsx|ts)$ {
        types {
            application/javascript tsx ts;
        }
        default_type application/javascript;
        add_header Content-Type application/javascript;
    }

    # Static Assets Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    error_log /var/log/nginx/nexus_error.log;
    access_log /var/log/nginx/nexus_access.log;
}
```

3. Test and restart:
   `sudo nginx -t && sudo systemctl restart nginx`

---

## 🚀 4. PM2 "Nuclear Reset" & Stable Process
The "Invalid PID" error happens when PM2's internal state gets corrupted or the process exits too fast. Run these steps to fix it.

```bash
# 1. Clear PM2 state completely
pm2 kill

# 2. Start a persistent background service (using the new nexus-daemon.js)
cd /var/www/html
pm2 start nexus-daemon.js --name "nexus-core"

# 3. Setup auto-boot
pm2 startup
# (Copy and paste the command PM2 prints in your terminal)
pm2 save
```

---

## 🔍 5. Troubleshooting
- **403 Forbidden**: Ensure `/var/www/html` and all parent folders (like `/var/www`) are readable by Nginx. Run `sudo chmod 755 /var/www`.
- **MIME Error**: If you still see `application/octet-stream`, clear your browser cache (Ctrl+Shift+R) after restarting Nginx.
- **Chrome Extension Error**: Errors mentioning `contentScript.js` or `indexOf` are caused by browser extensions (Grammarly, etc.). They do not affect the functionality of Nexus OS. Use **Incognito Mode** to verify.

---
**GitHub:** [https://github.com/Djnirds1984/Nexus-Router-OS.git](https://github.com/Djnirds1984/Nexus-Router-OS.git)