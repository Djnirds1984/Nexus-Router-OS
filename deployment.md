
# Nexus Router OS: Deployment Guide (Ubuntu x64)

**CRITICAL FIX:** You are seeing a 500 Error because Nginx cannot access the `/root/` folder. Follow these steps to move the project to a public location.

---

## ⚡ The "Exit Root" Migration
Run these commands to move your build out of the restricted root folder and into the web server's safe zone.

```bash
# 1. Create the target directory
sudo mkdir -p /var/www/nexus-os

# 2. Copy the 'dist' folder from your current location
# (Run this as root/sudo)
sudo cp -r /root/Nexus-Router-OS/dist /var/www/nexus-os/

# 3. Set the correct owner (www-data is the Nginx user)
sudo chown -R www-data:www-data /var/www/nexus-os

# 4. Set directory permissions (755 is standard)
sudo chmod -R 755 /var/www/nexus-os
```

---

## 🛠️ Updated Nginx Configuration
Now, update Nginx to look at the new path.

### Step 1: Edit the config
`sudo nano /etc/nginx/sites-available/default`

### Step 2: Paste this EXACT content
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # THE NEW SAFE PATH
    root /var/www/nexus-os/dist;
    index index.html;

    location / {
        # This handles the React Single Page App routing
        try_files $uri $uri/ /index.html;
    }

    # Logging for diagnostics
    error_log /var/log/nginx/nexus_error.log;
    access_log /var/log/nginx/nexus_access.log;
}
```

### Step 3: Test and Restart
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔍 How to Verify the Fix
If you still see an error, check the logs specifically created for this app:
`sudo tail -f /var/log/nginx/nexus_error.log`

If you see **"Permission Denied"**, it means the `chown` command in Step 3 failed or wasn't run.

*Repository: https://github.com/Djnirds1984/Nexus-Router-OS.git*
