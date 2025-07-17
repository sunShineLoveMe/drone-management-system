/**
 * 初始数据库模式迁移脚本
 */
const fs = require('fs');
const path = require('path');
const { getPool } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * 执行迁移
 */
async function up() {
  const pool = getPool();
  
  try {
    logger.info('开始执行初始数据库模式迁移');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '../sql/001_initial_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    await pool.query(sql);
    
    logger.info('初始数据库模式迁移完成');
  } catch (error) {
    logger.error('初始数据库模式迁移失败:', error);
    throw error;
  }
}

/**
 * 回滚迁移
 */
async function down() {
  const pool = getPool();
  
  try {
    logger.info('开始回滚初始数据库模式迁移');
    
    // 读取回滚SQL文件
    const sqlPath = path.join(__dirname, '../sql/001_initial_schema_down.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    await pool.query(sql);
    
    logger.info('初始数据库模式迁移回滚完成');
  } catch (error) {
    logger.error('初始数据库模式迁移回滚失败:', error);
    throw error;
  }
}

module.exports = {
  up,
  down
};