# ⚡ Vata Energy Dashboard

Real-time energy monitoring dashboard for MQTT-based energy data streams. This system collects, stores, and visualizes energy consumption data from multiple sources including household (Krol) and ice rink (MOSIR) systems.

## 🎯 Features

- **Real-time Data Streaming**: WebSocket-based real-time updates
- **MQTT Integration**: Subscribes to MQTT broker for energy data
- **SQLite Database**: Persistent storage with efficient querying
- **Separate Views**: Dedicated dashboards for household and ice rink systems
- **REST API**: Full API access to historical and current data
- **Docker Support**: Easy deployment with Docker Compose
- **Responsive UI**: Modern, gradient-based design that works on all devices

## 📊 Data Visualization

The dashboard displays:
- Total power consumption (W/kW)
- Voltage levels (L1, L2, L3)
- Current draw per phase
- Power factor
- Energy import/export
- Historical trends
- System health status

## 🏗️ Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   MQTT      │────────▶│   Backend    │────────▶│  Frontend    │
│  Broker     │         │  (Node.js)   │         │  (HTML/JS)   │
└─────────────┘         └──────────────┘         └──────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │   SQLite DB  │
                        └──────────────┘
```

### Components

1. **Backend** (`/backend`)
   - Node.js application with Express
   - MQTT client for data subscription
   - SQLite database for data persistence
   - WebSocket server for real-time updates
   - REST API endpoints

2. **Frontend** (`/frontend`)
   - Static HTML/CSS/JS application
   - WebSocket client for real-time data
   - Tabbed interface for different views
   - Responsive design

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose (recommended)
- OR Node.js 20+ (for local development)
- Access to MQTT broker

### Option 1: Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd Vata
   ```

2. Create environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your MQTT credentials:
   ```env
   MQTT_BROKER=127.0.0.1
   MQTT_PORT=1883
   MQTT_USERNAME=vata
   MQTT_PASSWORD=your_password_here
   MQTT_TOPIC=#
   ```

   **Important for Docker**: If your MQTT broker is running on the host machine:
   - On Linux: Use the host's network IP (e.g., `192.168.1.100`)
   - On Mac/Windows: Use `host.docker.internal`

4. Start the services:
   ```bash
   docker-compose up -d
   ```

5. Access the dashboard:
   - Frontend: http://localhost
   - Backend API: http://localhost:3000
   - Health check: http://localhost:3000/api/health

### Option 2: Local Development

#### Backend

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   # Edit .env with your MQTT credentials
   ```

4. Start the backend:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

#### Frontend

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Serve the files using any static server:
   ```bash
   # Using Python
   python3 -m http.server 8080

   # Using Node.js http-server
   npx http-server -p 8080

   # Using PHP
   php -S localhost:8080
   ```

3. Access the dashboard at http://localhost:8080

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MQTT_BROKER` | MQTT broker hostname/IP | `127.0.0.1` |
| `MQTT_PORT` | MQTT broker port | `1883` |
| `MQTT_USERNAME` | MQTT username | `vata` |
| `MQTT_PASSWORD` | MQTT password | (required) |
| `MQTT_TOPIC` | MQTT topic to subscribe to | `#` |
| `PORT` | Backend server port | `3000` |
| `HOST` | Backend server host | `0.0.0.0` |
| `DB_PATH` | SQLite database path | `./data/vata.db` |

## 📡 API Endpoints

### Health & Status

- `GET /api/health` - Health check and MQTT status

### Systems

- `GET /api/systems` - List all systems with last seen timestamp
- `GET /api/stats` - System statistics

### Readings

- `GET /api/readings` - Get recent readings (with pagination)
- `GET /api/readings/latest` - Get latest readings grouped by type
- `GET /api/readings/type/:systemType` - Get readings by system type (`household`, `ice_rink`)
- `GET /api/readings/system/:systemId` - Get readings for specific system
- `GET /api/readings/range/:systemId?start=&end=` - Get readings in time range

### Analytics

- `GET /api/analytics/aggregated/:systemType` - Get aggregated hourly data

## 🌐 WebSocket Events

The backend broadcasts the following events via WebSocket:

- `connected` - Initial connection confirmation
- `mqtt_status` - MQTT connection status changes
- `new_reading` - New energy reading received

## 📁 Project Structure

```
Vata/
├── backend/
│   ├── src/
│   │   ├── index.js          # Main application entry
│   │   ├── mqtt-client.js    # MQTT client handler
│   │   ├── database.js       # SQLite database layer
│   │   ├── api.js            # REST API routes
│   │   └── websocket.js      # WebSocket server
│   ├── data/                 # SQLite database (gitignored)
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── index.html            # Main dashboard page
│   ├── styles.css            # Styling
│   ├── app.js                # Frontend application logic
│   ├── nginx.conf            # Nginx configuration
│   └── Dockerfile
├── docker-compose.yml        # Docker Compose configuration
├── .env.example              # Environment template
└── README.md
```

## 🔒 Security Notes

1. **MQTT Credentials**: Never commit `.env` file to version control
2. **Production Deployment**:
   - Use strong passwords for MQTT
   - Enable SSL/TLS for MQTT connections
   - Use HTTPS for web dashboard
   - Consider authentication for the dashboard
   - Use Cloudflare for additional security when hosting on tryvata.com

## 🚢 Deployment to VPS

### On mikr.us VPS

1. Install Docker and Docker Compose:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

2. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd Vata
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   nano .env  # Edit with your MQTT credentials
   ```

4. Start services:
   ```bash
   docker-compose up -d
   ```

5. Check logs:
   ```bash
   docker-compose logs -f
   ```

### Cloudflare Setup (for tryvata.com)

1. Add A record pointing to your VPS IP
2. Enable Cloudflare proxy (orange cloud)
3. Configure SSL/TLS settings:
   - Set to "Full" or "Full (strict)"
   - Enable "Always Use HTTPS"
4. Optional: Set up Cloudflare Access for authentication

## 🐛 Troubleshooting

### MQTT Connection Issues

1. Check MQTT broker is accessible:
   ```bash
   mosquitto_sub -h YOUR_BROKER_IP -p 1883 -u vata -P 'password' -t '#' -v
   ```

2. For Docker: Ensure you're using the correct host IP, not `localhost`

3. Check firewall rules on the VPS

### Database Issues

- Database is stored in `backend/data/vata.db`
- To reset: `rm backend/data/vata.db` and restart

### WebSocket Issues

- Ensure port 3000 is accessible
- Check browser console for connection errors
- Verify CORS settings if accessing from different domain

## 📈 Future Enhancements

- [ ] Historical data charts and graphs
- [ ] Data export (CSV, JSON)
- [ ] Alert notifications for anomalies
- [ ] User authentication
- [ ] Mobile app
- [ ] Advanced analytics and predictions
- [ ] Multi-timezone support
- [ ] Customizable dashboard layouts

## 📝 License

See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue in the repository.

---

Built with ❤️ for real-time energy monitoring
