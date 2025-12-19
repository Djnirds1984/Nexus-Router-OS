
# Nexus Router OS: Deployment Guide (Ubuntu x64)

Follow these steps to turn your Ubuntu PC into a professional Multi-WAN Router.

## 🚀 Quick Start Checklist
1. [ ] Enable IPv4 Forwarding
2. [ ] Clone Repository
3. [ ] Build the Dashboard (`npm run build`)
4. [ ] Configure Nginx to serve the `dist` folder
5. [ ] Reboot & Login

---

## 1. Host OS Preparation (Ubuntu 24.04 LTS)

### Enable Routing
```bash
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Install Network Stack
```bash
sudo apt update
sudo apt install -y iproute2 nftables curl nodejs npm nginx
```

---

## 2. Dashboard Installation

### Build the Project
```bash
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git
cd Nexus-Router-OS
npm install
npm run build  # This creates the /dist folder
```

---

## 3. Nginx Configuration (The "Real" Fix)

The error you saw earlier happened because Nginx couldn't find a running server. We will now configure Nginx to serve the files directly from the `/dist` folder you just created.

### Replace `/etc/nginx/sites-available/default`
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # Update this path to the EXACT location of your cloned repo's dist folder
    root /home/YOUR_USERNAME/Nexus-Router-OS/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Optimization for assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }

    # Error handling
    error_page 404 /index.html;
}
```

### Apply Changes
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 4. Troubleshooting: "Dashboard service is starting..."

If you see this message, it means you are using the old **Proxy** configuration. Please follow **Step 3** above to switch to the **Static** configuration. 

**Common Fixes:**
1. **Check Permissions**: Ensure Nginx can read your home directory: `chmod o+x /home/YOUR_USERNAME`.
2. **Missing Dist**: Ensure you ran `npm run build`. If the `/dist` folder doesn't exist, the page will fail.
3. **Check Logs**: Run `sudo tail -f /var/log/nginx/error.log` to see why it's failing.

---

## 5. Kernel Orchestration
Once the dashboard is visible, use the **AI Advisor** to get the `nftables` rules for your specific hardware. Execute those rules via `sudo` to enable the actual routing logic.

*Repository: https://github.com/Djnirds1984/Nexus-Router-OS.git*
