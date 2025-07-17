const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const { validateRegistration, validateLogin } = require('../utils/validators');
const { authenticateToken, checkRole } = require('../middleware/auth');

// 用户注册
router.post('/register', async (req, res) => {
  try {
    // 验证请求数据
    const { error } = validateRegistration(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { username, email, password, role = 'operator' } = req.body;

    // 检查用户是否已存在
    const pool = getPool();
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: '用户名或邮箱已存在' });
    }

    // 检查角色是否有效
    const validRoles = ['admin', 'operator', 'viewer', 'emergency'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }

    // 哈希密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 创建新用户
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, role, created_at`,
      [username, email, hashedPassword, role]
    );

    logger.info(`新用户注册: ${username}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('注册失败:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    // 验证请求数据
    const { error } = validateLogin(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { username, password } = req.body;

    // 查找用户
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = result.rows[0];

    // 验证密码
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 创建JWT令牌
    const accessToken = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || 'your_refresh_secret',
      { expiresIn: '7d' }
    );

    // 存储刷新令牌
    await cache.set(`refresh_token:${user.id}`, refreshToken, 60 * 60 * 24 * 7); // 7天

    // 记录登录
    await pool.query(
      `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`,
      [user.id]
    );

    logger.info(`用户登录: ${username}`);
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 刷新令牌
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: '刷新令牌是必需的' });
    }

    // 验证刷新令牌
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'your_refresh_secret'
    );

    // 检查刷新令牌是否在Redis中
    const storedToken = await cache.get(`refresh_token:${decoded.id}`);
    if (!storedToken || storedToken !== refreshToken) {
      return res.status(401).json({ error: '无效的刷新令牌' });
    }

    // 获取用户信息
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = result.rows[0];

    // 创建新的访问令牌
    const accessToken = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );

    res.json({ accessToken });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '无效的刷新令牌' });
    }
    logger.error('刷新令牌失败:', error);
    res.status(500).json({ error: '刷新令牌失败' });
  }
});

// 注销
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // 从Redis中删除刷新令牌
    await cache.del(`refresh_token:${req.user.id}`);
    res.json({ message: '注销成功' });
  } catch (error) {
    logger.error('注销失败:', error);
    res.status(500).json({ error: '注销失败' });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, username, email, role, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 更改密码
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '当前密码和新密码都是必需的' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: '新密码必须至少包含8个字符' });
    }

    // 获取用户信息
    const pool = getPool();
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证当前密码
    const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: '当前密码错误' });
    }

    // 哈希新密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 更新密码
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    logger.info(`用户 ${req.user.username} 更改了密码`);
    res.json({ message: '密码已更改' });
  } catch (error) {
    logger.error('更改密码失败:', error);
    res.status(500).json({ error: '更改密码失败' });
  }
});

// 管理员路由：获取所有用户
router.get('/users', authenticateToken, checkRole('admin'), async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, username, email, role, created_at, updated_at
       FROM users ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 管理员路由：更新用户角色
router.put('/users/:userId/role', authenticateToken, checkRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // 检查角色是否有效
    const validRoles = ['admin', 'operator', 'viewer', 'emergency'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }

    // 更新用户角色
    const pool = getPool();
    const result = await pool.query(
      `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, username, email, role, updated_at`,
      [role, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    logger.info(`管理员 ${req.user.username} 更新了用户 ${result.rows[0].username} 的角色为 ${role}`);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('更新用户角色失败:', error);
    res.status(500).json({ error: '更新用户角色失败' });
  }
});

module.exports = router;