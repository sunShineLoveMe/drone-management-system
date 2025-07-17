/**
 * 事件通知服务
 */
const { logger } = require('../utils/logger');
const { broadcastAlert, broadcastMissionUpdate, broadcastScheduleUpdate } = require('./websocket');
const { getPool } = require('../config/database');
const { cache } = require('../config/redis');

// 事件类型定义
const EVENT_TYPES = {
  DRONE_STATUS_CHANGE: 'drone_status_change',
  MISSION_STATUS_CHANGE: 'mission_status_change',
  BATTERY_LOW: 'battery_low',
  SIGNAL_WEAK: 'signal_weak',
  EMERGENCY_ALERT: 'emergency_alert',
  SYSTEM_ERROR: 'system_error',
  MAINTENANCE_DUE: 'maintenance_due',
  WEATHER_WARNING: 'weather_warning',
  AIRSPACE_VIOLATION: 'airspace_violation',
  SCHEDULE_UPDATE: 'schedule_update'
};

// 事件严重程度
const SEVERITY_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

// 通知渠道
const NOTIFICATION_CHANNELS = {
  WEBSOCKET: 'websocket',
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push'
};

/**
 * 事件通知管理器
 */
class NotificationManager {
  constructor() {
    this.eventHandlers = new Map();
    this.subscriptions = new Map();
    this.setupDefaultHandlers();
  }

  /**
   * 设置默认事件处理器
   */
  setupDefaultHandlers() {
    // 无人机状态变化处理器
    this.registerHandler(EVENT_TYPES.DRONE_STATUS_CHANGE, async (event) => {
      await this.handleDroneStatusChange(event);
    });

    // 任务状态变化处理器
    this.registerHandler(EVENT_TYPES.MISSION_STATUS_CHANGE, async (event) => {
      await this.handleMissionStatusChange(event);
    });

    // 电池低电量处理器
    this.registerHandler(EVENT_TYPES.BATTERY_LOW, async (event) => {
      await this.handleBatteryLow(event);
    });

    // 信号弱处理器
    this.registerHandler(EVENT_TYPES.SIGNAL_WEAK, async (event) => {
      await this.handleSignalWeak(event);
    });

    // 紧急警报处理器
    this.registerHandler(EVENT_TYPES.EMERGENCY_ALERT, async (event) => {
      await this.handleEmergencyAlert(event);
    });

    // 系统错误处理器
    this.registerHandler(EVENT_TYPES.SYSTEM_ERROR, async (event) => {
      await this.handleSystemError(event);
    });

    // 维护到期处理器
    this.registerHandler(EVENT_TYPES.MAINTENANCE_DUE, async (event) => {
      await this.handleMaintenanceDue(event);
    });

    // 天气警告处理器
    this.registerHandler(EVENT_TYPES.WEATHER_WARNING, async (event) => {
      await this.handleWeatherWarning(event);
    });

    // 空域违规处理器
    this.registerHandler(EVENT_TYPES.AIRSPACE_VIOLATION, async (event) => {
      await this.handleAirspaceViolation(event);
    });

    // 调度更新处理器
    this.registerHandler(EVENT_TYPES.SCHEDULE_UPDATE, async (event) => {
      await this.handleScheduleUpdate(event);
    });
  }

  /**
   * 注册事件处理器
   * @param {string} eventType - 事件类型
   * @param {Function} handler - 处理函数
   */
  registerHandler(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  /**
   * 发布事件
   * @param {Object} event - 事件对象
   */
  async publishEvent(event) {
    try {
      const {
        type,
        severity = SEVERITY_LEVELS.INFO,
        source,
        data,
        timestamp = new Date().toISOString(),
        channels = [NOTIFICATION_CHANNELS.WEBSOCKET]
      } = event;

      // 验证事件类型
      if (!Object.values(EVENT_TYPES).includes(type)) {
        logger.warn(`未知的事件类型: ${type}`);
        return;
      }

      // 创建完整的事件对象
      const fullEvent = {
        id: this.generateEventId(),
        type,
        severity,
        source,
        data,
        timestamp,
        channels
      };

      logger.info(`发布事件: ${type}`, { eventId: fullEvent.id, severity, source });

      // 存储事件到数据库
      await this.storeEvent(fullEvent);

      // 执行事件处理器
      const handlers = this.eventHandlers.get(type) || [];
      for (const handler of handlers) {
        try {
          await handler(fullEvent);
        } catch (error) {
          logger.error(`事件处理器执行失败 (${type}):`, error);
        }
      }

      // 发送通知
      await this.sendNotifications(fullEvent);

    } catch (error) {
      logger.error('发布事件失败:', error);
    }
  }

  /**
   * 生成事件ID
   * @returns {string} 事件ID
   */
  generateEventId() {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 存储事件到数据库
   * @param {Object} event - 事件对象
   */
  async storeEvent(event) {
    try {
      const pool = getPool();
      await pool.query(`
        INSERT INTO events (
          event_id, event_type, severity, source, data, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        event.id,
        event.type,
        event.severity,
        event.source,
        JSON.stringify(event.data),
        event.timestamp
      ]);
    } catch (error) {
      // 如果events表不存在，先创建它
      if (error.code === '42P01') {
        await this.createEventsTable();
        await this.storeEvent(event); // 重试
      } else {
        logger.error('存储事件失败:', error);
      }
    }
  }

  /**
   * 创建事件表
   */
  async createEventsTable() {
    try {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(100) UNIQUE NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          source VARCHAR(100),
          data JSONB,
          timestamp TIMESTAMPTZ NOT NULL,
          processed BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_events_severity ON events (severity);
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp);
      `);
      
      logger.info('事件表创建成功');
    } catch (error) {
      logger.error('创建事件表失败:', error);
    }
  }

  /**
   * 发送通知
   * @param {Object} event - 事件对象
   */
  async sendNotifications(event) {
    try {
      for (const channel of event.channels) {
        switch (channel) {
          case NOTIFICATION_CHANNELS.WEBSOCKET:
            await this.sendWebSocketNotification(event);
            break;
          case NOTIFICATION_CHANNELS.EMAIL:
            await this.sendEmailNotification(event);
            break;
          case NOTIFICATION_CHANNELS.SMS:
            await this.sendSMSNotification(event);
            break;
          case NOTIFICATION_CHANNELS.PUSH:
            await this.sendPushNotification(event);
            break;
          default:
            logger.warn(`未知的通知渠道: ${channel}`);
        }
      }
    } catch (error) {
      logger.error('发送通知失败:', error);
    }
  }

  /**
   * 发送WebSocket通知
   * @param {Object} event - 事件对象
   */
  async sendWebSocketNotification(event) {
    try {
      const notification = {
        id: event.id,
        type: event.type,
        severity: event.severity,
        title: this.getEventTitle(event),
        message: this.getEventMessage(event),
        data: event.data,
        timestamp: event.timestamp
      };

      // 根据事件类型选择广播方式
      switch (event.type) {
        case EVENT_TYPES.MISSION_STATUS_CHANGE:
        case EVENT_TYPES.SCHEDULE_UPDATE:
          broadcastMissionUpdate(event.data.missionId, notification);
          break;
        default:
          broadcastAlert(notification);
      }
    } catch (error) {
      logger.error('发送WebSocket通知失败:', error);
    }
  }

  /**
   * 发送邮件通知（占位符）
   * @param {Object} event - 事件对象
   */
  async sendEmailNotification(event) {
    // 这里应该集成邮件服务
    logger.info(`邮件通知: ${event.type}`, event.data);
  }

  /**
   * 发送短信通知（占位符）
   * @param {Object} event - 事件对象
   */
  async sendSMSNotification(event) {
    // 这里应该集成短信服务
    logger.info(`短信通知: ${event.type}`, event.data);
  }

  /**
   * 发送推送通知（占位符）
   * @param {Object} event - 事件对象
   */
  async sendPushNotification(event) {
    // 这里应该集成推送服务
    logger.info(`推送通知: ${event.type}`, event.data);
  }

  /**
   * 获取事件标题
   * @param {Object} event - 事件对象
   * @returns {string} 事件标题
   */
  getEventTitle(event) {
    const titles = {
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

    return titles[event.type] || '系统通知';
  }

  /**
   * 获取事件消息
   * @param {Object} event - 事件对象
   * @returns {string} 事件消息
   */
  getEventMessage(event) {
    if (event.data && event.data.message) {
      return event.data.message;
    }

    // 根据事件类型生成默认消息
    switch (event.type) {
      case EVENT_TYPES.DRONE_STATUS_CHANGE:
        return `无人机 ${event.data.droneId} 状态变更为 ${event.data.newStatus}`;
      case EVENT_TYPES.MISSION_STATUS_CHANGE:
        return `任务 ${event.data.missionId} 状态变更为 ${event.data.newStatus}`;
      case EVENT_TYPES.BATTERY_LOW:
        return `无人机 ${event.data.droneId} 电池电量低于 ${event.data.batteryLevel}%`;
      case EVENT_TYPES.SIGNAL_WEAK:
        return `无人机 ${event.data.droneId} 信号强度弱 (${event.data.signalStrength} dBm)`;
      default:
        return '系统事件通知';
    }
  }

  // 事件处理器实现
  async handleDroneStatusChange(event) {
    logger.info(`处理无人机状态变化: ${event.data.droneId} -> ${event.data.newStatus}`);
  }

  async handleMissionStatusChange(event) {
    logger.info(`处理任务状态变化: ${event.data.missionId} -> ${event.data.newStatus}`);
  }

  async handleBatteryLow(event) {
    logger.warn(`处理电池低电量警告: ${event.data.droneId} (${event.data.batteryLevel}%)`);
  }

  async handleSignalWeak(event) {
    logger.warn(`处理信号弱警告: ${event.data.droneId} (${event.data.signalStrength} dBm)`);
  }

  async handleEmergencyAlert(event) {
    logger.error(`处理紧急警报: ${event.data.message}`);
  }

  async handleSystemError(event) {
    logger.error(`处理系统错误: ${event.data.error}`);
  }

  async handleMaintenanceDue(event) {
    logger.info(`处理维护到期通知: ${event.data.droneId}`);
  }

  async handleWeatherWarning(event) {
    logger.warn(`处理天气警告: ${event.data.warning}`);
  }

  async handleAirspaceViolation(event) {
    logger.error(`处理空域违规: ${event.data.droneId} 在 ${event.data.location}`);
  }

  async handleScheduleUpdate(event) {
    logger.info(`处理调度更新: ${event.data.scheduleId}`);
    broadcastScheduleUpdate(event.data);
  }
}

// 创建全局通知管理器实例
const notificationManager = new NotificationManager();

module.exports = {
  notificationManager,
  EVENT_TYPES,
  SEVERITY_LEVELS,
  NOTIFICATION_CHANNELS
};