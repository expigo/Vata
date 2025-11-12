import mqtt from 'mqtt';
import EventEmitter from 'events';

class MQTTClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.client = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  connect() {
    const options = {
      host: this.config.broker,
      port: this.config.port,
      username: this.config.username,
      password: this.config.password,
      clientId: `vata_dashboard_${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
    };

    console.log(`Connecting to MQTT broker at ${this.config.broker}:${this.config.port}...`);

    this.client = mqtt.connect(`mqtt://${this.config.broker}:${this.config.port}`, options);

    this.client.on('connect', () => {
      console.log('✓ Connected to MQTT broker');
      this.reconnectAttempts = 0;

      // Subscribe to the configured topic
      this.client.subscribe(this.config.topic, (err) => {
        if (err) {
          console.error('Failed to subscribe:', err);
          this.emit('error', err);
        } else {
          console.log(`✓ Subscribed to topic: ${this.config.topic}`);
          this.emit('connected');
        }
      });
    });

    this.client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`← Received message from ${topic}: ${data.NMID_SYSID || 'unknown'}`);
        this.emit('message', { topic, data });
      } catch (err) {
        console.error('Failed to parse MQTT message:', err);
        this.emit('parseError', { topic, message: message.toString(), error: err });
      }
    });

    this.client.on('error', (err) => {
      console.error('MQTT error:', err);
      this.emit('error', err);
    });

    this.client.on('offline', () => {
      console.warn('⚠ MQTT client offline');
      this.emit('offline');
    });

    this.client.on('reconnect', () => {
      this.reconnectAttempts++;
      console.log(`⟳ Reconnecting to MQTT broker (attempt ${this.reconnectAttempts})...`);

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnect attempts reached. Please check your MQTT configuration.');
        this.client.end();
      }
    });

    this.client.on('close', () => {
      console.log('✗ MQTT connection closed');
      this.emit('disconnected');
    });
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }

  isConnected() {
    return this.client && this.client.connected;
  }
}

export default MQTTClient;
