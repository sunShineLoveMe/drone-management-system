/**
 * 紧急响应系统数据库模式迁移脚本
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
    logger.info('开始执行紧急响应系统数据库模式迁移');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '../sql/002_emergency_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL
    await pool.query(sql);
    
    logger.info('紧急响应系统数据库模式迁移完成');
  } catch (error) {
    logger.error('紧急响应系统数据库模式迁移失败:', error);
    throw error;
  }
}

/**
 * 回滚迁移
 */
async function down() {
  const pool = getPool();
  
  try {
    logger.info('开始回滚紧急响应系统数据库模式迁移');
    
    // 删除所有紧急相关的表
    await pool.query(`
      DROP TABLE IF EXISTS emergency_notifications CASCADE;
      DROP TABLE IF EXISTS emergency_escalation_rules CASCADE;
      DROP TABLE IF EXISTS emergency_response_history CASCADE;
      DROP TABLE IF EXISTS emergency_contacts CASCADE;
      DROP TABLE IF EXISTS emergency_teams CASCADE;
      DROP TABLE IF EXISTS emergency_protocol_executions CASCADE;
      DROP TABLE IF EXISTS emergencies CASCADE;
      DROP TYPE IF EXISTS emergency_type CASCADE;
      DROP TYPE IF EXISTS emergency_severity CASCADE;
      DROP TYPE IF EXISTS emergency_status CASCADE;
    `);
    
    logger.info('紧急响应系统数据库模式迁移回滚完成');
  } catch (error) {
    logger.error('紧急响应系统数据库模式迁移回滚失败:', error);
    throw error;
  }
}

module.exports = {
  up,
  down
};