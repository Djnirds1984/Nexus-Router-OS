# Nexus Router OS: Final Deployment Guide (Ubuntu x64)

This guide fixes **MIME type** issues and **Syntax errors** when serving `.tsx` files directly via Nginx.

---

## 🏗️ 1. Environment Setup
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install git nginx -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install pm2 -g
```

---

## 📂 2. Clean Install
```bash
sudo rm -rf /var/www/html/*
git clone https://github.com/Djnirds1984/Nexus-Router-OS.git /tmp/nexus-os
sudo cp -r /tmp/nexus-os/* /var/www/html/
sudo cp -r /tmp/nexus-os/.* /var/www/html/ 2>/dev/null || true
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
```

---

## 🛠️ 3. Nginx Configuration (THE FIX)
We need Nginx to serve `.tsx` files as `application/javascript` so Babel can pick them up.

1. Edit: `sudo nano /etc/nginx/sites-available/default`
2. Replace content with:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html;
    server_name _;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # IMPORTANT: Ensure TSX/TS are served as JS
    location ~* \.(tsx|ts)$ {
        default_type application/javascript;
        add_header Content-Type application/javascript;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```
3. Restart: `sudo nginx -t && sudo systemctl restart nginx`

---

## 🚀 4. Background Service
```bash
cd /var/www/html
pm2 start nexus-daemon.js --name "nexus-core"
pm2 save
pm2 startup
```

---

## 🔍 Important Note on Errors
- **Unexpected token '<'**: Inayos na natin ito sa `index.html` gamit ang Babel Standalone. Siguraduhin na ang script tag ay `type="text/babel"`.
- **contentScript.js**: Ang error na ito ay galing sa iyong browser extensions. Hindi ito makakaapekto sa app. Buksan ang site sa **Incognito Mode** para makitang wala na ang error na iyon.
