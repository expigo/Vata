# 🚀 VPS Deployment Guide for Vata Energy Dashboard

## Prerequisites
- VPS with Ubuntu/Debian (mikr.us)
- MQTT broker running on VPS at 127.0.0.1:1883
- Domain: tryvata.com configured in Cloudflare
- SSH access to your VPS

---

## Step 1: Prepare Your VPS

### 1.1 SSH into Your VPS
```bash
ssh your-username@your-vps-ip
```

### 1.2 Install Docker & Docker Compose
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (to run without sudo)
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
exit
# SSH back in
ssh your-username@your-vps-ip

# Verify Docker installation
docker --version
docker-compose --version
```

### 1.3 Install Git (if not already installed)
```bash
sudo apt update
sudo apt install git -y
```

---

## Step 2: Clone and Configure the Application

### 2.1 Clone the Repository
```bash
cd ~
git clone https://github.com/expigo/Vata.git
cd Vata
```

### 2.2 Create Environment Configuration
```bash
cp .env.example .env
nano .env
```

Edit the `.env` file with your MQTT credentials:
```env
# MQTT Configuration
# Use host.docker.internal to access MQTT broker on host from Docker
MQTT_BROKER=host.docker.internal
MQTT_PORT=1883
MQTT_USERNAME=vata
MQTT_PASSWORD=not_real_pass    # Replace with your actual password
MQTT_TOPIC=#
```

**Press `Ctrl+X`, then `Y`, then `Enter` to save and exit nano.**

---

## Step 3: Deploy with Docker

### 3.1 Build and Start the Containers
```bash
docker-compose up -d
```

This will:
- Build the backend (Node.js) container
- Build the frontend (Nginx) container
- Start both services
- Create the database volume

### 3.2 Check if Containers Are Running
```bash
docker-compose ps
```

You should see:
```
NAME            STATE      PORTS
vata-backend    running    0.0.0.0:3000->3000/tcp
vata-frontend   running    0.0.0.0:80->80/tcp
```

### 3.3 View Logs
```bash
# View all logs
docker-compose logs -f

# View only backend logs
docker-compose logs -f backend

# View only frontend logs
docker-compose logs -f frontend
```

**Press `Ctrl+C` to exit log viewing**

---

## Step 4: Test Local Access

### 4.1 Check Backend Health
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok","mqtt":"connected","timestamp":"..."}
```

### 4.2 Check Frontend
```bash
curl http://localhost
```

Should return HTML content.

---

## Step 5: Configure Firewall

### 5.1 Check Current Firewall Status
```bash
sudo ufw status
```

### 5.2 Open Required Ports
```bash
# Allow HTTP (port 80)
sudo ufw allow 80/tcp

# Allow backend API/WebSocket (port 3000)
sudo ufw allow 3000/tcp

# Allow SSH (if not already allowed)
sudo ufw allow 22/tcp

# Enable firewall (if not already enabled)
sudo ufw enable

# Verify
sudo ufw status
```

---

## Step 6: Configure Cloudflare DNS

### 6.1 Log into Cloudflare Dashboard
Go to: https://dash.cloudflare.com

### 6.2 Select Your Domain
Click on `tryvata.com`

### 6.3 Add DNS Record
Go to **DNS** → **Records** → **Add record**

**Settings:**
- **Type:** `A`
- **Name:** `app`
- **IPv4 address:** Your VPS IP address
- **Proxy status:** ☁️ Proxied (orange cloud)
- **TTL:** Auto

Click **Save**

### 6.4 Configure SSL/TLS
Go to **SSL/TLS** → **Overview**

**Select:** `Flexible`
- This allows HTTPS from visitors to Cloudflare, and HTTP from Cloudflare to your VPS

**OR for better security (recommended):**
- Set to `Full` or `Full (strict)` if you want to add SSL to your VPS

### 6.5 Enable HTTPS Redirect
Go to **SSL/TLS** → **Edge Certificates**

Enable:
- ✅ **Always Use HTTPS**
- ✅ **Automatic HTTPS Rewrites**

---

## Step 7: Access Your Dashboard

### 7.1 Wait for DNS Propagation
DNS changes typically take 1-5 minutes with Cloudflare.

### 7.2 Access the Dashboard
Open your browser and go to:

**http://app.tryvata.com** (will auto-redirect to HTTPS)

or

**https://app.tryvata.com**

You should see:
- ⚡ Vata Energy Dashboard
- Status indicators showing MQTT and WebSocket connection status
- Real-time energy data from your household and ice rink systems

---

## Step 8: Verify Everything Works

### 8.1 Check Status Indicators
On the dashboard, verify:
- **MQTT:** Should show "Connected" (green)
- **WebSocket:** Should show "Connected" (green)
- **Last Update:** Should update when new data arrives

### 8.2 Check Tabs
Navigate through:
- **Overview** - Summary of all systems
- **Household (Krol)** - Krol systems data
- **Ice Rink (MOSIR)** - MOSIR systems data
- **All Systems** - Complete list

### 8.3 Test Backend API
```bash
curl http://app.tryvata.com:3000/api/health
```

---

## Troubleshooting

### Problem: MQTT shows "Disconnected"

**Solution:**
```bash
# Check backend logs
docker-compose logs backend

# Verify MQTT broker is running
mosquitto_sub -h 127.0.0.1 -p 1883 -u vata -P 'your_password' -t '#' -v

# Restart backend if needed
docker-compose restart backend
```

### Problem: Can't access app.tryvata.com

**Solution:**
```bash
# Check if containers are running
docker-compose ps

# Check firewall
sudo ufw status

# Verify DNS propagation
nslookup app.tryvata.com

# Check Nginx logs
docker-compose logs frontend
```

### Problem: WebSocket won't connect

**Solution:**
- Check that port 3000 is open in firewall
- Verify Cloudflare is not blocking WebSocket (should work by default)
- Check browser console for errors

### Problem: No data showing

**Solution:**
```bash
# Check if MQTT messages are being received
docker-compose logs backend | grep "Received message"

# Verify database is being written
docker-compose exec backend ls -lah /app/data/

# Check API endpoint
curl http://localhost:3000/api/readings/latest
```

---

## Maintenance Commands

### View Logs
```bash
docker-compose logs -f
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

### Stop Services
```bash
docker-compose down
```

### Start Services
```bash
docker-compose up -d
```

### Update Application
```bash
cd ~/Vata
git pull origin main  # or your branch name
docker-compose down
docker-compose up -d --build
```

### View Database
```bash
docker-compose exec backend sqlite3 /app/data/vata.db
# Inside sqlite:
.tables
SELECT COUNT(*) FROM energy_readings;
.quit
```

### Clean Everything (CAUTION: Deletes all data)
```bash
docker-compose down -v
rm -rf data/
```

---

## Performance Optimization (Optional)

### Enable Gzip Compression
Already configured in nginx.conf

### Set up Log Rotation
```bash
# Create log rotation config
sudo nano /etc/logrotate.d/docker-compose
```

Add:
```
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  size 10M
  missingok
  delaycompress
  copytruncate
}
```

---

## Security Best Practices

1. **Change default passwords** - Use strong MQTT password
2. **Enable Cloudflare Access** - Add authentication to dashboard
3. **Set up SSL on VPS** - Use Let's Encrypt for Full SSL mode
4. **Regular updates** - Keep Docker and system packages updated
5. **Monitor logs** - Check for unauthorized access attempts
6. **Backup database** - Regularly backup `/data/vata.db`

---

## Support

If you encounter issues:
1. Check the logs: `docker-compose logs -f`
2. Verify MQTT connection: Test with `mosquitto_sub`
3. Check firewall: Ensure ports 80 and 3000 are open
4. Review Cloudflare settings: Verify DNS and SSL configuration

---

**🎉 Congratulations! Your Vata Energy Dashboard is now live at https://app.tryvata.com**
