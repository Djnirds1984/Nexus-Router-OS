# Nexus Router OS: Ultimate Deployment Guide (Ubuntu x64)

This guide addresses common errors like **403 Forbidden** and **MIME type mismatches** while deploying to a standard Ubuntu x64 environment.

---

## 🏗️ 1. Essential Stack Installation
Run these commands to prepare your Ubuntu environment.

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Git and Nginx
sudo apt install git nginx -y

# Install Node.js 20 (Required for PM2 and system updates)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 Process Manager globally
sudo npm install pm2 -g
```

---

## 📂 2. Project Setup (Web Root)
We will install the project directly into `/var/www/html`.

```bash
# 1. Clear existing default files
sudo rm -rf /var/www/html/*

# 2. Clone the repository
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git /tmp/nexus-os

# 3. Copy project to web root (including hidden files)
sudo cp -r /tmp/nexus-os/* /var/www/html/
sudo cp -r /tmp/nexus-os/.* /var/www/html/ 2>/dev/null || true

# 4. CRITICAL: Fix Permissions (SOLVES 403 FORBIDDEN)
# Nginx must be able to read and execute directories.
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
```

---

## 🛠️ 3. Nginx Configuration (Default File)
We must tell Nginx to treat `.tsx` files as JavaScript. This solves the "application/octet-stream" error.

1. Open the default config:
   `sudo nano /etc/nginx/sites-available/default`

2. Replace the **entire** file content with this:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html;

    server_name _;

    location / {
        # Critical for React routing
        try_files $uri $uri/ /index.html;
    }

    # CRITICAL: SOLVES MIME TYPE "application/octet-stream" ERROR
    # This block forces .tsx and .ts files to be served as JavaScript
    location ~* \.(tsx|ts)$ {
        types { }
        default_type application/javascript;
        add_header Content-Type application/javascript;
    }

    # Performance: Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    error_log /var/log/nginx/nexus_error.log;
    access_log /var/log/nginx/nexus_access.log;
}
```

3. Save and Exit (Ctrl+O, Enter, Ctrl+X).
4. Restart Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🚀 4. PM2 Setup
Configure PM2 to monitor the dashboard and ensure background services persist after reboots.

```bash
# Start a monitoring instance
cd /var/www/html
pm2 start "ls -la" --name "nexus-router" --watch

# Configure auto-boot
pm2 startup
# (Run the specific line the command above tells you to run)
pm2 save
```

---

## 🔍 5. Error Troubleshooting Guide

### ❌ 403 Forbidden
**Cause:** Nginx does not have permission to access `/var/www/html` or one of its parent folders.
**Fix:** Run `sudo chmod 755 /var/www && sudo chmod 755 /var/www/html`.

### ❌ Failed to load module (application/octet-stream)
**Cause:** Nginx thinks `.tsx` is a binary file and tells the browser to download it instead of running it.
**Fix:** Ensure the `location ~* \.(tsx|ts)$` block in your Nginx config has `default_type application/javascript;`.

### ❌ "Cannot read properties of null (reading 'indexOf')"
**Cause:** This is a **Browser Extension Error** (Grammarly, Loom, etc.). 
**Fix:** This is NOT a bug in the project. Open the site in **Incognito Mode** to verify it disappears.

---
**GitHub Repository:** [https://github.com/Djnirds1984/Nexus-Router-OS.git](https://github.com/Djnirds1984/Nexus-Router-OS.git)
*Nexus Router OS - Developed for high-performance Ubuntu routing environments.*