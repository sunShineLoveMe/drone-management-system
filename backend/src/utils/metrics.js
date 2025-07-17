/**
 * 指标收集工具
 */
const os = require('os');
const { logger } = require('./logger');

// 存储指标数据
const metrics = {
  // 系统指标
  system: {
    startTime: Date.now(),
    cpuUsage: [],
    memoryUsage: [],
    loadAverage: []
  },
  
  // HTTP请求指标
  http: {
    requestCount: 0,
    responseTimeTotal: 0,
    responseTimeAvg: 0,
    statusCodes: {},
    endpoints: {}
  },
  
  // 数据库指标
  database: {
    queryCount: 0,
    queryTimeTotal: 0,
    queryTimeAvg: 0,
    errorCount: 0
  },
  
  // 业务指标
  business: {
    activeUsers: 0,
    activeDrones: 0,
    activeMissions: 0,
    alertsGenerated: 0
  }
};

/**
 * 收集系统指标
 */
function collectSystemMetrics() {
  try {
    // CPU使用率
    const cpuUsage = process.cpuUsage();
    const cpuUsagePercent = (cpuUsage.user + cpuUsage.system) / 1000000; // 转换为秒
    
    // 内存使用率
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    
    // 负载平均值
    const loadAverage = os.loadavg();
    
    // 更新指标
    metrics.system.cpuUsage.push({
      timestamp: Date.now(),
      value: cpuUsagePercent
    });
    
    metrics.system.memoryUsage.push({
      timestamp: Date.now(),
      value: memoryUsagePercent
    });
    
    metrics.system.loadAverage.push({
      timestamp: Date.now(),
      value: loadAverage[0] // 1分钟负载
    });
    
    // 保持数组大小在合理范围内
    if (metrics.system.cpuUsage.length > 60) {
      metrics.system.cpuUsage.shift();
    }
    
    if (metrics.system.memoryUsage.length > 60) {
      metrics.system.memoryUsage.shift();
    }
    
    if (metrics.system.loadAverage.length > 60) {
      metrics.system.loadAverage.shift();
    }
  } catch (error) {
    logger.error('收集系统指标失败:', error);
  }
}

/**
 * 记录HTTP请求指标
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {number} responseTime - 响应时间（毫秒）
 */
function recordHttpMetric(req, res, responseTime) {
  try {
    // 增加请求计数
    metrics.http.requestCount++;
    
    // 累计响应时间
    metrics.http.responseTimeTotal += responseTime;
    
    // 计算平均响应时间
    metrics.http.responseTimeAvg = metrics.http.responseTimeTotal / metrics.http.requestCount;
    
    // 记录状态码
    const statusCode = res.statusCode;
    metrics.http.statusCodes[statusCode] = (metrics.http.statusCodes[statusCode] || 0) + 1;
    
    // 记录端点
    const endpoint = `${req.method} ${req.route ? req.route.path : req.path}`;
    if (!metrics.http.endpoints[endpoint]) {
      metrics.http.endpoints[endpoint] = {
        count: 0,
        responseTimeTotal: 0,
        responseTimeAvg: 0
      };
    }
    
    metrics.http.endpoints[endpoint].count++;
    metrics.http.endpoints[endpoint].responseTimeTotal += responseTime;
    metrics.http.endpoints[endpoint].responseTimeAvg = 
      metrics.http.endpoints[endpoint].responseTimeTotal / metrics.http.endpoints[endpoint].count;
  } catch (error) {
    logger.error('记录HTTP指标失败:', error);
  }
}

/**
 * 记录数据库查询指标
 * @param {number} queryTime - 查询时间（毫秒）
 * @param {boolean} isError - 是否发生错误
 */
function recordDatabaseMetric(queryTime, isError = false) {
  try {
    // 增加查询计数
    metrics.database.queryCount++;
    
    // 累计查询时间
    metrics.database.queryTimeTotal += queryTime;
    
    // 计算平均查询时间
    metrics.database.queryTimeAvg = metrics.database.queryTimeTotal / metrics.database.queryCount;
    
    // 记录错误
    if (isError) {
      metrics.database.errorCount++;
    }
  } catch (error) {
    logger.error('记录数据库指标失败:', error);
  }
}

/**
 * 更新业务指标
 * @param {string} metric - 指标名称
 * @param {number} value - 指标值
 */
function updateBusinessMetric(metric, value) {
  try {
    if (metrics.business.hasOwnProperty(metric)) {
      metrics.business[metric] = value;
    }
  } catch (error) {
    logger.error(`更新业务指标 ${metric} 失败:`, error);
  }
}

/**
 * 获取所有指标
 * @returns {Object} 指标数据
 */
function getMetrics() {
  return {
    system: {
      uptime: Date.now() - metrics.system.startTime,
      cpuUsage: metrics.system.cpuUsage.length > 0 ? metrics.system.cpuUsage[metrics.system.cpuUsage.length - 1].value : 0,
      memoryUsage: metrics.system.memoryUsage.length > 0 ? metrics.system.memoryUsage[metrics.system.memoryUsage.length - 1].value : 0,
      loadAverage: metrics.system.loadAverage.length > 0 ? metrics.system.loadAverage[metrics.system.loadAverage.length - 1].value : 0
    },
    http: {
      requestCount: metrics.http.requestCount,
      responseTimeAvg: metrics.http.responseTimeAvg,
      statusCodes: metrics.http.statusCodes
    },
    database: {
      queryCount: metrics.database.queryCount,
      queryTimeAvg: metrics.database.queryTimeAvg,
      errorCount: metrics.database.errorCount
    },
    business: metrics.business
  };
}

/**
 * 获取详细指标
 * @returns {Object} 详细指标数据
 */
function getDetailedMetrics() {
  return metrics;
}

/**
 * 重置指标
 */
function resetMetrics() {
  metrics.system.cpuUsage = [];
  metrics.system.memoryUsage = [];
  metrics.system.loadAverage = [];
  
  metrics.http.requestCount = 0;
  metrics.http.responseTimeTotal = 0;
  metrics.http.responseTimeAvg = 0;
  metrics.http.statusCodes = {};
  metrics.http.endpoints = {};
  
  metrics.database.queryCount = 0;
  metrics.database.queryTimeTotal = 0;
  metrics.database.queryTimeAvg = 0;
  metrics.database.errorCount = 0;
  
  // 业务指标保持不变
}

/**
 * 指标中间件
 */
function metricsMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // 响应完成时记录指标
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    recordHttpMetric(req, res, responseTime);
  });
  
  next();
}

// 定期收集系统指标
setInterval(collectSystemMetrics, 10000); // 每10秒收集一次

module.exports = {
  getMetrics,
  getDetailedMetrics,
  resetMetrics,
  recordDatabaseMetric,
  updateBusinessMetric,
  metricsMiddleware
};