
# Nexus Router OS: Deployment Guide (Ubuntu x64)

The "Connection Refused" error in your logs happens because Nginx is looking for a development server on port 5173 that isn't started. **Follow these steps to switch to Static Mode (Professional Router Setup).**

---

## 1. Prepare the "Real Project" Files
You must turn the source code into optimized browser files. Run these commands inside the `Nexus-Router-OS` folder:

```bash
# 1. Install dependencies
npm install

# 2. Build the production files
npm run build
```
*This creates a folder named `dist`. These are the "real" files Nginx needs to show.*

---

## 2. Definitive Nginx Fix (Static Mode)
We are going to delete the old "Proxy" configuration and tell Nginx exactly where the `dist` folder is.

### Step 1: Replace the entire Nginx config
Run `sudo nano /etc/nginx/sites-available/default` and **delete everything**, then paste this:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # CHANGE THIS: Point it to your actual 'dist' folder path
    # Example: /home/ubuntu/Nexus-Router-OS/dist
    root /PATH/TO/YOUR/Nexus-Router-OS/dist;
    
    index index.html;

    location / {
        # This line is critical for React routing
        try_files $uri $uri/ /index.html;
    }

    # Custom 404 page pointing back to dashboard
    error_page 404 /index.html;

    # Performance optimizations for the router UI
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public";
    }
}
```

### Step 2: Fix Home Directory Permissions (CRITICAL)
Nginx often can't "see" into your `/home` folder. Run this to give Nginx permission:
```bash
# Replace 'YOUR_USER' with your Ubuntu username (e.g., 'ubuntu')
chmod o+x /home/YOUR_USER
chmod -R o+r /home/YOUR_USER/Nexus-Router-OS/dist
```

### Step 3: Restart and Verify
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 3. Alternative: Quick Dev Start
If you just want to see it working **right now** without changing Nginx:
1. Open a terminal in the project folder.
2. Run `npm run dev`.
3. Keep that terminal open. The dashboard will now appear at your IP.

---

## 4. Why the logs showed errors?
Your logs showed `upstream: "http://127.0.0.1:5173/"`. This means Nginx was acting as a middle-man, but there was nobody at the other end (port 5173) to talk to. By following the **Static Mode** instructions above, you remove the middle-man and Nginx reads the files directly from the disk.

*Repository: https://github.com/Djnirds1984/Nexus-Router-OS.git*
