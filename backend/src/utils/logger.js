const winston = require('winston');
const { format } = winston;
const path = require('path');
const fs = require('fs');

// 确保日志目录存在
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 自定义格式
const customFormat = format.printf(({ level, message, timestamp, ...metadata }) => {
  let metaStr = '';
  if (Object.keys(metadata).length > 0) {
    if (metadata.stack) {
      // 处理错误堆栈
      metaStr = `\n${metadata.stack}`;
    } else {
      // 处理其他元数据
      metaStr = `\n${JSON.stringify(metadata, null, 2)}`;
    }
  }
  
  return `${timestamp} [${level}]: ${message}${metaStr}`;
});

// 创建日志记录器
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.metadata({ fillExcept: ['level', 'message', 'timestamp'] })
  ),
  defaultMeta: { 
    service: 'drone-management-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // 错误日志
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      format: format.combine(
        format.json()
      )
    }),
    
    // 所有日志
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      format: format.combine(
        format.json()
      )
    }),
    
    // 按日期滚动的日志
    new winston.transports.File({
      filename: path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`),
      format: format.combine(
        customFormat
      )
    })
  ],
  // 处理未捕获的异常和拒绝的Promise
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log'),
      format: format.combine(
        format.json()
      )
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'rejections.log'),
      format: format.combine(
        format.json()
      )
    })
  ],
  exitOnError: false // 不要在未捕获的异常上退出
});

// 在开发环境中添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: format.combine(
      format.colorize(),
      customFormat
    ),
    handleExceptions: true,
    handleRejections: true
  }));
}

// 添加请求日志中间件
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // 响应完成时记录请求
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger.log(logLevel, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
};

// 添加错误日志中间件
const errorLogger = (err, req, res, next) => {
  logger.error(`Request error: ${err.message}`, {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip
  });
  
  next(err);
};

module.exports = {
  logger,
  requestLogger,
  errorLogger
};