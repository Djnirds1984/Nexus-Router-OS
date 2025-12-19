# Nexus Router OS: Deployment Guide (Ubuntu x64)

The project is now unified under a single, Nginx-accessible directory to prevent 500 Internal Server Errors and permission conflicts.

---

## 🚀 Unified Project Migration
Run these commands to move the entire project from any location (like `/root/`) to the standard web root. This ensures Nginx has full visibility.

```bash
# 1. Create the unified project directory
sudo mkdir -p /var/www/html/nexus-os

# 2. Move your project files here (replace /path/to/current with your current location)
# Example: sudo cp -r /root/Nexus-Router-OS/* /var/www/html/nexus-os/
sudo cp -r ./* /var/www/html/nexus-os/

# 3. Set ownership and permissions for the entire project
sudo chown -R www-data:www-data /var/www/html/nexus-os
sudo chmod -R 755 /var/www/html/nexus-os

# 4. (Optional) If you are building from source inside this directory:
# cd /var/www/html/nexus-os
# sudo -u www-data npm install
# sudo -u www-data npm run build
```

---

## 🛠️ Bulletproof Nginx Configuration
Update your Nginx config to point directly to the project folder.

### Step 1: Edit the config
`sudo nano /etc/nginx/sites-available/default`

### Step 2: Apply this configuration
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # Unified Path
    root /var/www/html/nexus-os/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Centralized Logging within the project scope
    error_log /var/log/nginx/nexus_os_error.log;
    access_log /var/log/nginx/nexus_os_access.log;
}
```

### Step 3: Reload Services
```bash
sudo nginx -t && sudo systemctl restart nginx
```

---

## 🔍 Path Validation
To confirm your files are in the right place, run:
`ls -la /var/www/html/nexus-os`

You should see your `index.html`, `App.tsx`, and the `dist` folder all within this single hierarchy.

*Repository: https://github.com/Djnirds1984/Nexus-Router-OS.git*