/**
 * 用户模型
 */
const { getPool } = require('../config/database');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

class UserModel {
  /**
   * 根据ID获取用户
   * @param {number} id - 用户ID
   * @returns {Promise<Object|null>} 用户对象或null
   */
  static async getById(id) {
    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT id, username, email, role, created_at, updated_at
         FROM users WHERE id = $1`,
        [id]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('获取用户失败:', error);
      throw error;
    }
  }
  
  /**
   * 根据用户名获取用户
   * @param {string} username - 用户名
   * @returns {Promise<Object|null>} 用户对象或null
   */
  static async getByUsername(username) {
    try {
      const pool = getPool();
      const result = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('获取用户失败:', error);
      throw error;
    }
  }
  
  /**
   * 根据邮箱获取用户
   * @param {string} email - 邮箱
   * @returns {Promise<Object|null>} 用户对象或null
   */
  static async getByEmail(email) {
    try {
      const pool = getPool();
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('获取用户失败:', error);
      throw error;
    }
  }
  
  /**
   * 创建新用户
   * @param {Object} userData - 用户数据
   * @param {string} userData.username - 用户名
   * @param {string} userData.email - 邮箱
   * @param {string} userData.password - 密码
   * @param {string} userData.role - 角色
   * @returns {Promise<Object>} 创建的用户对象
   */
  static async create(userData) {
    try {
      const { username, email, password, role = 'operator' } = userData;
      
      // 哈希密码
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const pool = getPool();
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, role, created_at`,
        [username, email, hashedPassword, role]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('创建用户失败:', error);
      throw error;
    }
  }
  
  /**
   * 更新用户
   * @param {number} id - 用户ID
   * @param {Object} userData - 用户数据
   * @returns {Promise<Object>} 更新后的用户对象
   */
  static async update(id, userData) {
    try {
      const { email, role } = userData;
      
      const pool = getPool();
      const result = await pool.query(
        `UPDATE users
         SET email = COALESCE($1, email),
             role = COALESCE($2, role),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, username, email, role, updated_at`,
        [email, role, id]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('更新用户失败:', error);
      throw error;
    }
  }
  
  /**
   * 更改用户密码
   * @param {number} id - 用户ID
   * @param {string} newPassword - 新密码
   * @returns {Promise<boolean>} 是否成功
   */
  static async changePassword(id, newPassword) {
    try {
      // 哈希新密码
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      const pool = getPool();
      const result = await pool.query(
        `UPDATE users
         SET password_hash = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [hashedPassword, id]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('更改密码失败:', error);
      throw error;
    }
  }
  
  /**
   * 验证密码
   * @param {string} password - 明文密码
   * @param {string} hashedPassword - 哈希密码
   * @returns {Promise<boolean>} 是否匹配
   */
  static async verifyPassword(password, hashedPassword) {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      logger.error('验证密码失败:', error);
      throw error;
    }
  }
  
  /**
   * 更新最后登录时间
   * @param {number} id - 用户ID
   * @returns {Promise<boolean>} 是否成功
   */
  static async updateLastLogin(id) {
    try {
      const pool = getPool();
      const result = await pool.query(
        `UPDATE users
         SET last_login = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('更新最后登录时间失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取所有用户
   * @param {Object} options - 选项
   * @param {number} options.limit - 限制数量
   * @param {number} options.offset - 偏移量
   * @returns {Promise<Object[]>} 用户列表
   */
  static async getAll({ limit = 50, offset = 0 } = {}) {
    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT id, username, email, role, last_login, created_at, updated_at
         FROM users
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('获取用户列表失败:', error);
      throw error;
    }
  }
  
  /**
   * 删除用户
   * @param {number} id - 用户ID
   * @returns {Promise<boolean>} 是否成功
   */
  static async delete(id) {
    try {
      const pool = getPool();
      const result = await pool.query(
        'DELETE FROM users WHERE id = $1',
        [id]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('删除用户失败:', error);
      throw error;
    }
  }
}

module.exports = UserModel;