# Nexus Router OS: Ubuntu Deployment Guide

This guide ensures a 100% working install by serving the application through Nginx with the correct permissions.

---

## 🏗️ 1. Install Basics
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install git nginx -y
```

---

## 📂 2. Clone & Setup Permissions
```bash
# Clean the default folder
sudo rm -rf /var/www/html/*

# Clone project
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git /tmp/nexus
sudo cp -r /tmp/nexus/* /var/www/html/

# CRITICAL: Permissions (Prevents 403 Errors)
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
```

---

## 🛠️ 3. Nginx Config
Edit the default config: `sudo nano /etc/nginx/sites-available/default`
Ensure it looks like this:

```nginx
server {
    listen 80;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # MANDATORY: Fix for TSX MIME type
    location ~* \.tsx$ {
        default_type application/javascript;
        add_header Content-Type application/javascript;
    }
}
```

Restart Nginx: `sudo systemctl restart nginx`

---

## 🔍 Why This Works Now
- **No Complex Imports**: All code is in `index.tsx`. The browser doesn't have to hunt for files.
- **Babel Standalone**: The browser compiles the JSX on the fly. This fixes the `Unexpected token '<'` error.
- **Incognito Mode**: If you still see errors, please use **Incognito Mode** to bypass your browser extensions (like Grammarly) which cause the `contentScript.js` errors.
