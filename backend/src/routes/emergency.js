/**
 * 紧急情况管理路由
 */
const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { logger } = require('../utils/logger');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { notificationManager, EVENT_TYPES, SEVERITY_LEVELS } = require('../services/notification');

/**
 * 获取紧急情况列表
 * GET /api/v1/emergency
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    const pool = getPool();
    let query = `
      SELECT * FROM emergencies
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    res.json({
      emergencies: result.rows,
      total: result.rowCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('获取紧急情况列表失败:', error);
    res.status(500).json({ error: '获取紧急情况列表失败' });
  }
});

/**
 * 创建紧急情况
 * POST /api/v1/emergency
 */
router.post('/', authenticateToken, checkRole(['admin', 'operator', 'emergency']), async (req, res) => {
  try {
    const { 
      type, 
      title, 
      description, 
      location, 
      severity = 'high',
      drone_ids = [] 
    } = req.body;

    if (!type || !title) {
      return res.status(400).json({ error: '类型和标题是必需的' });
    }

    const pool = getPool();
    const emergencyId = `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建紧急情况记录
    const result = await pool.query(`
      INSERT INTO emergencies (
        emergency_id, type, title, description, 
        location, severity, status, reported_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
      RETURNING *
    `, [
      emergencyId, type, title, description, 
      location ? JSON.stringify(location) : null, 
      severity, req.user.id
    ]);

    // 发布紧急警报事件
    await notificationManager.publishEvent({
      type: EVENT_TYPES.EMERGENCY_ALERT,
      severity: SEVERITY_LEVELS.CRITICAL,
      source: 'emergency_api',
      data: {
        emergencyId,
        type,
        title,
        description,
        location,
        reportedBy: req.user.username
      }
    });

    logger.info(`紧急情况创建: ${emergencyId} by ${req.user.username}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('创建紧急情况失败:', error);
    res.status(500).json({ error: '创建紧急情况失败' });
  }
});

/**
 * 更新紧急情况状态
 * PUT /api/v1/emergency/:emergencyId/status
 */
router.put('/:emergencyId/status', authenticateToken, checkRole(['admin', 'operator', 'emergency']), async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'responding', 'resolved', 'closed', 'false_alarm'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态' });
    }

    const pool = getPool();
    const result = await pool.query(`
      UPDATE emergencies
      SET status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE emergency_id = $1
      RETURNING *
    `, [emergencyId, status]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '紧急情况不存在' });
    }

    // 发布状态更新事件
    await notificationManager.publishEvent({
      type: EVENT_TYPES.EMERGENCY_ALERT,
      severity: status === 'resolved' ? SEVERITY_LEVELS.INFO : SEVERITY_LEVELS.WARNING,
      source: 'emergency_api',
      data: {
        emergencyId,
        newStatus: status,
        updatedBy: req.user.username,
        message: `紧急情况 ${emergencyId} 状态更新为 ${status}`
      }
    });

    logger.info(`紧急情况 ${emergencyId} 状态更新为 ${status} by ${req.user.username}`);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('更新紧急情况状态失败:', error);
    res.status(500).json({ error: '更新紧急情况状态失败' });
  }
});

/**
 * 分配无人机响应紧急情况
 * POST /api/v1/emergency/:emergencyId/dispatch
 */
router.post('/:emergencyId/dispatch', authenticateToken, checkRole(['admin', 'operator']), async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const { drone_ids } = req.body;

    if (!drone_ids || !Array.isArray(drone_ids) || drone_ids.length === 0) {
      return res.status(400).json({ error: '至少需要一个无人机ID' });
    }

    const pool = getPool();
    
    // 检查紧急情况是否存在
    const emergencyResult = await pool.query(
      'SELECT * FROM emergencies WHERE emergency_id = $1',
      [emergencyId]
    );

    if (emergencyResult.rows.length === 0) {
      return res.status(404).json({ error: '紧急情况不存在' });
    }

    // 更新紧急情况状态
    await pool.query(`
      UPDATE emergencies
      SET status = 'responding', updated_at = CURRENT_TIMESTAMP
      WHERE emergency_id = $1
    `, [emergencyId]);

    // 记录派遣信息
    for (const droneId of drone_ids) {
      await pool.query(`
        INSERT INTO emergency_dispatches (
          emergency_id, drone_id, dispatched_by, status
        ) VALUES ($1, $2, $3, 'dispatched')
      `, [emergencyId, droneId, req.user.id]);
    }

    // 发布派遣事件
    await notificationManager.publishEvent({
      type: EVENT_TYPES.EMERGENCY_ALERT,
      severity: SEVERITY_LEVELS.WARNING,
      source: 'emergency_api',
      data: {
        emergencyId,
        droneIds: drone_ids,
        dispatchedBy: req.user.username,
        message: `已派遣 ${drone_ids.length} 架无人机响应紧急情况 ${emergencyId}`
      }
    });

    logger.info(`已派遣无人机 ${drone_ids.join(', ')} 响应紧急情况 ${emergencyId} by ${req.user.username}`);
    res.json({ 
      message: '无人机派遣成功',
      emergency_id: emergencyId,
      drone_ids
    });
  } catch (error) {
    logger.error('派遣无人机失败:', error);
    res.status(500).json({ error: '派遣无人机失败' });
  }
});

module.exports = router;