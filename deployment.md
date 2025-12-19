
# Nexus Router OS: Deployment Guide (Ubuntu x64)

The **500 Internal Server Error** happens because Nginx (running as `www-data`) is forbidden from entering the `/root/` directory. 

---

## 🚀 The "Nuclear" Fix Script
Copy and paste this entire block into your terminal to fix the permissions and Nginx config automatically:

```bash
# 1. Prepare the web directory
sudo mkdir -p /var/www/nexus-os
sudo cp -r /root/Nexus-Router-OS/dist/* /var/www/nexus-os/

# 2. Fix Permissions (Crucial step)
sudo chown -R www-data:www-data /var/www/nexus-os
sudo chmod -R 755 /var/www/nexus-os

# 3. Overwrite Nginx Config with a Bulletproof Version
sudo tee /etc/nginx/sites-available/default <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root /var/www/nexus-os;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Custom logging for your app
    error_log /var/log/nginx/nexus_error.log;
    access_log /var/log/nginx/nexus_access.log;
}
EOF

# 4. Final Restart
sudo nginx -t && sudo systemctl restart nginx
```

---

## 🔍 Troubleshooting the 500 Error
If you still see a "500 Internal Server Error" after running the script:
1. **Check the logs:** `sudo tail -n 50 /var/log/nginx/nexus_error.log`
2. **Missing Files:** Ensure the folder `/var/www/nexus-os` actually contains `index.html`. 
   - Run: `ls -l /var/www/nexus-os`
   - If it's empty, you didn't run `npm run build` inside your project folder before copying.

## 💡 About the `contentScript.js` Error
The error `Uncaught TypeError: Cannot read properties of null (reading 'indexOf')` in your browser console is **NOT** related to your server or the Nexus OS code. 
- It is caused by a **Browser Extension** (likely a Password Manager or AdBlocker).
- It will disappear if you open the dashboard in an **Incognito Window**.

---

## 🛠️ Post-Setup: AI Advisor
Once the dashboard is visible, go to the **AI Advisor** tab. Ask: 
> "Generate the /etc/nftables.conf for a multi-WAN setup with load balancing for enp1s0 and enp2s0 on Ubuntu 24.04."

*Repository: https://github.com/Djnirds1984/Nexus-Router-OS.git*
