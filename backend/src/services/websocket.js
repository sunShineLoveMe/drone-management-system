/**
 * WebSocket服务
 */
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const { updateBusinessMetric } = require('../utils/metrics');

// 存储连接的客户端
const connectedClients = new Map();
const droneConnections = new Map();

/**
 * 设置WebSocket服务器
 * @param {Object} io - Socket.IO实例
 */
function setupWebSocket(io) {
  // 认证中间件
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('未提供认证令牌'));
      }
      
      // 验证JWT令牌
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      socket.user = decoded;
      
      logger.info(`用户 ${decoded.username} 通过WebSocket连接`);
      next();
    } catch (error) {
      logger.error('WebSocket认证失败:', error);
      next(new Error('认证失败'));
    }
  });
  
  // 处理连接
  io.on('connection', (socket) => {
    handleConnection(socket);
  });
  
  logger.info('WebSocket服务器设置完成');
}

/**
 * 处理客户端连接
 * @param {Object} socket - Socket实例
 */
function handleConnection(socket) {
  const userId = socket.user.id;
  const username = socket.user.username;
  
  // 存储连接
  connectedClients.set(userId, socket);
  
  logger.info(`用户 ${username} (ID: ${userId}) 已连接`);
  
  // 更新在线用户数指标
  updateBusinessMetric('activeUsers', connectedClients.size);
  
  // 发送欢迎消息
  socket.emit('welcome', {
    message: '欢迎连接到无人机管理系统',
    user: socket.user,
    timestamp: new Date().toISOString()
  });
  
  // 处理订阅事件
  socket.on('subscribe', (data) => {
    handleSubscription(socket, data);
  });
  
  // 处理取消订阅事件
  socket.on('unsubscribe', (data) => {
    handleUnsubscription(socket, data);
  });
  
  // 处理无人机控制命令
  socket.on('drone_command', (data) => {
    handleDroneCommand(socket, data);
  });
  
  // 处理任务命令
  socket.on('mission_command', (data) => {
    handleMissionCommand(socket, data);
  });
  
  // 处理断开连接
  socket.on('disconnect', (reason) => {
    handleDisconnection(socket, reason);
  });
  
  // 处理错误
  socket.on('error', (error) => {
    logger.error(`WebSocket错误 (用户: ${username}):`, error);
  });
}

/**
 * 处理订阅
 * @param {Object} socket - Socket实例
 * @param {Object} data - 订阅数据
 */
function handleSubscription(socket, data) {
  try {
    const { type, target } = data;
    
    switch (type) {
      case 'drone_telemetry':
        // 订阅无人机遥测数据
        if (target) {
          socket.join(`drone_${target}`);
          logger.info(`用户 ${socket.user.username} 订阅了无人机 ${target} 的遥测数据`);
        } else {
          socket.join('all_drones');
          logger.info(`用户 ${socket.user.username} 订阅了所有无人机的遥测数据`);
        }
        break;
        
      case 'mission_updates':
        // 订阅任务更新
        if (target) {
          socket.join(`mission_${target}`);
          logger.info(`用户 ${socket.user.username} 订阅了任务 ${target} 的更新`);
        } else {
          socket.join('all_missions');
          logger.info(`用户 ${socket.user.username} 订阅了所有任务的更新`);
        }
        break;
        
      case 'system_alerts':
        // 订阅系统警报
        socket.join('system_alerts');
        logger.info(`用户 ${socket.user.username} 订阅了系统警报`);
        break;
        
      case 'scheduling_updates':
        // 订阅调度更新
        socket.join('scheduling_updates');
        logger.info(`用户 ${socket.user.username} 订阅了调度更新`);
        break;
        
      default:
        socket.emit('error', { message: '未知的订阅类型' });
    }
    
    socket.emit('subscription_confirmed', { type, target });
  } catch (error) {
    logger.error('处理订阅失败:', error);
    socket.emit('error', { message: '订阅失败' });
  }
}

/**
 * 处理取消订阅
 * @param {Object} socket - Socket实例
 * @param {Object} data - 取消订阅数据
 */
function handleUnsubscription(socket, data) {
  try {
    const { type, target } = data;
    
    switch (type) {
      case 'drone_telemetry':
        if (target) {
          socket.leave(`drone_${target}`);
        } else {
          socket.leave('all_drones');
        }
        break;
        
      case 'mission_updates':
        if (target) {
          socket.leave(`mission_${target}`);
        } else {
          socket.leave('all_missions');
        }
        break;
        
      case 'system_alerts':
        socket.leave('system_alerts');
        break;
        
      case 'scheduling_updates':
        socket.leave('scheduling_updates');
        break;
    }
    
    socket.emit('unsubscription_confirmed', { type, target });
    logger.info(`用户 ${socket.user.username} 取消了订阅: ${type}`);
  } catch (error) {
    logger.error('处理取消订阅失败:', error);
    socket.emit('error', { message: '取消订阅失败' });
  }
}

/**
 * 处理无人机控制命令
 * @param {Object} socket - Socket实例
 * @param {Object} data - 命令数据
 */
function handleDroneCommand(socket, data) {
  try {
    const { droneId, command, params } = data;
    
    // 检查权限
    if (!['admin', 'operator'].includes(socket.user.role)) {
      socket.emit('command_error', { message: '权限不足' });
      return;
    }
    
    logger.info(`用户 ${socket.user.username} 向无人机 ${droneId} 发送命令: ${command}`, params);
    
    // 这里应该将命令发送给实际的无人机
    // 目前只是模拟响应
    setTimeout(() => {
      socket.emit('command_response', {
        droneId,
        command,
        status: 'success',
        message: '命令执行成功',
        timestamp: new Date().toISOString()
      });
    }, 1000);
    
  } catch (error) {
    logger.error('处理无人机命令失败:', error);
    socket.emit('command_error', { message: '命令执行失败' });
  }
}

/**
 * 处理任务命令
 * @param {Object} socket - Socket实例
 * @param {Object} data - 命令数据
 */
function handleMissionCommand(socket, data) {
  try {
    const { missionId, command, params } = data;
    
    // 检查权限
    if (!['admin', 'operator'].includes(socket.user.role)) {
      socket.emit('command_error', { message: '权限不足' });
      return;
    }
    
    logger.info(`用户 ${socket.user.username} 对任务 ${missionId} 执行命令: ${command}`, params);
    
    // 这里应该处理实际的任务命令
    // 目前只是模拟响应
    setTimeout(() => {
      socket.emit('mission_response', {
        missionId,
        command,
        status: 'success',
        message: '任务命令执行成功',
        timestamp: new Date().toISOString()
      });
    }, 1000);
    
  } catch (error) {
    logger.error('处理任务命令失败:', error);
    socket.emit('command_error', { message: '任务命令执行失败' });
  }
}

/**
 * 处理断开连接
 * @param {Object} socket - Socket实例
 * @param {string} reason - 断开原因
 */
function handleDisconnection(socket, reason) {
  const userId = socket.user.id;
  const username = socket.user.username;
  
  // 从连接列表中移除
  connectedClients.delete(userId);
  
  // 更新在线用户数指标
  updateBusinessMetric('activeUsers', connectedClients.size);
  
  logger.info(`用户 ${username} (ID: ${userId}) 已断开连接，原因: ${reason}`);
}

/**
 * 广播遥测数据
 * @param {string} droneId - 无人机ID
 * @param {Object} telemetryData - 遥测数据
 */
function broadcastTelemetry(droneId, telemetryData) {
  try {
    const io = require('../app').io;
    
    // 发送给订阅特定无人机的客户端
    io.to(`drone_${droneId}`).emit('telemetry_update', {
      droneId,
      data: telemetryData,
      timestamp: new Date().toISOString()
    });
    
    // 发送给订阅所有无人机的客户端
    io.to('all_drones').emit('telemetry_update', {
      droneId,
      data: telemetryData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('广播遥测数据失败:', error);
  }
}

/**
 * 广播任务更新
 * @param {string} missionId - 任务ID
 * @param {Object} updateData - 更新数据
 */
function broadcastMissionUpdate(missionId, updateData) {
  try {
    const io = require('../app').io;
    
    // 发送给订阅特定任务的客户端
    io.to(`mission_${missionId}`).emit('mission_update', {
      missionId,
      data: updateData,
      timestamp: new Date().toISOString()
    });
    
    // 发送给订阅所有任务的客户端
    io.to('all_missions').emit('mission_update', {
      missionId,
      data: updateData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('广播任务更新失败:', error);
  }
}

/**
 * 广播系统警报
 * @param {Object} alertData - 警报数据
 */
function broadcastAlert(alertData) {
  try {
    const io = require('../app').io;
    
    io.to('system_alerts').emit('system_alert', {
      ...alertData,
      timestamp: new Date().toISOString()
    });
    
    logger.info('系统警报已广播:', alertData);
  } catch (error) {
    logger.error('广播系统警报失败:', error);
  }
}

/**
 * 广播调度更新
 * @param {Object} scheduleData - 调度数据
 */
function broadcastScheduleUpdate(scheduleData) {
  try {
    const io = require('../app').io;
    
    io.to('scheduling_updates').emit('schedule_update', {
      ...scheduleData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('广播调度更新失败:', error);
  }
}

/**
 * 获取连接统计
 * @returns {Object} 连接统计
 */
function getConnectionStats() {
  return {
    totalConnections: connectedClients.size,
    droneConnections: droneConnections.size,
    connectedUsers: Array.from(connectedClients.values()).map(socket => ({
      id: socket.user.id,
      username: socket.user.username,
      role: socket.user.role,
      connectedAt: socket.handshake.time
    }))
  };
}

module.exports = {
  setupWebSocket,
  broadcastTelemetry,
  broadcastMissionUpdate,
  broadcastAlert,
  broadcastScheduleUpdate,
  getConnectionStats
};