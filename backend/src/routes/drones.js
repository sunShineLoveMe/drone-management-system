const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

// Get all drones
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    // Try to get from cache first
    const cacheKey = `drones:list:${status || 'all'}:${limit}:${offset}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const pool = getPool();
    let query = `
      SELECT 
        id, drone_id, name, model, serial_number, status, 
        battery_level, ST_X(location) as longitude, ST_Y(location) as latitude,
        altitude, speed, heading, last_seen, created_at, updated_at
      FROM drones
    `;
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ` ORDER BY last_seen DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    const response = {
      drones: result.rows,
      total: result.rowCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // Cache for 30 seconds
    await cache.set(cacheKey, response, 30);
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching drones:', error);
    res.status(500).json({ error: 'Failed to fetch drones' });
  }
});

// Get drone by ID
router.get('/:droneId', async (req, res) => {
  try {
    const { droneId } = req.params;
    
    // Try cache first
    const cacheKey = `drone:${droneId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        id, drone_id, name, model, serial_number, status, 
        battery_level, ST_X(location) as longitude, ST_Y(location) as latitude,
        altitude, speed, heading, last_seen, created_at, updated_at
      FROM drones 
      WHERE drone_id = $1
    `, [droneId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Drone not found' });
    }

    const drone = result.rows[0];
    
    // Cache for 1 minute
    await cache.set(cacheKey, drone, 60);
    
    res.json(drone);
  } catch (error) {
    logger.error('Error fetching drone:', error);
    res.status(500).json({ error: 'Failed to fetch drone' });
  }
});

// Register new drone
router.post('/', async (req, res) => {
  try {
    const { drone_id, name, model, serial_number } = req.body;

    if (!drone_id || !name) {
      return res.status(400).json({ error: 'drone_id and name are required' });
    }

    const pool = getPool();
    const result = await pool.query(`
      INSERT INTO drones (drone_id, name, model, serial_number, status)
      VALUES ($1, $2, $3, $4, 'offline')
      RETURNING *
    `, [drone_id, name, model, serial_number]);

    // Clear cache
    await cache.del('drones:list:all:50:0');
    
    logger.info(`New drone registered: ${drone_id}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Drone ID already exists' });
    }
    logger.error('Error registering drone:', error);
    res.status(500).json({ error: 'Failed to register drone' });
  }
});

// Update drone status and telemetry
router.put('/:droneId/telemetry', async (req, res) => {
  try {
    const { droneId } = req.params;
    const telemetryData = req.body;

    // 使用遥测服务处理数据
    const { processTelemetryData } = require('../services/telemetry');
    const success = await processTelemetryData(droneId, telemetryData);
    
    if (success) {
      res.json({ message: '遥测数据更新成功' });
    } else {
      res.status(400).json({ error: '遥测数据处理失败' });
    }
  } catch (error) {
    logger.error('更新遥测数据错误:', error);
    res.status(500).json({ error: '更新遥测数据失败' });
  }
});

// Get latest telemetry data
router.get('/:droneId/telemetry/latest', async (req, res) => {
  try {
    const { droneId } = req.params;
    
    const { getLatestTelemetry } = require('../services/telemetry');
    const telemetry = await getLatestTelemetry(droneId);
    
    if (telemetry) {
      res.json(telemetry);
    } else {
      res.status(404).json({ error: '未找到遥测数据' });
    }
  } catch (error) {
    logger.error('获取最新遥测数据错误:', error);
    res.status(500).json({ error: '获取遥测数据失败' });
  }
});

// Get telemetry statistics
router.get('/:droneId/telemetry/stats', async (req, res) => {
  try {
    const { droneId } = req.params;
    const { timeRange = '24 hours' } = req.query;
    
    const { getTelemetryStats } = require('../services/telemetry');
    const stats = await getTelemetryStats(droneId, timeRange);
    
    res.json(stats);
  } catch (error) {
    logger.error('获取遥测统计错误:', error);
    res.status(500).json({ error: '获取遥测统计失败' });
  }
});

// Get drone telemetry history
router.get('/:droneId/telemetry', async (req, res) => {
  try {
    const { droneId } = req.params;
    const { hours = 24, limit = 1000 } = req.query;

    const pool = getPool();
    const result = await pool.query(`
      SELECT * FROM drone_telemetry
      WHERE drone_id = $1 
        AND time >= NOW() - INTERVAL '${hours} hours'
      ORDER BY time DESC
      LIMIT $2
    `, [droneId, limit]);

    res.json({
      drone_id: droneId,
      telemetry: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    logger.error('Error fetching telemetry:', error);
    res.status(500).json({ error: 'Failed to fetch telemetry' });
  }
});

// Delete drone
router.delete('/:droneId', async (req, res) => {
  try {
    const { droneId } = req.params;

    const pool = getPool();
    const result = await pool.query('DELETE FROM drones WHERE drone_id = $1', [droneId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Drone not found' });
    }

    // Clear cache
    await cache.del(`drone:${droneId}`);
    await cache.del('drones:list:all:50:0');
    
    logger.info(`Drone deleted: ${droneId}`);
    res.json({ message: 'Drone deleted successfully' });
  } catch (error) {
    logger.error('Error deleting drone:', error);
    res.status(500).json({ error: 'Failed to delete drone' });
  }
});

module.exports = router;