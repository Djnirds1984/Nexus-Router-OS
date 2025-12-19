# Nexus Router OS: Complete Deployment Guide (Ubuntu x64)

Follow these instructions to install Nexus Router OS on your Ubuntu PC or Router. This guide configures the system to run out of `/var/www/html` using the default Nginx configuration and PM2 for process management.

---

## 🏗️ 1. System Preparation & Prerequisites
Update your package list and install the necessary software stack (Git, Nginx, Node.js, and PM2).

```bash
# Update and upgrade system
sudo apt update && sudo apt upgrade -y

# Install Git and Nginx
sudo apt install git nginx -y

# Install Node.js (Latest LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (Process Manager)
sudo npm install pm2 -g
```

---

## 📂 2. Project Installation
We will clone the repository directly into the standard web root.

```bash
# 1. Clean out the default Nginx index files
sudo rm -rf /var/www/html/*

# 2. Clone the official repository
# Note: We clone to a temporary folder first to ensure we get all hidden files (.git, etc.)
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git /tmp/nexus-os

# 3. Move the project to the web root
sudo cp -r /tmp/nexus-os/* /var/www/html/
sudo cp -r /tmp/nexus-os/.* /var/www/html/ 2>/dev/null || true

# 4. FIX PERMISSIONS (Prevents 403 Forbidden Errors)
# Nginx runs as 'www-data'. It must own the files to serve them.
sudo chown -R www-data:www-data /var/www/html
sudo find /var/www/html -type d -exec chmod 755 {} \;
sudo find /var/www/html -type f -exec chmod 644 {} \;
```

---

## 🛠️ 3. Nginx Default Configuration
We will update the **default** Nginx site to support Single Page Application (SPA) routing and correct MIME types for modern browser module imports.

1. Edit the default config:
   `sudo nano /etc/nginx/sites-available/default`

2. Ensure the `server` block looks exactly like this:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    # The directory where you installed the project
    root /var/www/html;
    index index.html;

    server_name _;

    location / {
        # This line is critical for React routing
        try_files $uri $uri/ /index.html;
    }

    # CRITICAL: Since this project imports .tsx directly in the browser, 
    # Nginx must tell the browser it is a JavaScript file.
    location ~* \.(tsx|ts)$ {
        default_type application/javascript;
        add_header Content-Type application/javascript;
    }

    # Cache static assets for speed
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Logs for debugging
    error_log /var/log/nginx/nexus_error.log;
    access_log /var/log/nginx/nexus_access.log;
}
```

3. Save (Ctrl+O, Enter) and Exit (Ctrl+X).
4. Restart Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🚀 4. PM2 Setup & Automation
Use PM2 to ensure the system is monitored and background services stay alive.

```bash
# Navigate to project
cd /var/www/html

# Start a monitor process for the Nexus Router environment
# This keeps the dashboard directory 'active' and monitors for changes
pm2 start "ls -la" --name "nexus-router-os" --watch

# Configure PM2 to start automatically on system boot
pm2 startup
# (COPY AND PASTE THE COMMAND PM2 OUTPUTS ABOVE IN YOUR TERMINAL)

# Save the current process list
pm2 save
```

---

## 🔍 5. Troubleshooting Common Errors

### Error: 403 Forbidden
This is caused by Nginx not having permission to read your files. 
**Fix:** Run `sudo chown -R www-data:www-data /var/www/html`.

### Error: 404 on Refresh
This happens if you refresh the page on a path like `/wan` or `/settings`.
**Fix:** Ensure your Nginx config has the `try_files $uri $uri/ /index.html;` line.

### Error: "contentScript.js" (Chrome Extension Error)
If you see `TypeError: Cannot read properties of null (reading 'indexOf')` in your console, **ignore it**. This is caused by browser extensions (like Google Translate or Grammarly) and is NOT a bug in the Nexus Router OS code.

---
**Repository:** [https://github.com/Djnirds1984/Nexus-Router-OS.git](https://github.com/Djnirds1984/Nexus-Router-OS.git)
*System: Nexus Router OS v1.2.4 (Ubuntu x64 Optimization)*