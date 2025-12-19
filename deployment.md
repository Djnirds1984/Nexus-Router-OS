# Nexus Router OS: Complete Deployment Guide (Ubuntu x64)

Follow these steps to deploy Nexus Router OS on a clean Ubuntu x64 machine. This guide sets up the project in the root `/var/www/html` directory using the default Nginx configuration.

---

## 🏗️ 1. Environment Preparation
Update your Ubuntu system and install the core dependencies.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install nginx git -y
```

---

## 📂 2. Project Installation
We will clone the repository contents directly into the standard web root `/var/www/html`.

```bash
# 1. Clean out the default Nginx files
sudo rm -rf /var/www/html/*

# 2. Clone the repository into a temporary location and move it to the web root
# (Cloning directly into /var/www/html requires an empty directory)
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git /tmp/nexus-os
sudo cp -r /tmp/nexus-os/* /var/www/html/
sudo cp -r /tmp/nexus-os/.* /var/www/html/ 2>/dev/null || true

# 3. Set ownership to the Nginx user (www-data)
# This is mandatory for Nginx to serve the files correctly.
sudo chown -R www-data:www-data /var/www/html

# 4. Apply correct filesystem permissions
sudo find /var/www/html -type d -exec chmod 755 {} \;
sudo find /var/www/html -type f -exec chmod 644 {} \;
```

---

## 🛠️ 3. Nginx Configuration (Default Site)
Instead of creating a new file, we will modify the existing Nginx default configuration.

1. Open the default configuration file:
   `sudo nano /etc/nginx/sites-available/default`

2. Replace the content of the `server { ... }` block with this optimized configuration:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    # Point to the root directory where the project is installed
    root /var/www/html;
    index index.html;

    server_name _;

    location / {
        # Support React client-side routing
        try_files $uri $uri/ /index.html;
    }

    # CRITICAL: Serve .tsx files as Javascript modules for the browser
    location ~* \.(tsx|ts)$ {
        add_header Content-Type application/javascript;
    }

    # Optional: Cache static assets to improve performance
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Error and Access logs
    error_log /var/log/nginx/nexus_os_error.log;
    access_log /var/log/nginx/nexus_os_access.log;
}
```

3. Save and Exit (Ctrl+O, Enter, Ctrl+X).

4. Restart Nginx to apply the changes:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔍 4. Verification & Diagnostics

### Check Installation Path
Verify that your files are in the right place:
`ls -la /var/www/html`

### Troubleshooting "Black Screen"
If the page loads but nothing shows:
1. Open Browser Console (F12).
2. If you see a MIME type error (e.g., "Expected a JavaScript module script but the server responded with a MIME type of text/plain"), ensure the `location ~* \.(tsx|ts)$` block is correctly added to your Nginx config.
3. If you see a 403 Forbidden, ensure you ran the `chown` command in Step 2.

---
**GitHub Repository:** [https://github.com/Djnirds1984/Nexus-Router-OS.git](https://github.com/Djnirds1984/Nexus-Router-OS.git)
*Built for high-performance Ubuntu routing and load balancing.*