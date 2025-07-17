/**
 * 健康检查路由
 */
const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { getClient } = require('../config/redis');
const { getMetrics, getDetailedMetrics } = require('../utils/metrics');
const { logger } = require('../utils/logger');
const { authenticateToken, checkRole } = require('../middleware/auth');

/**
 * 基本健康检查
 * GET /health
 */
router.get('/', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json(healthStatus);
  } catch (error) {
    logger.error('健康检查失败:', error);
    res.status(500).json({ status: 'unhealthy', error: 'Internal server error' });
  }
});

/**
 * 详细健康检查
 * GET /health/detailed
 */
router.get('/detailed', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    // 检查数据库连接
    let databaseStatus = 'healthy';
    let databaseError = null;
    
    try {
      const pool = getPool();
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
    } catch (error) {
      databaseStatus = 'unhealthy';
      databaseError = error.message;
      logger.error('数据库健康检查失败:', error);
    }
    
    // 检查Redis连接
    let redisStatus = 'healthy';
    let redisError = null;
    
    try {
      const client = getClient();
      await client.ping();
    } catch (error) {
      redisStatus = 'unhealthy';
      redisError = error.message;
      logger.error('Redis健康检查失败:', error);
    }
    
    // 系统信息
    const systemInfo = {
      platform: process.platform,
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
    
    // 组合健康状态
    const healthStatus = {
      status: databaseStatus === 'healthy' && redisStatus === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: databaseStatus,
          error: databaseError
        },
        redis: {
          status: redisStatus,
          error: redisError
        }
      },
      system: systemInfo
    };
    
    res.json(healthStatus);
  } catch (error) {
    logger.error('详细健康检查失败:', error);
    res.status(500).json({ status: 'unhealthy', error: 'Internal server error' });
  }
});

/**
 * 获取系统指标
 * GET /health/metrics
 */
router.get('/metrics', authenticateToken, checkRole(['admin']), (req, res) => {
  try {
    const metrics = getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('获取指标失败:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * 获取详细系统指标
 * GET /health/metrics/detailed
 */
router.get('/metrics/detailed', authenticateToken, checkRole(['admin']), (req, res) => {
  try {
    const detailedMetrics = getDetailedMetrics();
    res.json(detailedMetrics);
  } catch (error) {
    logger.error('获取详细指标失败:', error);
    res.status(500).json({ error: 'Failed to get detailed metrics' });
  }
});

module.exports = router;