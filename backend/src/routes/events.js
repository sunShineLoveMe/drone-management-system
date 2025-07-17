/**
 * 事件管理路由
 */
const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { logger } = require('../utils/logger');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { notificationManager, EVENT_TYPES, SEVERITY_LEVELS } = require('../services/notification');

/**
 * 获取事件列表
 * GET /api/v1/events
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      type, 
      severity, 
      limit = 50, 
      offset = 0,
      startTime,
      endTime 
    } = req.query;

    const pool = getPool();
    let query = `
      SELECT event_id, event_type, severity, source, data, timestamp, processed
      FROM events
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // 添加过滤条件
    if (type) {
      query += ` AND event_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    if (startTime) {
      query += ` AND timestamp >= $${paramIndex}`;
      params.push(startTime);
      paramIndex++;
    }

    if (endTime) {
      query += ` AND timestamp <= $${paramIndex}`;
      params.push(endTime);
      paramIndex++;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      events: result.rows,
      total: result.rowCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('获取事件列表失败:', error);
    res.status(500).json({ error: '获取事件列表失败' });
  }
});

/**
 * 获取事件统计
 * GET /api/v1/events/stats
 */
router.get('/stats', authenticateToken, checkRole(['admin', 'operator']), async (req, res) => {
  try {
    const { timeRange = '24 hours' } = req.query;

    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        event_type,
        severity,
        COUNT(*) as count
      FROM events
      WHERE timestamp >= NOW() - INTERVAL '${timeRange}'
      GROUP BY event_type, severity
      ORDER BY count DESC
    `);

    // 按事件类型和严重程度分组统计
    const stats = {
      byType: {},
      bySeverity: {},
      total: 0
    };

    result.rows.forEach(row => {
      // 按类型统计
      if (!stats.byType[row.event_type]) {
        stats.byType[row.event_type] = 0;
      }
      stats.byType[row.event_type] += parseInt(row.count);

      // 按严重程度统计
      if (!stats.bySeverity[row.severity]) {
        stats.bySeverity[row.severity] = 0;
      }
      stats.bySeverity[row.severity] += parseInt(row.count);

      stats.total += parseInt(row.count);
    });

    res.json(stats);
  } catch (error) {
    logger.error('获取事件统计失败:', error);
    res.status(500).json({ error: '获取事件统计失败' });
  }
});

/**
 * 手动触发事件
 * POST /api/v1/events/trigger
 */
router.post('/trigger', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    const { type, severity, source, data, channels } = req.body;

    // 验证事件类型
    if (!Object.values(EVENT_TYPES).includes(type)) {
      return res.status(400).json({ error: '无效的事件类型' });
    }

    // 验证严重程度
    if (severity && !Object.values(SEVERITY_LEVELS).includes(severity)) {
      return res.status(400).json({ error: '无效的严重程度' });
    }

    // 发布事件
    await notificationManager.publishEvent({
      type,
      severity: severity || SEVERITY_LEVELS.INFO,
      source: source || `manual_${req.user.username}`,
      data: data || {},
      channels: channels || ['websocket']
    });

    logger.info(`用户 ${req.user.username} 手动触发事件: ${type}`);
    res.json({ message: '事件已触发' });
  } catch (error) {
    logger.error('触发事件失败:', error);
    res.status(500).json({ error: '触发事件失败' });
  }
});

/**
 * 标记事件为已处理
 * PUT /api/v1/events/:eventId/processed
 */
router.put('/:eventId/processed', authenticateToken, checkRole(['admin', 'operator']), async (req, res) => {
  try {
    const { eventId } = req.params;

    const pool = getPool();
    const result = await pool.query(`
      UPDATE events
      SET processed = true
      WHERE event_id = $1
      RETURNING *
    `, [eventId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '事件不存在' });
    }

    logger.info(`用户 ${req.user.username} 标记事件 ${eventId} 为已处理`);
    res.json({ message: '事件已标记为已处理' });
  } catch (error) {
    logger.error('标记事件失败:', error);
    res.status(500).json({ error: '标记事件失败' });
  }
});

/**
 * 获取事件类型列表
 * GET /api/v1/events/types
 */
router.get('/types', authenticateToken, (req, res) => {
  try {
    const types = Object.entries(EVENT_TYPES).map(([key, value]) => ({
      key,
      value,
      description: getEventTypeDescription(value)
    }));

    res.json(types);
  } catch (error) {
    logger.error('获取事件类型失败:', error);
    res.status(500).json({ error: '获取事件类型失败' });
  }
});

/**
 * 获取严重程度列表
 * GET /api/v1/events/severities
 */
router.get('/severities', authenticateToken, (req, res) => {
  try {
    const severities = Object.entries(SEVERITY_LEVELS).map(([key, value]) => ({
      key,
      value,
      description: getSeverityDescription(value)
    }));

    res.json(severities);
  } catch (error) {
    logger.error('获取严重程度失败:', error);
    res.status(500).json({ error: '获取严重程度失败' });
  }
});

/**
 * 获取事件类型描述
 * @param {string} eventType - 事件类型
 * @returns {string} 描述
 */
function getEventTypeDescription(eventType) {
  const descriptions = {
    [EVENT_TYPES.DRONE_STATUS_CHANGE]: '无人机状态变化',
    [EVENT_TYPES.MISSION_STATUS_CHANGE]: '任务状态变化',
    [EVENT_TYPES.BATTERY_LOW]: '电池电量不足',
    [EVENT_TYPES.SIGNAL_WEAK]: '信号强度弱',
    [EVENT_TYPES.EMERGENCY_ALERT]: '紧急警报',
    [EVENT_TYPES.SYSTEM_ERROR]: '系统错误',
    [EVENT_TYPES.MAINTENANCE_DUE]: '维护到期',
    [EVENT_TYPES.WEATHER_WARNING]: '天气警告',
    [EVENT_TYPES.AIRSPACE_VIOLATION]: '空域违规',
    [EVENT_TYPES.SCHEDULE_UPDATE]: '调度更新'
  };

  return descriptions[eventType] || '未知事件类型';
}

/**
 * 获取严重程度描述
 * @param {string} severity - 严重程度
 * @returns {string} 描述
 */
function getSeverityDescription(severity) {
  const descriptions = {
    [SEVERITY_LEVELS.INFO]: '信息',
    [SEVERITY_LEVELS.WARNING]: '警告',
    [SEVERITY_LEVELS.ERROR]: '错误',
    [SEVERITY_LEVELS.CRITICAL]: '严重'
  };

  return descriptions[severity] || '未知严重程度';
}

module.exports = router;