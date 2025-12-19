# Nexus Router OS: Complete Deployment Guide (Ubuntu x64)

Follow these steps to deploy Nexus Router OS on a clean Ubuntu x64 server. This guide assumes you are installing the project into the standard web root at `/var/www/html/nexus-os`.

---

## 🏗️ 1. Environment Preparation
Ensure your system is up to date and has the necessary tools installed.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install nginx git -y
```

---

## 📂 2. Project Installation
We will clone the official repository directly into the `/var/www/html` directory.

```bash
# 1. Navigate to the web root
cd /var/www/html

# 2. Clone the repository (and rename the folder to nexus-os)
sudo git clone https://github.com/Djnirds1984/Nexus-Router-OS.git nexus-os

# 3. Enter the project directory
cd nexus-os

# 4. Set ownership to Nginx user (www-data)
# This is CRITICAL to prevent 403 Forbidden and 500 Internal Server Errors
sudo chown -R www-data:www-data /var/www/html/nexus-os

# 5. Set correct folder and file permissions
sudo find /var/www/html/nexus-os -type d -exec chmod 755 {} \;
sudo find /var/www/html/nexus-os -type f -exec chmod 644 {} \;
```

---

## 🛠️ 3. Nginx Configuration
Create a specialized configuration to serve the React application and handle client-side routing.

1. Create the configuration file:
   `sudo nano /etc/nginx/sites-available/nexus-os`

2. Paste the following configuration:

```nginx
server {
    listen 80;
    listen [::]:80;

    # Use your server IP or domain name here
    server_name _; 

    # Path to the unified project directory
    root /var/www/html/nexus-os;
    index index.html;

    location / {
        # This handles React client-side routing (Single Page App)
        try_files $uri $uri/ /index.html;
    }

    # Enable support for .tsx and .ts files as JS modules if needed
    location ~* \.(tsx|ts)$ {
        add_header Content-Type application/javascript;
    }

    # Optimization: Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Custom Logging
    error_log /var/log/nginx/nexus_os_error.log;
    access_log /var/log/nginx/nexus_os_access.log;
}
```

3. Enable the site and restart Nginx:
```bash
# Disable the default Nginx site
sudo rm -f /etc/nginx/sites-enabled/default

# Enable Nexus Router OS
sudo ln -s /etc/nginx/sites-available/nexus-os /etc/nginx/sites-enabled/

# Verify config syntax and restart
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔍 4. Verification & Troubleshooting

### Check Path Integrity
Run this command to ensure all project files are present in the target location:
`ls -la /var/www/html/nexus-os`

You should see:
- `index.html`
- `index.tsx`
- `App.tsx`
- `components/`
- `services/`
- `metadata.json`

### Error: Black Screen (UI Not Loading)
1. **Open Browser Console (F12)**.
2. If you see `404 Not Found` for `index.tsx`, verify that the file exists at `/var/www/html/nexus-os/index.tsx`.
3. Ensure the `root` path in your Nginx configuration matches exactly: `/var/www/html/nexus-os`.

### Error: 403 Forbidden or 500 Internal Server Error
This is a permission issue. Nginx cannot read your files. Fix it with:
`sudo chown -R www-data:www-data /var/www/html/nexus-os`

### Browser Extension Errors
Errors in the console referring to `contentScript.js` or `chrome-extension://` are caused by browser plugins (like Grammarly, Google Translate, or LastPass). They **do not** affect the Nexus OS logic. Use **Incognito Mode** to test without extensions.

---
**Official Repository:** [github.com/Djnirds1984/Nexus-Router-OS](https://github.com/Djnirds1984/Nexus-Router-OS.git)
*Built for high-availability Ubuntu routing environments.*