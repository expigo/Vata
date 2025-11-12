import express from 'express';
import cors from 'cors';

function createAPIServer(database, mqttClient) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      mqtt: mqttClient.isConnected() ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  });

  // Get all systems
  app.get('/api/systems', (req, res) => {
    try {
      const systems = database.getSystemList();
      res.json(systems);
    } catch (err) {
      console.error('Error fetching systems:', err);
      res.status(500).json({ error: 'Failed to fetch systems' });
    }
  });

  // Get latest readings for all systems
  app.get('/api/readings/latest', (req, res) => {
    try {
      const readings = database.getLatestBySystem();

      // Group by system type
      const grouped = {
        household: [],
        ice_rink: [],
        other: []
      };

      readings.forEach(reading => {
        if (reading.system_type === 'household') {
          grouped.household.push(reading);
        } else if (reading.system_type === 'ice_rink') {
          grouped.ice_rink.push(reading);
        } else {
          grouped.other.push(reading);
        }
      });

      res.json(grouped);
    } catch (err) {
      console.error('Error fetching latest readings:', err);
      res.status(500).json({ error: 'Failed to fetch latest readings' });
    }
  });

  // Get readings by system type
  app.get('/api/readings/type/:systemType', (req, res) => {
    try {
      const { systemType } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      const readings = database.getReadingsBySystemType(systemType, limit);
      res.json(readings);
    } catch (err) {
      console.error('Error fetching readings by type:', err);
      res.status(500).json({ error: 'Failed to fetch readings' });
    }
  });

  // Get readings by system ID
  app.get('/api/readings/system/:systemId', (req, res) => {
    try {
      const { systemId } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      const readings = database.getReadingsBySystemId(systemId, limit);
      res.json(readings);
    } catch (err) {
      console.error('Error fetching readings by system:', err);
      res.status(500).json({ error: 'Failed to fetch readings' });
    }
  });

  // Get readings in time range
  app.get('/api/readings/range/:systemId', (req, res) => {
    try {
      const { systemId } = req.params;
      const { start, end } = req.query;
      const limit = parseInt(req.query.limit) || 1000;

      if (!start || !end) {
        return res.status(400).json({ error: 'start and end query parameters are required' });
      }

      const readings = database.getReadingsInTimeRange(systemId, start, end, limit);
      res.json(readings);
    } catch (err) {
      console.error('Error fetching readings by range:', err);
      res.status(500).json({ error: 'Failed to fetch readings' });
    }
  });

  // Get aggregated data
  app.get('/api/analytics/aggregated/:systemType', (req, res) => {
    try {
      const { systemType } = req.params;
      const interval = req.query.interval || '1 hour';
      const data = database.getAggregatedData(systemType, interval);
      res.json(data);
    } catch (err) {
      console.error('Error fetching aggregated data:', err);
      res.status(500).json({ error: 'Failed to fetch aggregated data' });
    }
  });

  // Get all readings (with pagination)
  app.get('/api/readings', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const readings = database.getLatestReadings(limit);
      res.json(readings);
    } catch (err) {
      console.error('Error fetching readings:', err);
      res.status(500).json({ error: 'Failed to fetch readings' });
    }
  });

  // Stats endpoint
  app.get('/api/stats', (req, res) => {
    try {
      const systems = database.getSystemList();
      const household = systems.filter(s => s.system_type === 'household');
      const iceRink = systems.filter(s => s.system_type === 'ice_rink');

      res.json({
        total_systems: systems.length,
        household_systems: household.length,
        ice_rink_systems: iceRink.length,
        systems: systems
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  return app;
}

export default createAPIServer;
