import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import VataDatabase from './database.js';
import MQTTClient from './mqtt-client.js';
import createAPIServer from './api.js';
import WebSocketManager from './websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const config = {
  mqtt: {
    broker: process.env.MQTT_BROKER || '127.0.0.1',
    port: parseInt(process.env.MQTT_PORT) || 1883,
    username: process.env.MQTT_USERNAME || 'vata',
    password: process.env.MQTT_PASSWORD || '',
    topic: process.env.MQTT_TOPIC || '#'
  },
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0'
  },
  database: {
    path: process.env.DB_PATH || path.join(__dirname, '../data/vata.db')
  }
};

console.log('='.repeat(60));
console.log('🔌 Vata Energy Dashboard - Starting...');
console.log('='.repeat(60));

// Initialize database
console.log('\n📊 Initializing database...');
const database = new VataDatabase(config.database.path);
console.log(`✓ Database initialized at ${config.database.path}`);

// Initialize MQTT client
console.log('\n🌐 Initializing MQTT client...');
const mqttClient = new MQTTClient(config.mqtt);

// Initialize Express app
console.log('\n🚀 Initializing API server...');
const app = createAPIServer(database, mqttClient);

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
console.log('🔗 Initializing WebSocket server...');
const wsManager = new WebSocketManager(server);

// MQTT event handlers
mqttClient.on('connected', () => {
  wsManager.broadcast('mqtt_status', { status: 'connected' });
});

mqttClient.on('message', ({ topic, data }) => {
  try {
    // Save to database
    const messageId = database.saveMessage(topic, data);

    // Broadcast to WebSocket clients
    const systemType = data.NMID_SYSID?.toLowerCase().includes('krol') ? 'household' :
                       data.NMID_SYSID?.toLowerCase().includes('mosir') ? 'ice_rink' : 'other';

    wsManager.broadcast('new_reading', {
      system_id: data.NMID_SYSID,
      system_type: systemType,
      device_id: data.id,
      timestamp: new Date().toISOString(),
      data: data
    });

    console.log(`✓ Saved message ${messageId} from ${data.NMID_SYSID || 'unknown'}`);
  } catch (err) {
    console.error('Error processing MQTT message:', err);
  }
});

mqttClient.on('offline', () => {
  wsManager.broadcast('mqtt_status', { status: 'offline' });
});

mqttClient.on('disconnected', () => {
  wsManager.broadcast('mqtt_status', { status: 'disconnected' });
});

mqttClient.on('error', (err) => {
  console.error('MQTT error:', err.message);
});

// Connect to MQTT broker
mqttClient.connect();

// Start HTTP server
server.listen(config.server.port, config.server.host, () => {
  console.log('\n' + '='.repeat(60));
  console.log('✓ Vata Energy Dashboard is running!');
  console.log('='.repeat(60));
  console.log(`\n📡 API Server:        http://${config.server.host}:${config.server.port}`);
  console.log(`🔌 WebSocket Server:  ws://${config.server.host}:${config.server.port}`);
  console.log(`\n🌐 MQTT Broker:       ${config.mqtt.broker}:${config.mqtt.port}`);
  console.log(`📝 MQTT Topic:        ${config.mqtt.topic}`);
  console.log(`\n💾 Database:          ${config.database.path}`);
  console.log('\n' + '='.repeat(60));
  console.log('📊 API Endpoints:');
  console.log('  GET  /api/health                    - Health check');
  console.log('  GET  /api/systems                   - List all systems');
  console.log('  GET  /api/readings/latest           - Latest readings (grouped)');
  console.log('  GET  /api/readings/type/:type       - Readings by type');
  console.log('  GET  /api/readings/system/:id       - Readings by system ID');
  console.log('  GET  /api/stats                     - System statistics');
  console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹ Shutting down gracefully...');

  mqttClient.disconnect();
  database.close();

  server.close(() => {
    console.log('✓ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹ Received SIGTERM, shutting down...');

  mqttClient.disconnect();
  database.close();

  server.close(() => {
    console.log('✓ Server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Don't exit in production, just log
});

export { database, mqttClient, wsManager };
