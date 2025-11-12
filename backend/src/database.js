import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VataDatabase {
  constructor(dbPath) {
    // Ensure data directory exists
    const dir = dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initTables();
  }

  initTables() {
    // Create table for raw MQTT messages
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mqtt_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        system_id TEXT,
        system_type TEXT,
        file_datetime TEXT,
        uptime INTEGER,
        device_id TEXT,
        modbslaveaddress INTEGER,
        raw_data TEXT NOT NULL,
        INDEX idx_system_id (system_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_system_type (system_type)
      );
    `);

    // Create table for parsed energy data points
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS energy_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        system_id TEXT NOT NULL,
        system_type TEXT NOT NULL,
        device_id TEXT,
        voltage_l1 REAL,
        voltage_l2 REAL,
        voltage_l3 REAL,
        current_l1 REAL,
        current_l2 REAL,
        current_l3 REAL,
        power_active_l1 REAL,
        power_active_l2 REAL,
        power_active_l3 REAL,
        power_apparent_l1 REAL,
        power_apparent_l2 REAL,
        power_apparent_l3 REAL,
        power_reactive_l1 REAL,
        power_reactive_l2 REAL,
        power_reactive_l3 REAL,
        power_factor_l1 REAL,
        power_factor_l2 REAL,
        power_factor_l3 REAL,
        frequency REAL,
        energy_active_import REAL,
        energy_active_export REAL,
        energy_reactive_import REAL,
        energy_reactive_export REAL,
        FOREIGN KEY (message_id) REFERENCES mqtt_messages(id),
        INDEX idx_system_id (system_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_system_type (system_type)
      );
    `);
  }

  saveMessage(topic, data) {
    const systemId = data.NMID_SYSID || 'unknown';
    let systemType = 'unknown';

    if (systemId.toLowerCase().includes('krol')) {
      systemType = 'household';
    } else if (systemId.toLowerCase().includes('mosir')) {
      systemType = 'ice_rink';
    } else if (systemId.toLowerCase().includes('siemonska')) {
      systemType = 'siemonska';
    }

    const stmt = this.db.prepare(`
      INSERT INTO mqtt_messages (topic, system_id, system_type, file_datetime, uptime, device_id, modbslaveaddress, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      topic,
      systemId,
      systemType,
      data.FILE_datetime,
      data.uptime,
      data.id,
      data.ModbSlaveAddress,
      JSON.stringify(data)
    );

    // Parse and save energy readings
    this.saveEnergyReading(result.lastInsertRowid, systemId, systemType, data);

    return result.lastInsertRowid;
  }

  saveEnergyReading(messageId, systemId, systemType, data) {
    const nmid = data['NMID_1-18'] || [];
    const nmid19 = data['NMID_19-44'] || [];

    const stmt = this.db.prepare(`
      INSERT INTO energy_readings (
        message_id, system_id, system_type, device_id,
        voltage_l1, voltage_l2, voltage_l3,
        current_l1, current_l2, current_l3,
        power_active_l1, power_active_l2, power_active_l3,
        power_apparent_l1, power_apparent_l2, power_apparent_l3,
        power_reactive_l1, power_reactive_l2, power_reactive_l3,
        power_factor_l1, power_factor_l2, power_factor_l3,
        frequency,
        energy_active_import, energy_active_export,
        energy_reactive_import, energy_reactive_export
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      messageId,
      systemId,
      systemType,
      data.id,
      nmid[0], nmid[1], nmid[2],  // Voltages L1, L2, L3
      nmid[3], nmid[4], nmid[5],  // Currents L1, L2, L3
      nmid[6], nmid[7], nmid[8],  // Active Power L1, L2, L3
      nmid[9], nmid[10], nmid[11], // Apparent Power L1, L2, L3
      nmid[12], nmid[13], nmid[14], // Reactive Power L1, L2, L3
      nmid[15], nmid[16], nmid[17], // Power Factor L1, L2, L3
      nmid19[17], // Frequency
      nmid19[18], nmid19[20], // Energy Active Import/Export
      nmid19[21], nmid19[19]  // Energy Reactive Import/Export
    );
  }

  getLatestReadings(limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM energy_readings
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  getReadingsBySystemType(systemType, limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM energy_readings
      WHERE system_type = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(systemType, limit);
  }

  getReadingsBySystemId(systemId, limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM energy_readings
      WHERE system_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(systemId, limit);
  }

  getLatestBySystem() {
    const stmt = this.db.prepare(`
      SELECT er.*, mm.topic, mm.file_datetime
      FROM energy_readings er
      INNER JOIN mqtt_messages mm ON er.message_id = mm.id
      WHERE er.id IN (
        SELECT MAX(id)
        FROM energy_readings
        GROUP BY system_id
      )
      ORDER BY system_type, system_id
    `);
    return stmt.all();
  }

  getSystemList() {
    const stmt = this.db.prepare(`
      SELECT DISTINCT system_id, system_type, MAX(timestamp) as last_seen
      FROM energy_readings
      GROUP BY system_id, system_type
      ORDER BY system_type, system_id
    `);
    return stmt.all();
  }

  getReadingsInTimeRange(systemId, startTime, endTime, limit = 1000) {
    const stmt = this.db.prepare(`
      SELECT * FROM energy_readings
      WHERE system_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(systemId, startTime, endTime, limit);
  }

  getAggregatedData(systemType, interval = '1 hour') {
    // SQLite doesn't have great date aggregation, so we'll do hourly buckets
    const stmt = this.db.prepare(`
      SELECT
        strftime('%Y-%m-%d %H:00:00', timestamp) as time_bucket,
        system_id,
        AVG(voltage_l1 + voltage_l2 + voltage_l3) / 3 as avg_voltage,
        AVG(current_l1 + current_l2 + current_l3) as avg_current,
        AVG(power_active_l1 + power_active_l2 + power_active_l3) as avg_power,
        MAX(energy_active_import) - MIN(energy_active_import) as energy_consumed
      FROM energy_readings
      WHERE system_type = ?
      GROUP BY time_bucket, system_id
      ORDER BY time_bucket DESC
      LIMIT 100
    `);
    return stmt.all(systemType);
  }

  close() {
    this.db.close();
  }
}

export default VataDatabase;
