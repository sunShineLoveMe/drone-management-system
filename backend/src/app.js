const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const droneRoutes = require('./routes/drones');
const missionRoutes = require('./routes/missions');
const schedulingRoutes = require('./routes/scheduling');
const emergencyRoutes = require('./routes/emergency');
const healthRoutes = require('./routes/health');
const eventRoutes = require('./routes/events');

const { initializeDatabase } = require('./config/database');
const { initializeRedis } = require('./config/redis');
const { initializeKafka } = require('./config/kafka');
const { setupWebSocket } = require('./services/websocket');
const { logger, requestLogger, errorLogger } = require('./utils/logger');
const { metricsMiddleware } = require('./utils/metrics');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// 基础中间件
app.use(helmet()); // 安全头
app.use(cors()); // CORS
app.use(compression()); // 压缩响应
app.use(express.json({ limit: '10mb' })); // JSON解析
app.use(express.urlencoded({ extended: true })); // URL编码解析

// 日志和监控中间件
app.use(requestLogger); // 请求日志
app.use(metricsMiddleware); // 指标收集

// 路由
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/drones', droneRoutes);
app.use('/api/v1/missions', missionRoutes);
app.use('/api/v1/scheduling', schedulingRoutes);
app.use('/api/v1/emergency', emergencyRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/health', healthRoutes);

// 简单健康检查端点（无需认证）
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// 错误处理中间件
app.use(errorLogger); // 错误日志

app.use((err, req, res, next) => {
  // 已经在errorLogger中记录了错误
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 初始化服务
async function initializeServices() {
  try {
    logger.info('正在初始化服务...');
    
    // 初始化数据库
    logger.info('正在连接数据库...');
    await initializeDatabase();
    logger.info('数据库连接成功');
    
    // 初始化Redis
    logger.info('正在连接Redis...');
    await initializeRedis();
    logger.info('Redis连接成功');
    
    // 初始化Kafka
    logger.info('正在连接Kafka...');
    await initializeKafka();
    logger.info('Kafka连接成功');
    
    // 设置WebSocket
    logger.info('正在设置WebSocket...');
    setupWebSocket(io);
    logger.info('WebSocket设置成功');
    
    logger.info('所有服务初始化成功');
  } catch (error) {
    logger.error('服务初始化失败:', error);
    process.exit(1);
  }
}

// 启动服务器
const PORT = process.env.PORT || 8000;

server.listen(PORT, async () => {
  logger.info(`服务器正在运行，端口: ${PORT}`);
  logger.info(`环境: ${process.env.NODE_ENV || 'development'}`);
  await initializeServices();
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，正在优雅关闭...');
  server.close(() => {
    logger.info('HTTP服务器已关闭');
    process.exit(0);
  });
  
  // 如果10秒后还没有关闭，强制退出
  setTimeout(() => {
    logger.error('无法在10秒内优雅关闭，强制退出');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，正在优雅关闭...');
  server.close(() => {
    logger.info('HTTP服务器已关闭');
    process.exit(0);
  });
  
  // 如果10秒后还没有关闭，强制退出
  setTimeout(() => {
    logger.error('无法在10秒内优雅关闭，强制退出');
    process.exit(1);
  }, 10000);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  // 不立即退出，让日志有时间写入
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
});

module.exports = app;