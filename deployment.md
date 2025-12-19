
# Nexus Router OS: Pro Hardware Deployment

To enable real-world router functionality on your Ubuntu x64 machine, you must run the **Nexus Core Agent**.

## 🚀 1. Prerequisites
Ensure you have Node.js and Npm installed on your Ubuntu host:
```bash
sudo apt update
sudo apt install nodejs npm -y
```

## 🛠️ 2. Install the Core Agent
Save the provided `server.js` to your project folder (e.g., `/opt/nexus/server.js`) and install dependencies:
```bash
mkdir -p /opt/nexus
cd /opt/nexus
npm init -y
npm install express cors
```

## ⚡ 3. Start the Agent (Background)
Run the agent as root (required for executing network commands):
```bash
sudo node server.js
```
*Note: For production, use `pm2` to keep the agent alive: `sudo npm install -g pm2 && sudo pm2 start server.js`*

## 🌐 4. Enable Kernel Features
Ensure your Ubuntu machine allows packet forwarding:
```bash
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 🔍 5. Verify
Refresh the Nexus OS dashboard. The bottom-left status indicator should change to **"Hardware Native"** in green. You will now see your real Ethernet ports (e.g., `eth0`, `enp1s0`) listed in the dashboard.
