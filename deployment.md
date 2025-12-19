# Nexus Router OS: Final Deployment Guide (Ubuntu x64)

This guide provides a robust configuration to eliminate **403 Forbidden**, **MIME type (octet-stream)**, and **PM2 PID** errors.

---

## 🏗️ 1. Environment Preparation
```bash
# Update and install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install git nginx -y

# Install Node.js 20 & PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install pm2 -g
```

---

## 📂 2. Project Installation & Permission Fix
Perform these steps to ensure Nginx can read the files.

```bash
# 1. Clear web root
sudo rm -rf /var/www/html/*

# 2. Clone repository
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git /tmp/nexus-os
sudo cp -r /tmp/nexus-os/* /var/www/html/
sudo cp -r /tmp/nexus-os/.* /var/www/html/ 2>/dev/null || true

# 3. FIX PERMISSIONS (Solves 403 Forbidden)
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
```

---

## 🛠️ 3. Nginx Configuration (The MIME Fix)
To solve `Failed to load module script: ... MIME type of "application/octet-stream"`, you must modify the Nginx default config.

1. Open config: `sudo nano /etc/nginx/sites-available/default`
2. **Delete everything** inside and paste this:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html;
    server_name _;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # MANDATORY: Solves index.tsx loading errors
    location ~* \.tsx$ {
        add_header Content-Type application/javascript;
        default_type application/javascript;
    }

    location ~* \.ts$ {
        add_header Content-Type application/javascript;
        default_type application/javascript;
    }

    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

3. Restart Nginx:
```bash
sudo nginx -t && sudo systemctl restart nginx
```

---

## 🚀 4. PM2 Setup (Stable Process)
The error `TypeError: One of the pids provided is invalid` happens because `ls -la` finishes too fast. Use a persistent command instead.

```bash
# Start a persistent monitoring process that doesn't exit
pm2 start "tail -f /var/log/nginx/access.log" --name "nexus-router-log-monitor"

# Save for reboot
pm2 startup
# (Execute the command PM2 gives you)
pm2 save
```

---

## 🔍 5. Technical Notes

- **Tailwind Warning**: `cdn.tailwindcss.com` is used for ease of use in this "Router Appliance" UI. In a true production build, you would run `npm run build`, but for direct browser execution of `.tsx` files via Nginx, the CDN is the correct approach for this architecture.
- **Extension Errors**: `contentScript.js` errors in the console are caused by your browser's extensions (like Grammarly or ad-blockers). They **cannot** be fixed in the code. Please test in **Incognito Mode** to see a clean console.

---
**Repository:** [https://github.com/Djnirds1984/Nexus-Router-OS.git](https://github.com/Djnirds1984/Nexus-Router-OS.git)