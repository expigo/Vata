import { WebSocketServer } from 'ws';

class WebSocketManager {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Set();

    this.wss.on('connection', (ws) => {
      console.log('✓ New WebSocket client connected');
      this.clients.add(ws);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('Received from client:', data);

          // Handle client requests (e.g., subscribe to specific systems)
          if (data.type === 'subscribe' && data.systemId) {
            ws.systemId = data.systemId;
            ws.send(JSON.stringify({ type: 'subscribed', systemId: data.systemId }));
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      });

      ws.on('close', () => {
        console.log('✗ WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        this.clients.delete(ws);
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
    });
  }

  broadcast(type, data) {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

    this.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(message);
        } catch (err) {
          console.error('Error sending to client:', err);
          this.clients.delete(client);
        }
      }
    });
  }

  broadcastToSystem(systemId, type, data) {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

    this.clients.forEach((client) => {
      if (client.readyState === 1 && (!client.systemId || client.systemId === systemId)) {
        try {
          client.send(message);
        } catch (err) {
          console.error('Error sending to client:', err);
          this.clients.delete(client);
        }
      }
    });
  }

  getClientCount() {
    return this.clients.size;
  }
}

export default WebSocketManager;
