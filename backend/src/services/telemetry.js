/**
 * 遥测数据处理服务
 */
const { getPool } = require('../config/database');
const { cache } = require('../config/redis');
const { logger } = require('../utils/logger');
const { validateTelemetry } = require('../utils/validators');
const { broadcastTelemetry, broadcastAlert } = require('./websocket');
const { updateBusinessMetric } = require('../utils/metrics');

// 遥测数据缓存
const telemetryCache = new Map();

// 异常检测阈值
const THRESHOLDS = {
  batteryLow: 25,
  batteryVeryLow: 15,
  signalWeak: -80,
  signalVeryWeak: -90,
  temperatureHigh: 60,
  temperatureLow: -10,
  altitudeMax: 500,
  speedMax: 30
};

/**
 * 处理遥测数据
 * @param {string} droneId - 无人机ID
 * @param {Object} telemetryData - 遥测数据
 */
async function processTelemetryData(droneId, telemetryData) {
  try {
    // 验证遥测数据
    const { error } = validateTelemetry(telemetryData);
    if (error) {
      logger.warn(`无人机 ${droneId} 遥测数据验证失败:`, error.details[0].message);
      return false;
    }
    
    // 添加时间戳
    const processedData = {
      ...telemetryData,
      timestamp: new Date().toISOString(),
      droneId
    };
    
    // 存储到数据库
    await storeTelemetryData(droneId, processedData);
    
    // 更新缓存
    updateTelemetryCache(droneId, processedData);
    
    // 更新无人机状态
    await updateDroneStatus(droneId, processedData);
    
    // 异常检测
    await detectAnomalies(droneId, processedData);
    
    // 广播遥测数据
    broadcastTelemetry(droneId, processedData);
    
    logger.debug(`无人机 ${droneId} 遥测数据处理完成`);
    return true;
    
  } catch (error) {
    logger.error(`处理无人机 ${droneId} 遥测数据失败:`, error);
    return false;
  }
}

/**
 * 存储遥测数据到数据库
 * @param {string} droneId - 无人机ID
 * @param {Object} data - 遥测数据
 */
async function storeTelemetryData(droneId, data) {
  try {
    const pool = getPool();
    
    await pool.query(`
      INSERT INTO drone_telemetry (
        time, drone_id, latitude, longitude, altitude, battery_level,
        speed, heading, temperature, humidity, wind_speed, signal_strength, status
      ) VALUES (
        CURRENT_TIMESTAMP, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
    `, [
      droneId,
      data.latitude,
      data.longitude,
      data.altitude,
      data.battery_level,
      data.speed,
      data.heading,
      data.temperature,
      data.humidity,
      data.wind_speed,
      data.signal_strength,
      data.status
    ]);
    
  } catch (error) {
    logger.error(`存储遥测数据失败:`, error);
    throw error;
  }
}

/**
 * 更新遥测数据缓存
 * @param {string} droneId - 无人机ID
 * @param {Object} data - 遥测数据
 */
function updateTelemetryCache(droneId, data) {
  try {
    // 获取或创建无人机的遥测历史
    if (!telemetryCache.has(droneId)) {
      telemetryCache.set(droneId, []);
    }
    
    const history = telemetryCache.get(droneId);
    history.push(data);
    
    // 保持历史记录在合理范围内（最近100条）
    if (history.length > 100) {
      history.shift();
    }
    
    // 同时更新Redis缓存
    cache.set(`telemetry:${droneId}:latest`, data, 300); // 5分钟过期
    
  } catch (error) {
    logger.error(`更新遥测缓存失败:`, error);
  }
}

/**
 * 更新无人机状态
 * @param {string} droneId - 无人机ID
 * @param {Object} data - 遥测数据
 */
async function updateDroneStatus(droneId, data) {
  try {
    const pool = getPool();
    
    await pool.query(`
      UPDATE drones 
      SET 
        location = ST_SetSRID(ST_MakePoint($2, $3), 4326),
        altitude = $4,
        battery_level = $5,
        speed = $6,
        heading = $7,
        status = $8,
        last_seen = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE drone_id = $1
    `, [
      droneId,
      data.longitude,
      data.latitude,
      data.altitude,
      data.battery_level,
      data.speed,
      data.heading,
      data.status
    ]);
    
    // 清除相关缓存
    await cache.del(`drone:${droneId}`);
    
  } catch (error) {
    logger.error(`更新无人机状态失败:`, error);
    throw error;
  }
}

/**
 * 异常检测
 * @param {string} droneId - 无人机ID
 * @param {Object} data - 遥测数据
 */
async function detectAnomalies(droneId, data) {
  try {
    const alerts = [];
    
    // 电池电量检测
    if (data.battery_level <= THRESHOLDS.batteryVeryLow) {
      alerts.push({
        type: 'battery_critical',
        severity: 'critical',
        message: `无人机 ${droneId} 电池电量极低 (${data.battery_level}%)`
      });
    } else if (data.battery_level <= THRESHOLDS.batteryLow) {
      alerts.push({
        type: 'battery_low',
        severity: 'warning',
        message: `无人机 ${droneId} 电池电量偏低 (${data.battery_level}%)`
      });
    }
    
    // 信号强度检测
    if (data.signal_strength && data.signal_strength <= THRESHOLDS.signalVeryWeak) {
      alerts.push({
        type: 'signal_critical',
        severity: 'critical',
        message: `无人机 ${droneId} 信号极弱 (${data.signal_strength} dBm)`
      });
    } else if (data.signal_strength && data.signal_strength <= THRESHOLDS.signalWeak) {
      alerts.push({
        type: 'signal_weak',
        severity: 'warning',
        message: `无人机 ${droneId} 信号较弱 (${data.signal_strength} dBm)`
      });
    }
    
    // 温度检测
    if (data.temperature) {
      if (data.temperature >= THRESHOLDS.temperatureHigh) {
        alerts.push({
          type: 'temperature_high',
          severity: 'warning',
          message: `无人机 ${droneId} 温度过高 (${data.temperature}°C)`
        });
      } else if (data.temperature <= THRESHOLDS.temperatureLow) {
        alerts.push({
          type: 'temperature_low',
          severity: 'warning',
          message: `无人机 ${droneId} 温度过低 (${data.temperature}°C)`
        });
      }
    }
    
    // 高度检测
    if (data.altitude >= THRESHOLDS.altitudeMax) {
      alerts.push({
        type: 'altitude_high',
        severity: 'warning',
        message: `无人机 ${droneId} 飞行高度过高 (${data.altitude}m)`
      });
    }
    
    // 速度检测
    if (data.speed >= THRESHOLDS.speedMax) {
      alerts.push({
        type: 'speed_high',
        severity: 'warning',
        message: `无人机 ${droneId} 飞行速度过快 (${data.speed} m/s)`
      });
    }
    
    // 发送警报
    for (const alert of alerts) {
      await createAlert(droneId, alert);
      broadcastAlert({
        ...alert,
        droneId,
        location: {
          latitude: data.latitude,
          longitude: data.longitude
        }
      });
    }
    
  } catch (error) {
    logger.error(`异常检测失败:`, error);
  }
}

/**
 * 创建警报
 * @param {string} droneId - 无人机ID
 * @param {Object} alertData - 警报数据
 */
async function createAlert(droneId, alertData) {
  try {
    const pool = getPool();
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await pool.query(`
      INSERT INTO alerts (
        alert_id, alert_type, severity, title, description, drone_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      alertId,
      alertData.type,
      alertData.severity,
      alertData.message,
      alertData.message,
      droneId
    ]);
    
    logger.info(`创建警报: ${alertData.message}`);
    
  } catch (error) {
    logger.error(`创建警报失败:`, error);
  }
}

/**
 * 获取无人机最新遥测数据
 * @param {string} droneId - 无人机ID
 * @returns {Object|null} 最新遥测数据
 */
async function getLatestTelemetry(droneId) {
  try {
    // 先从缓存获取
    const cached = await cache.get(`telemetry:${droneId}:latest`);
    if (cached) {
      return cached;
    }
    
    // 从数据库获取
    const pool = getPool();
    const result = await pool.query(`
      SELECT * FROM drone_telemetry
      WHERE drone_id = $1
      ORDER BY time DESC
      LIMIT 1
    `, [droneId]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
    
  } catch (error) {
    logger.error(`获取最新遥测数据失败:`, error);
    return null;
  }
}

/**
 * 获取无人机遥测历史
 * @param {string} droneId - 无人机ID
 * @param {Object} options - 选项
 * @returns {Array} 遥测历史数据
 */
async function getTelemetryHistory(droneId, options = {}) {
  try {
    const { 
      startTime, 
      endTime, 
      limit = 1000,
      interval = '1 minute' 
    } = options;
    
    const pool = getPool();
    let query = `
      SELECT 
        time_bucket($1, time) AS bucket,
        AVG(latitude) as latitude,
        AVG(longitude) as longitude,
        AVG(altitude) as altitude,
        AVG(battery_level) as battery_level,
        AVG(speed) as speed,
        AVG(heading) as heading,
        AVG(temperature) as temperature,
        AVG(signal_strength) as signal_strength
      FROM drone_telemetry
      WHERE drone_id = $2
    `;
    
    const params = [interval, droneId];
    let paramIndex = 3;
    
    if (startTime) {
      query += ` AND time >= $${paramIndex}`;
      params.push(startTime);
      paramIndex++;
    }
    
    if (endTime) {
      query += ` AND time <= $${paramIndex}`;
      params.push(endTime);
      paramIndex++;
    }
    
    query += ` GROUP BY bucket ORDER BY bucket DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    return result.rows;
    
  } catch (error) {
    logger.error(`获取遥测历史失败:`, error);
    return [];
  }
}

/**
 * 获取遥测统计信息
 * @param {string} droneId - 无人机ID
 * @param {string} timeRange - 时间范围
 * @returns {Object} 统计信息
 */
async function getTelemetryStats(droneId, timeRange = '24 hours') {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        AVG(battery_level) as avg_battery,
        MIN(battery_level) as min_battery,
        MAX(battery_level) as max_battery,
        AVG(altitude) as avg_altitude,
        MAX(altitude) as max_altitude,
        AVG(speed) as avg_speed,
        MAX(speed) as max_speed,
        AVG(signal_strength) as avg_signal,
        MIN(signal_strength) as min_signal
      FROM drone_telemetry
      WHERE drone_id = $1 
        AND time >= NOW() - INTERVAL '${timeRange}'
    `, [droneId]);
    
    return result.rows[0] || {};
    
  } catch (error) {
    logger.error(`获取遥测统计失败:`, error);
    return {};
  }
}

module.exports = {
  processTelemetryData,
  getLatestTelemetry,
  getTelemetryHistory,
  getTelemetryStats
};