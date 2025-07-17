const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

const initializeDatabase = async () => {
  try {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'drone_management',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('Database connected successfully');
    
    // Initialize tables
    await createTables();
    
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

const createTables = async () => {
  const createTablesSQL = `
    -- Enable PostGIS extension
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS timescaledb;

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'operator',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Drones table
    CREATE TABLE IF NOT EXISTS drones (
      id SERIAL PRIMARY KEY,
      drone_id VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      model VARCHAR(50),
      serial_number VARCHAR(100),
      status VARCHAR(20) DEFAULT 'offline',
      battery_level INTEGER DEFAULT 0,
      location GEOMETRY(POINT, 4326),
      altitude DOUBLE PRECISION DEFAULT 0,
      speed DOUBLE PRECISION DEFAULT 0,
      heading DOUBLE PRECISION DEFAULT 0,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Drone telemetry table (time-series)
    CREATE TABLE IF NOT EXISTS drone_telemetry (
      time TIMESTAMPTZ NOT NULL,
      drone_id VARCHAR(50) NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      altitude DOUBLE PRECISION,
      battery_level INTEGER,
      speed DOUBLE PRECISION,
      heading DOUBLE PRECISION,
      temperature DOUBLE PRECISION,
      humidity DOUBLE PRECISION,
      wind_speed DOUBLE PRECISION,
      signal_strength INTEGER,
      status VARCHAR(20),
      FOREIGN KEY (drone_id) REFERENCES drones(drone_id)
    );

    -- Missions table
    CREATE TABLE IF NOT EXISTS missions (
      id SERIAL PRIMARY KEY,
      mission_id VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      mission_type VARCHAR(50),
      priority INTEGER DEFAULT 1,
      status VARCHAR(20) DEFAULT 'pending',
      assigned_drone_id VARCHAR(50),
      waypoints JSONB,
      area_of_interest GEOMETRY(POLYGON, 4326),
      scheduled_start TIMESTAMP,
      actual_start TIMESTAMP,
      estimated_duration INTEGER,
      actual_duration INTEGER,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_drone_id) REFERENCES drones(drone_id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Spatial zones table
    CREATE TABLE IF NOT EXISTS spatial_zones (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      zone_type VARCHAR(50),
      geometry GEOMETRY(POLYGON, 4326),
      altitude_min DOUBLE PRECISION DEFAULT 0,
      altitude_max DOUBLE PRECISION DEFAULT 1000,
      restrictions JSONB,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Alerts table
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      alert_id VARCHAR(50) UNIQUE NOT NULL,
      alert_type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) DEFAULT 'info',
      title VARCHAR(200) NOT NULL,
      description TEXT,
      drone_id VARCHAR(50),
      mission_id VARCHAR(50),
      location GEOMETRY(POINT, 4326),
      acknowledged BOOLEAN DEFAULT false,
      acknowledged_by INTEGER,
      acknowledged_at TIMESTAMP,
      resolved BOOLEAN DEFAULT false,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drone_id) REFERENCES drones(drone_id),
      FOREIGN KEY (mission_id) REFERENCES missions(mission_id),
      FOREIGN KEY (acknowledged_by) REFERENCES users(id)
    );

    -- Create hypertable for telemetry data
    SELECT create_hypertable('drone_telemetry', 'time', if_not_exists => TRUE);

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_drones_location ON drones USING GIST (location);
    CREATE INDEX IF NOT EXISTS idx_drones_status ON drones (status);
    CREATE INDEX IF NOT EXISTS idx_missions_status ON missions (status);
    CREATE INDEX IF NOT EXISTS idx_missions_area ON missions USING GIST (area_of_interest);
    CREATE INDEX IF NOT EXISTS idx_spatial_zones_geom ON spatial_zones USING GIST (geometry);
    CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts (alert_type);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity);
    CREATE INDEX IF NOT EXISTS idx_telemetry_drone_time ON drone_telemetry (drone_id, time DESC);
  `;

  try {
    await pool.query(createTablesSQL);
    logger.info('Database tables created successfully');
  } catch (error) {
    logger.error('Failed to create tables:', error);
    throw error;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
};

module.exports = {
  initializeDatabase,
  getPool
};