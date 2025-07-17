/**
 * 调度管理路由
 */
const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { cache } = require('../config/redis');
const { logger } = require('../utils/logger');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { notificationManager, EVENT_TYPES } = require('../services/notification');
const { sendSchedulingEvent } = require('../config/kafka');

/**
 * 获取当前调度计划
 * GET /api/v1/scheduling/plan
 */
router.get('/plan', authenticateToken, async (req, res) => {
  try {
    // 尝试从缓存获取
    const cacheKey = 'scheduling:current_plan';
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        id, schedule_id, name, description, status,
        start_time, end_time, drone_assignments, created_by, created_at, updated_at
      FROM schedules
      WHERE status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '没有活动的调度计划' });
    }

    const plan = result.rows[0];
    
    // 缓存5分钟
    await cache.set(cacheKey, plan, 300);
    
    res.json(plan);
  } catch (error) {
    logger.error('获取调度计划失败:', error);
    res.status(500).json({ error: '获取调度计划失败' });
  }
});

/**
 * 创建新调度计划
 * POST /api/v1/scheduling/plan
 */
router.post('/plan', authenticateToken, checkRole(['admin', 'operator']), async (req, res) => {
  try {
    const {
      name, description, start_time, end_time, drone_assignments
    } = req.body;

    if (!name || !start_time || !end_time || !drone_assignments) {
      return res.status(400).json({ error: '名称、开始时间、结束时间和无人机分配是必需的' });
    }

    const pool = getPool();
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 将之前的活动计划设为非活动
    await pool.query(`
      UPDATE schedules
      SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'active'
    `);

    const result = await pool.query(`
      INSERT INTO schedules (
        schedule_id, name, description, status, start_time, end_time, drone_assignments, created_by
      ) VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
      RETURNING *
    `, [
      scheduleId, name, description, start_time, end_time, JSON.stringify(drone_assignments), req.user.id
    ]);

    // 清除缓存
    await cache.del('scheduling:current_plan');
    
    // 发布调度更新事件
    await notificationManager.publishEvent({
      type: EVENT_TYPES.SCHEDULE_UPDATE,
      severity: 'info',
      source: 'scheduling_api',
      data: {
        scheduleId,
        name,
        action: 'created',
        createdBy: req.user.username
      }
    });

    // 发送到Kafka
    await sendSchedulingEvent({
      scheduleId,
      action: 'created',
      name,
      droneCount: Object.keys(drone_assignments).length
    });

    logger.info(`新调度计划创建: ${scheduleId} by ${req.user.username}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('创建调度计划失败:', error);
    res.status(500).json({ error: '创建调度计划失败' });
  }
});

/**
 * 更新调度计划
 * PUT /api/v1/scheduling/plan/:scheduleId
 */
router.put('/plan/:scheduleId', authenticateToken, checkRole(['admin', 'operator']), async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const {
      name, description, status, start_time, end_time, drone_assignments
    } = req.body;

    const pool = getPool();
    
    // 检查计划是否存在
    const checkResult = await pool.query('SELECT id FROM schedules WHERE schedule_id = $1', [scheduleId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '调度计划不存在' });
    }

    // 构建更新字段
    const updateFields = [];
    const params = [scheduleId];
    let paramIndex = 2;

    if (name) {
      updateFields.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }

    if (status) {
      updateFields.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (start_time) {
      updateFields.push(`start_time = $${paramIndex}`);
      params.push(start_time);
      paramIndex++;
    }

    if (end_time) {
      updateFields.push(`end_time = $${paramIndex}`);
      params.push(end_time);
      paramIndex++;
    }

    if (drone_assignments) {
      updateFields.push(`drone_assignments = $${paramIndex}`);
      params.push(JSON.stringify(drone_assignments));
      paramIndex++;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    // 执行更新
    const result = await pool.query(`
      UPDATE schedules
      SET ${updateFields.join(', ')}
      WHERE schedule_id = $1
      RETURNING *
    `, params);

    // 清除缓存
    await cache.del('scheduling:current_plan');
    
    // 发布调度更新事件
    await notificationManager.publishEvent({
      type: EVENT_TYPES.SCHEDULE_UPDATE,
      severity: 'info',
      source: 'scheduling_api',
      data: {
        scheduleId,
        action: 'updated',
        updatedBy: req.user.username
      }
    });

    logger.info(`调度计划更新: ${scheduleId} by ${req.user.username}`);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('更新调度计划失败:', error);
    res.status(500).json({ error: '更新调度计划失败' });
  }
});

/**
 * 获取无人机可用性
 * GET /api/v1/scheduling/availability
 */
router.get('/availability', authenticateToken, async (req, res) => {
  try {
    const { start_time, end_time } = req.query;
    
    if (!start_time || !end_time) {
      return res.status(400).json({ error: '开始时间和结束时间是必需的' });
    }

    const pool = getPool();
    
    // 获取所有无人机
    const dronesResult = await pool.query(`
      SELECT drone_id, name, status, battery_level
      FROM drones
      WHERE status != 'offline' AND status != 'maintenance'
    `);

    // 获取指定时间范围内的任务
    const missionsResult = await pool.query(`
      SELECT mission_id, assigned_drone_id, scheduled_start, estimated_duration
      FROM missions
      WHERE status IN ('pending', 'assigned', 'in_progress')
        AND scheduled_start <= $2
        AND (scheduled_start + (estimated_duration || ' minutes')::interval) >= $1
    `, [start_time, end_time]);

    // 计算每个无人机的可用性
    const droneAvailability = {};
    
    dronesResult.rows.forEach(drone => {
      const conflictingMissions = missionsResult.rows.filter(
        mission => mission.assigned_drone_id === drone.drone_id
      );
      
      droneAvailability[drone.drone_id] = {
        drone_id: drone.drone_id,
        name: drone.name,
        status: drone.status,
        battery_level: drone.battery_level,
        available: conflictingMissions.length === 0,
        conflicting_missions: conflictingMissions.map(m => m.mission_id)
      };
    });

    res.json({
      start_time,
      end_time,
      availability: droneAvailability
    });
  } catch (error) {
    logger.error('获取无人机可用性失败:', error);
    res.status(500).json({ error: '获取无人机可用性失败' });
  }
});

module.exports = router;