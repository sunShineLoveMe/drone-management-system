const { db } = require('../config/database');
const { redis } = require('../config/redis');
const { kafkaProducer } = require('../config/kafka');
const { logger } = require('../utils/logger');
const { EventService } = require('./notification');

class EmergencyResponseService {
  constructor() {
    this.eventService = new EventService();
    this.protocolTemplates = this.initializeProtocolTemplates();
  }

  initializeProtocolTemplates() {
    return {
      LOW_BATTERY: {
        name: '低电量紧急协议',
        steps: [
          { action: 'REDUCE_SPEED', description: '降低飞行速度' },
          { action: 'FIND_LANDING_SPOT', description: '搜索最近安全着陆点' },
          { action: 'AUTO_LAND', description: '执行自动降落' },
          { action: 'NOTIFY_OPERATOR', description: '通知操作员' }
        ],
        autoExecute: true,
        maxExecutionTime: 300000 // 5分钟
      },
      SIGNAL_LOSS: {
        name: '信号丢失紧急协议',
        steps: [
          { action: 'ACTIVATE_RETURN_HOME', description: '激活自动返航' },
          { action: 'MAINTAIN_ALTITUDE', description: '保持当前高度' },
          { action: 'SEARCH_SIGNAL', description: '搜索信号' },
          { action: 'EMERGENCY_LAND', description: '紧急降落程序' }
        ],
        autoExecute: true,
        maxExecutionTime: 600000 // 10分钟
      },
      OBSTACLE_DETECTED: {
        name: '障碍物检测紧急协议',
        steps: [
          { action: 'STOP_MOVEMENT', description: '立即停止移动' },
          { action: 'HOVER_IN_PLACE', description: '悬停原地' },
          { action: 'RECALCULATE_PATH', description: '重新计算路径' },
          { action: 'RESUME_MISSION', description: '继续任务' }
        ],
        autoExecute: false,
        maxExecutionTime: 180000 // 3分钟
      },
      WEATHER_ALERT: {
        name: '恶劣天气紧急协议',
        steps: [
          { action: 'ASSESS_WEATHER', description: '评估天气状况' },
          { action: 'FIND_SHELTER', description: '寻找遮蔽区域' },
          { action: 'EMERGENCY_LAND', description: '执行紧急降落' },
          { action: 'NOTIFY_WEATHER_SERVICE', description: '通知气象部门' }
        ],
        autoExecute: true,
        maxExecutionTime: 240000 // 4分钟
      },
      TECHNICAL_FAILURE: {
        name: '技术故障紧急协议',
        steps: [
          { action: 'DIAGNOSE_ISSUE', description: '诊断故障类型' },
          { action: 'ISOLATE_SYSTEM', description: '隔离故障系统' },
          { action: 'EMERGENCY_LAND', description: '执行紧急降落' },
          { action: 'ALERT_TECH_TEAM', description: '通知技术团队' }
        ],
        autoExecute: true,
        maxExecutionTime: 120000 // 2分钟
      }
    };
  }

  async createEmergency(emergencyData) {
    const query = `
      INSERT INTO emergencies (
        drone_id, emergency_type, severity, location, description, 
        status, created_at, updated_at, reported_by
      ) VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), $5, $6, NOW(), NOW(), $7)
      RETURNING id, drone_id, emergency_type, severity, status, created_at
    `;

    const values = [
      emergencyData.droneId,
      emergencyData.emergencyType,
      emergencyData.severity,
      JSON.stringify(emergencyData.location),
      emergencyData.description,
      'PENDING',
      emergencyData.reportedBy
    ];

    const result = await db.query(query, values);
    const emergency = result.rows[0];

    // 发布紧急事件到Kafka
    await this.publishEmergencyEvent(emergency);

    // 创建实时事件
    await this.eventService.createEvent({
      type: 'EMERGENCY_CREATED',
      severity: emergencyData.severity,
      droneId: emergencyData.droneId,
      message: `紧急事件创建: ${emergencyData.emergencyType}`,
      metadata: emergency
    });

    // 缓存紧急情况
    await this.cacheEmergency(emergency);

    return emergency;
  }

  async getEmergencies(filters = {}) {
    let query = `
      SELECT 
        e.*,
        d.name as drone_name,
        ST_AsGeoJSON(e.location) as location_geojson,
        u.username as reported_by_username
      FROM emergencies e
      JOIN drones d ON e.drone_id = d.id
      JOIN users u ON e.reported_by = u.id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 0;

    if (filters.status) {
      paramCount++;
      query += ` AND e.status = $${paramCount}`;
      values.push(filters.status);
    }

    if (filters.severity) {
      paramCount++;
      query += ` AND e.severity = $${paramCount}`;
      values.push(filters.severity);
    }

    if (filters.type) {
      paramCount++;
      query += ` AND e.emergency_type = $${paramCount}`;
      values.push(filters.type);
    }

    query += ` ORDER BY e.created_at DESC`;

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
    }

    if (filters.page && filters.limit) {
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      values.push((filters.page - 1) * filters.limit);
    }

    const result = await db.query(query, values);
    return {
      emergencies: result.rows,
      total: await this.getTotalEmergencies(filters),
      page: filters.page || 1,
      limit: filters.limit || 20
    };
  }

  async getEmergencyById(emergencyId) {
    const query = `
      SELECT 
        e.*,
        d.name as drone_name,
        d.model as drone_model,
        d.battery_level as drone_battery,
        d.location as drone_location,
        ST_AsGeoJSON(e.location) as location_geojson,
        u.username as reported_by_username,
        au.username as updated_by_username
      FROM emergencies e
      JOIN drones d ON e.drone_id = d.id
      JOIN users u ON e.reported_by = u.id
      LEFT JOIN users au ON e.updated_by = au.id
      WHERE e.id = $1
    `;

    const result = await db.query(query, [emergencyId]);
    return result.rows[0];
  }

  async updateEmergencyStatus(emergencyId, updateData) {
    const query = `
      UPDATE emergencies 
      SET status = $1, response_actions = $2, assigned_team = $3, 
          notes = $4, updated_at = NOW(), updated_by = $5
      WHERE id = $6
      RETURNING *
    `;

    const values = [
      updateData.status,
      JSON.stringify(updateData.responseActions || []),
      updateData.assignedTeam,
      updateData.notes,
      updateData.updatedBy,
      emergencyId
    ];

    const result = await db.query(query, values);
    const emergency = result.rows[0];

    if (emergency) {
      await this.eventService.createEvent({
        type: 'EMERGENCY_STATUS_CHANGED',
        severity: 'MEDIUM',
        droneId: emergency.drone_id,
        message: `紧急状态更新: ${updateData.status}`,
        metadata: { emergencyId, status: updateData.status }
      });

      await this.updateCachedEmergency(emergency);
    }

    return emergency;
  }

  async triggerEmergencyProtocol(emergencyId, protocolData) {
    const emergency = await this.getEmergencyById(emergencyId);
    if (!emergency) {
      throw new Error('Emergency not found');
    }

    const protocol = this.protocolTemplates[protocolData.protocolType];
    if (!protocol) {
      throw new Error('Protocol template not found');
    }

    const protocolExecution = {
      emergencyId,
      protocolType: protocolData.protocolType,
      startedAt: new Date(),
      steps: protocol.steps.map((step, index) => ({
        stepIndex: index,
        action: step.action,
        description: step.description,
        status: 'PENDING',
        startedAt: null,
        completedAt: null
      })),
      autoExecute: protocol.autoExecute,
      maxExecutionTime: protocol.maxExecutionTime,
      triggeredBy: protocolData.triggeredBy
    };

    // 保存协议执行记录
    await this.saveProtocolExecution(protocolExecution);

    // 自动执行协议
    if (protocol.autoExecute && protocolData.autoLand) {
      await this.executeEmergencyProtocol(protocolExecution);
    }

    // 通知紧急服务
    if (protocolData.notifyEmergencyServices) {
      await this.notifyEmergencyServices(emergency, protocolExecution);
    }

    await this.eventService.createEvent({
      type: 'EMERGENCY_PROTOCOL_TRIGGERED',
      severity: emergency.severity,
      droneId: emergency.drone_id,
      message: `紧急协议已触发: ${protocol.name}`,
      metadata: { emergencyId, protocolType: protocolData.protocolType }
    });

    return { 
      success: true, 
      protocolExecution,
      message: 'Emergency protocol triggered successfully' 
    };
  }

  async executeEmergencyProtocol(protocolExecution) {
    for (const step of protocolExecution.steps) {
      step.status = 'IN_PROGRESS';
      step.startedAt = new Date();

      try {
        await this.executeProtocolStep(step, protocolExecution.emergencyId);
        step.status = 'COMPLETED';
        step.completedAt = new Date();
      } catch (error) {
        step.status = 'FAILED';
        step.error = error.message;
        logger.error(`Protocol step failed: ${step.action}`, error);
        break;
      }

      await this.updateProtocolExecution(protocolExecution);
    }
  }

  async executeProtocolStep(step, emergencyId) {
    const emergency = await this.getEmergencyById(emergencyId);
    
    switch (step.action) {
      case 'AUTO_LAND':
        await this.initiateAutoLand(emergency.drone_id);
        break;
      case 'ACTIVATE_RETURN_HOME':
        await this.activateReturnHome(emergency.drone_id);
        break;
      case 'NOTIFY_OPERATOR':
        await this.notifyOperator(emergency);
        break;
      case 'FIND_LANDING_SPOT':
        await this.findSafeLandingSpot(emergency.drone_id);
        break;
      default:
        logger.info(`Executing protocol step: ${step.action}`);
    }
  }

  async initiateAutoLand(droneId) {
    // 发送自动降落指令到无人机
    await kafkaProducer.send({
      topic: 'drone-commands',
      messages: [{
        key: droneId,
        value: JSON.stringify({
          command: 'EMERGENCY_LAND',
          droneId,
          timestamp: new Date().toISOString()
        })
      }]
    });
  }

  async activateReturnHome(droneId) {
    await kafkaProducer.send({
      topic: 'drone-commands',
      messages: [{
        key: droneId,
        value: JSON.stringify({
          command: 'RETURN_HOME',
          droneId,
          timestamp: new Date().toISOString()
        })
      }]
    });
  }

  async notifyOperator(emergency) {
    // 通过WebSocket通知操作员
    await this.eventService.createEvent({
      type: 'OPERATOR_NOTIFICATION',
      severity: emergency.severity,
      droneId: emergency.drone_id,
      message: `紧急事件需要操作员注意: ${emergency.emergency_type}`,
      metadata: emergency
    });
  }

  async findSafeLandingSpot(droneId) {
    // 计算最近的安全着陆点
    const droneQuery = 'SELECT location FROM drones WHERE id = $1';
    const droneResult = await db.query(droneQuery, [droneId]);
    
    if (droneResult.rows[0]) {
      const droneLocation = droneResult.rows[0].location;
      // 这里可以集成地理信息系统来寻找安全着陆点
      logger.info(`Finding safe landing spot for drone ${droneId} at location ${droneLocation}`);
    }
  }

  async notifyEmergencyServices(emergency, protocolExecution) {
    // 集成外部紧急服务API
    const notification = {
      emergencyId: emergency.id,
      droneId: emergency.drone_id,
      emergencyType: emergency.emergency_type,
      severity: emergency.severity,
      location: emergency.location,
      protocol: protocolExecution.protocolType,
      timestamp: new Date().toISOString()
    };

    // 发送到紧急服务集成主题
    await kafkaProducer.send({
      topic: 'emergency-services',
      messages: [{
        key: emergency.id,
        value: JSON.stringify(notification)
      }]
    });
  }

  async getProtocolTemplates() {
    return Object.entries(this.protocolTemplates).map(([key, template]) => ({
      type: key,
      name: template.name,
      steps: template.steps,
      autoExecute: template.autoExecute,
      maxExecutionTime: template.maxExecutionTime
    }));
  }

  async getRealtimeStats() {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_emergencies,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_emergencies,
        COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) as resolved_today,
        COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_count,
        COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high_count,
        emergency_type,
        COUNT(*) as count_by_type
      FROM emergencies 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY emergency_type
    `;

    const result = await db.query(statsQuery);
    const typeBreakdown = result.rows.reduce((acc, row) => {
      acc[row.emergency_type] = parseInt(row.count_by_type);
      return acc;
    }, {});

    return {
      total: parseInt(result.rows[0]?.total_emergencies || 0),
      active: parseInt(result.rows[0]?.active_emergencies || 0),
      resolvedToday: parseInt(result.rows[0]?.resolved_today || 0),
      critical: parseInt(result.rows[0]?.critical_count || 0),
      high: parseInt(result.rows[0]?.high_count || 0),
      typeBreakdown
    };
  }

  async batchResolveEmergencies(emergencyIds, resolution) {
    const query = `
      UPDATE emergencies 
      SET status = 'RESOLVED', 
          resolution = $1, 
          resolved_at = NOW(), 
          updated_by = $2
      WHERE id = ANY($3)
      RETURNING id
    `;

    const result = await db.query(query, [
      resolution.resolution,
      resolution.resolvedBy,
      emergencyIds
    ]);

    return {
      successful: result.rows.length,
      failed: emergencyIds.length - result.rows.length
    };
  }

  async getEmergencyHistory(droneId, dateRange) {
    let query = `
      SELECT 
        e.*,
        ST_AsGeoJSON(e.location) as location_geojson,
        u.username as reported_by_username,
        au.username as updated_by_username
      FROM emergencies e
      JOIN users u ON e.reported_by = u.id
      LEFT JOIN users au ON e.updated_by = au.id
      WHERE e.drone_id = $1
    `;

    const values = [droneId];

    if (dateRange.startDate) {
      query += ` AND e.created_at >= $2`;
      values.push(dateRange.startDate);
    }

    if (dateRange.endDate) {
      query += dateRange.startDate ? ` AND e.created_at <= $3` : ` AND e.created_at <= $2`;
      values.push(dateRange.endDate);
    }

    query += ` ORDER BY e.created_at DESC`;

    const result = await db.query(query, values);
    return result.rows;
  }

  async publishEmergencyEvent(emergency) {
    await kafkaProducer.send({
      topic: 'emergency-events',
      messages: [{
        key: emergency.id,
        value: JSON.stringify({
          type: 'EMERGENCY_CREATED',
          emergency,
          timestamp: new Date().toISOString()
        })
      }]
    });
  }

  async cacheEmergency(emergency) {
    const cacheKey = `emergency:${emergency.id}`;
    await redis.setex(cacheKey, 3600, JSON.stringify(emergency));
  }

  async updateCachedEmergency(emergency) {
    const cacheKey = `emergency:${emergency.id}`;
    await redis.setex(cacheKey, 3600, JSON.stringify(emergency));
  }

  async saveProtocolExecution(protocolExecution) {
    const query = `
      INSERT INTO emergency_protocol_executions (
        emergency_id, protocol_type, started_at, steps, auto_execute, 
        max_execution_time, triggered_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const values = [
      protocolExecution.emergencyId,
      protocolExecution.protocolType,
      protocolExecution.startedAt,
      JSON.stringify(protocolExecution.steps),
      protocolExecution.autoExecute,
      protocolExecution.maxExecutionTime,
      protocolExecution.triggeredBy
    ];

    const result = await db.query(query, values);
    return result.rows[0].id;
  }

  async updateProtocolExecution(protocolExecution) {
    const query = `
      UPDATE emergency_protocol_executions 
      SET steps = $1, updated_at = NOW()
      WHERE emergency_id = $2
    `;

    await db.query(query, [
      JSON.stringify(protocolExecution.steps),
      protocolExecution.emergencyId
    ]);
  }

  async getTotalEmergencies(filters) {
    let query = 'SELECT COUNT(*) FROM emergencies WHERE 1=1';
    const values = [];
    let paramCount = 0;

    if (filters.status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      values.push(filters.status);
    }

    if (filters.severity) {
      paramCount++;
      query += ` AND severity = $${paramCount}`;
      values.push(filters.severity);
    }

    if (filters.type) {
      paramCount++;
      query += ` AND emergency_type = $${paramCount}`;
      values.push(filters.type);
    }

    const result = await db.query(query, values);
    return parseInt(result.rows[0].count);
  }
}

module.exports = { EmergencyResponseService };