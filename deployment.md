
# Nexus Router OS: Deployment Guide (Ubuntu x64)

If you are seeing a **500 Internal Server Error**, Nginx is likely blocked by Ubuntu's security permissions (AppArmor or simple folder permissions).

---

## ⚡ The "One-Command" Fix (Move to Safe Zone)
Nginx struggles to read files inside `/home`. The most stable way to run this router dashboard is to move it to the standard web directory.

Run these commands in order:

```bash
# 1. Move the project to a safe location
sudo cp -r ~/Nexus-Router-OS /var/www/nexus-os

# 2. Set the owner to the web server user
sudo chown -R www-data:www-data /var/www/nexus-os

# 3. Ensure the folder has correct permissions
sudo chmod -R 755 /var/www/nexus-os
```

---

## 🛠️ Updated Nginx Configuration
Now, update your Nginx config to point to this new, safe location.

### Step 1: Edit the config
`sudo nano /etc/nginx/sites-available/default`

### Step 2: Paste this EXACT content
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # Safe path with correct permissions
    root /var/www/nexus-os/dist;
    index index.html;

    location / {
        # This handles the React Single Page App routing
        try_files $uri $uri/ /index.html;
    }

    # Avoid 500 errors by not using custom error pages that might not exist
    error_log /var/log/nginx/nexus_error.log;
    access_log /var/log/nginx/nexus_access.log;
}
```

### Step 3: Restart
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔍 Still seeing a 500 Error?
If the error persists, run this command to see the *exact* reason:
`sudo tail -n 20 /var/log/nginx/nexus_error.log`

**Common log messages and their meanings:**
*   `permission denied`: You missed the `chown` or `chmod` steps above.
*   `no such file or directory`: The path `/var/www/nexus-os/dist` doesn't exist. Make sure you ran `npm run build` before copying the folder.

---

## 🚀 Post-Installation
Once you see the dashboard:
1. Go to **AI Advisor**.
2. Ask: "I am on Ubuntu 24.04, generate the nftables rules for my enp1s0 and enp2s0 interfaces for load balancing."
3. Copy the output into the **Terminal** tab or your Ubuntu SSH session.

*Repository: https://github.com/Djnirds1984/Nexus-Router-OS.git*
