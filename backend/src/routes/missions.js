/**
 * 任务管理路由
 */
const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { cache } = require('../config/redis');
const { logger } = require('../utils/logger');
const { validateMission } = require('../utils/validators');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { notificationManager, EVENT_TYPES } = require('../services/notification');

/**
 * 获取所有任务
 * GET /api/v1/missions
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0, droneId } = req.query;
    
    // 尝试从缓存获取
    const cacheKey = `missions:list:${status || 'all'}:${droneId || 'all'}:${limit}:${offset}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const pool = getPool();
    let query = `
      SELECT 
        id, mission_id, name, description, mission_type, priority, status,
        assigned_drone_id, waypoints, scheduled_start, actual_start,
        estimated_duration, actual_duration, created_by, created_at, updated_at
      FROM missions
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (droneId) {
      query += ` AND assigned_drone_id = $${paramIndex}`;
      params.push(droneId);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    const response = {
      missions: result.rows,
      total: result.rowCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // 缓存30秒
    await cache.set(cacheKey, response, 30);
    
    res.json(response);
  } catch (error) {
    logger.error('获取任务列表失败:', error);
    res.status(500).json({ error: '获取任务列表失败' });
  }
});

/**
 * 根据ID获取任务
 * GET /api/v1/missions/:missionId
 */
router.get('/:missionId', authenticateToken, async (req, res) => {
  try {
    const { missionId } = req.params;
    
    // 尝试从缓存获取
    const cacheKey = `mission:${missionId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        id, mission_id, name, description, mission_type, priority, status,
        assigned_drone_id, waypoints, scheduled_start, actual_start,
        estimated_duration, actual_duration, created_by, created_at, updated_at
      FROM missions 
      WHERE mission_id = $1
    `, [missionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const mission = result.rows[0];
    
    // 缓存1分钟
    await cache.set(cacheKey, mission, 60);
    
    res.json(mission);
  } catch (error) {
    logger.error('获取任务失败:', error);
    res.status(500).json({ error: '获取任务失败' });
  }
});

/**
 * 创建新任务
 * POST /api/v1/missions
 */
router.post('/', authenticateToken, checkRole(['admin', 'operator']), async (req, res) => {
  try {
    // 验证任务数据
    const { error } = validateMission(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      name, description, mission_type, priority = 1,
      waypoints, area_coordinates, scheduled_start, estimated_duration
    } = req.body;

    const pool = getPool();
    const missionId = `mission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 处理区域坐标
    let areaGeometry = null;
    if (area_coordinates && area_coordinates.length >= 3) {
      const coordinates = area_coordinates.map(coord => `${coord.longitude} ${coord.latitude}`).join(',');
      areaGeometry = `POLYGON((${coordinates},${area_coordinates[0].longitude} ${area_coordinates[0].latitude}))`;
    }

    const result = await pool.query(`
      INSERT INTO missions (
        mission_id, name, description, mission_type, priority,
        waypoints, area_of_interest, scheduled_start, estimated_duration, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, ${areaGeometry ? 'ST_GeomFromText($7, 4326)' : 'NULL'}, $${areaGeometry ? 8 : 7}, $${areaGeometry ? 9 : 8}, $${areaGeometry ? 10 : 9})
      RETURNING *
    `, [
      missionId, name, description, mission_type, priority,
      JSON.stringify(waypoints),
      ...(areaGeometry ? [areaGeometry] : []),
      scheduled_start, estimated_duration, req.user.id
    ]);

    // 清除缓存
    await cache.del('missions:list:all:all:50:0');
    
    // 发布任务创建事件
    await notificationManager.publishEvent({
      type: EVENT_TYPES.MISSION_STATUS_CHANGE,
      severity: 'info',
      source: 'mission_api',
      data: {
        missionId,
        newStatus: 'pending',
        createdBy: req.user.username
      }
    });

    logger.info(`新任务创建: ${missionId} by ${req.user.username}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('创建任务失败:', error);
    res.status(500).json({ error: '创建任务失败' });
  }
});

/**
 * 更新任务状态
 * PUT /api/v1/missions/:missionId/status
 */
router.put('/:missionId/status', authenticateToken, checkRole(['admin', 'operator']), async (req, res) => {
  try {
    const { missionId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的任务状态' });
    }

    const pool = getPool();
    
    // 获取当前任务状态
    const currentResult = await pool.query('SELECT status FROM missions WHERE mission_id = $1', [missionId]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const oldStatus = currentResult.rows[0].status;

    // 更新任务状态
    const updateFields = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [missionId, status];
    let paramIndex = 3;

    // 如果任务开始，记录实际开始时间
    if (status === 'in_progress' && oldStatus !== 'in_progress') {
      updateFields.push(`actual_start = $${paramIndex}`);
      params.push(new Date().toISOString());
      paramIndex++;
    }

    const result = await pool.query(`
      UPDATE missions 
      SET ${updateFields.join(', ')}
      WHERE mission_id = $1
      RETURNING *
    `, params);

    // 清除缓存
    await cache.del(`mission:${missionId}`);
    
    // 发布任务状态变更事件
    await notificationManager.publishEvent({
      type: EVENT_TYPES.MISSION_STATUS_CHANGE,
      severity: status === 'failed' ? 'error' : 'info',
      source: 'mission_api',
      data: {
        missionId,
        oldStatus,
        newStatus: status,
        updatedBy: req.user.username
      }
    });

    logger.info(`任务 ${missionId} 状态更新: ${oldStatus} -> ${status} by ${req.user.username}`);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('更新任务状态失败:', error);
    res.status(500).json({ error: '更新任务状态失败' });
  }
});

/**
 * 分配任务给无人机
 * PUT /api/v1/missions/:missionId/assign
 */
router.put('/:missionId/assign', authenticateToken, checkRole(['admin', 'operator']), async (req, res) => {
  try {
    const { missionId } = req.params;
    const { droneId } = req.body;

    if (!droneId) {
      return res.status(400).json({ error: '无人机ID是必需的' });
    }

    const pool = getPool();
    
    // 检查无人机是否存在且可用
    const droneResult = await pool.query('SELECT status FROM drones WHERE drone_id = $1', [droneId]);
    if (droneResult.rows.length === 0) {
      return res.status(404).json({ error: '无人机不存在' });
    }

    const droneStatus = droneResult.rows[0].status;
    if (!['idle', 'ready'].includes(droneStatus)) {
      return res.status(400).json({ error: '无人机当前不可用' });
    }

    // 分配任务
    const result = await pool.query(`
      UPDATE missions 
      SET 
        assigned_drone_id = $2,
        status = 'assigned',
        updated_at = CURRENT_TIMESTAMP
      WHERE mission_id = $1
      RETURNING *
    `, [missionId, droneId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '任务不存在' });
    }

    // 清除缓存
    await cache.del(`mission:${missionId}`);
    
    // 发布任务分配事件
    await notificationManager.publishEvent({
      type: EVENT_TYPES.MISSION_STATUS_CHANGE,
      severity: 'info',
      source: 'mission_api',
      data: {
        missionId,
        droneId,
        newStatus: 'assigned',
        assignedBy: req.user.username
      }
    });

    logger.info(`任务 ${missionId} 分配给无人机 ${droneId} by ${req.user.username}`);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('分配任务失败:', error);
    res.status(500).json({ error: '分配任务失败' });
  }
});

/**
 * 删除任务
 * DELETE /api/v1/missions/:missionId
 */
router.delete('/:missionId', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    const { missionId } = req.params;

    const pool = getPool();
    const result = await pool.query('DELETE FROM missions WHERE mission_id = $1', [missionId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '任务不存在' });
    }

    // 清除缓存
    await cache.del(`mission:${missionId}`);
    await cache.del('missions:list:all:all:50:0');
    
    logger.info(`任务删除: ${missionId} by ${req.user.username}`);
    res.json({ message: '任务删除成功' });
  } catch (error) {
    logger.error('删除任务失败:', error);
    res.status(500).json({ error: '删除任务失败' });
  }
});

module.exports = router;