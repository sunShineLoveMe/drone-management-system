const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * 验证JWT令牌的中间件
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '未提供访问令牌' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '令牌已过期', code: 'TOKEN_EXPIRED' });
    }
    logger.error('令牌验证失败:', error);
    return res.status(403).json({ error: '无效的令牌' });
  }
};

/**
 * 检查用户角色的中间件
 * @param {string|string[]} roles - 允许的角色或角色数组
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未经身份验证' });
    }
    
    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(userRole)) {
      logger.warn(`用户 ${req.user.username} (角色: ${userRole}) 尝试访问需要 ${allowedRoles.join(', ')} 角色的资源`);
      return res.status(403).json({ error: '权限不足' });
    }
    
    next();
  };
};

/**
 * 检查资源所有权的中间件
 * @param {Function} getOwnerId - 从请求中获取资源所有者ID的函数
 */
const checkOwnership = (getOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '未经身份验证' });
      }
      
      // 管理员可以访问所有资源
      if (req.user.role === 'admin') {
        return next();
      }
      
      const ownerId = await getOwnerId(req);
      
      if (ownerId !== req.user.id) {
        logger.warn(`用户 ${req.user.username} 尝试访问不属于他们的资源`);
        return res.status(403).json({ error: '权限不足' });
      }
      
      next();
    } catch (error) {
      logger.error('检查所有权失败:', error);
      res.status(500).json({ error: '检查所有权失败' });
    }
  };
};

/**
 * 检查API密钥的中间件（用于无人机和外部系统集成）
 */
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: '未提供API密钥' });
  }
  
  // 在实际应用中，应该从数据库或Redis中验证API密钥
  // 这里简化为环境变量中的密钥列表
  const validApiKeys = (process.env.VALID_API_KEYS || '').split(',');
  
  if (!validApiKeys.includes(apiKey)) {
    logger.warn(`使用无效的API密钥尝试访问: ${apiKey.substring(0, 8)}...`);
    return res.status(403).json({ error: '无效的API密钥' });
  }
  
  // 可以在这里添加API密钥的角色或权限
  req.apiClient = {
    type: 'api',
    // 可以从数据库中获取更多信息
  };
  
  next();
};

/**
 * 限制请求速率的中间件
 * @param {number} maxRequests - 在时间窗口内允许的最大请求数
 * @param {number} windowMs - 时间窗口（毫秒）
 */
const rateLimit = (maxRequests, windowMs) => {
  const clients = new Map();
  
  return (req, res, next) => {
    // 使用IP或用户ID作为标识符
    const identifier = req.user ? req.user.id : req.ip;
    
    const now = Date.now();
    const client = clients.get(identifier) || { count: 0, resetTime: now + windowMs };
    
    // 如果时间窗口已过，重置计数器
    if (now > client.resetTime) {
      client.count = 1;
      client.resetTime = now + windowMs;
    } else {
      client.count++;
    }
    
    clients.set(identifier, client);
    
    // 检查是否超过限制
    if (client.count > maxRequests) {
      logger.warn(`速率限制超过: ${identifier}, ${client.count} 请求`);
      return res.status(429).json({ 
        error: '请求过多，请稍后再试',
        retryAfter: Math.ceil((client.resetTime - now) / 1000)
      });
    }
    
    next();
  };
};

module.exports = {
  authenticateToken,
  checkRole,
  checkOwnership,
  authenticateApiKey,
  rateLimit
};