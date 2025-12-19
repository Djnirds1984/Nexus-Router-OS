
# Nexus Router OS: Deployment Guide (Ubuntu x64)

The project is now unified under `/var/www/html/nexus-os`. This location is safe for Nginx and resolves the 500 errors.

---

## 🚀 Step 1: Migration & Permissions
Run these commands to ensure all files are in the unified directory with the correct owner.

```bash
# 1. Create the directory
sudo mkdir -p /var/www/html/nexus-os

# 2. Copy all files from your current project folder to the destination
# Run this from inside your project folder:
sudo cp -r ./* /var/www/html/nexus-os/

# 3. Apply standard web server ownership
sudo chown -R www-data:www-data /var/www/html/nexus-os
sudo chmod -R 755 /var/www/html/nexus-os
```

---

## 🛠️ Step 2: Nginx Config
Ensure your `/etc/nginx/sites-available/default` looks like this:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    # POINT THIS TO THE UNIFIED DIRECTORY
    root /var/www/html/nexus-os;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Enable logging for troubleshooting
    error_log /var/log/nginx/nexus_error.log;
    access_log /var/log/nginx/nexus_access.log;
}
```

---

## 🔍 Step 3: Troubleshooting
1. **Black Screen?** 
   Check the Console. If you see "404 Not Found" for `index.tsx`, your Nginx `root` path is slightly off or you haven't copied the files to `/var/www/html/nexus-os`.
2. **500 Error?**
   Run `sudo tail -f /var/log/nginx/nexus_error.log`. It will tell you exactly which folder is restricted.
3. **contentScript.js error?**
   **IGNORE IT.** This is caused by your Chrome extensions (like Google Translate or Dashlane). It does not affect the Router OS. Test in an **Incognito Window** to see it disappear.

*Repository: https://github.com/Djnirds1984/Nexus-Router-OS.git*
