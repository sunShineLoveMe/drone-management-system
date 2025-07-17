/**
 * 数据库迁移管理器
 */
const fs = require('fs');
const path = require('path');
const { getPool } = require('../config/database');
const logger = require('../utils/logger');

// 迁移目录
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * 创建迁移表
 */
async function createMigrationsTable() {
  const pool = getPool();
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    logger.error('创建迁移表失败:', error);
    throw error;
  }
}

/**
 * 获取已应用的迁移
 */
async function getAppliedMigrations() {
  const pool = getPool();
  
  try {
    const result = await pool.query('SELECT name FROM migrations ORDER BY id');
    return result.rows.map(row => row.name);
  } catch (error) {
    logger.error('获取已应用迁移失败:', error);
    throw error;
  }
}

/**
 * 获取所有迁移文件
 */
function getAllMigrations() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.js'))
    .map(file => file.replace('.js', ''))
    .sort();
}

/**
 * 应用迁移
 */
async function applyMigration(migrationName) {
  const pool = getPool();
  const migration = require(path.join(MIGRATIONS_DIR, `${migrationName}.js`));
  
  try {
    logger.info(`应用迁移: ${migrationName}`);
    await migration.up();
    await pool.query('INSERT INTO migrations (name) VALUES ($1)', [migrationName]);
    logger.info(`迁移应用成功: ${migrationName}`);
  } catch (error) {
    logger.error(`应用迁移失败: ${migrationName}`, error);
    throw error;
  }
}

/**
 * 回滚迁移
 */
async function rollbackMigration(migrationName) {
  const pool = getPool();
  const migration = require(path.join(MIGRATIONS_DIR, `${migrationName}.js`));
  
  try {
    logger.info(`回滚迁移: ${migrationName}`);
    await migration.down();
    await pool.query('DELETE FROM migrations WHERE name = $1', [migrationName]);
    logger.info(`迁移回滚成功: ${migrationName}`);
  } catch (error) {
    logger.error(`回滚迁移失败: ${migrationName}`, error);
    throw error;
  }
}

/**
 * 执行所有未应用的迁移
 */
async function migrateUp() {
  try {
    await createMigrationsTable();
    
    const appliedMigrations = await getAppliedMigrations();
    const allMigrations = getAllMigrations();
    
    const pendingMigrations = allMigrations.filter(
      migration => !appliedMigrations.includes(migration)
    );
    
    if (pendingMigrations.length === 0) {
      logger.info('没有待应用的迁移');
      return;
    }
    
    logger.info(`发现 ${pendingMigrations.length} 个待应用的迁移`);
    
    for (const migration of pendingMigrations) {
      await applyMigration(migration);
    }
    
    logger.info('所有迁移应用完成');
  } catch (error) {
    logger.error('迁移过程中发生错误:', error);
    throw error;
  }
}

/**
 * 回滚最后一个迁移
 */
async function migrateDown() {
  try {
    await createMigrationsTable();
    
    const appliedMigrations = await getAppliedMigrations();
    
    if (appliedMigrations.length === 0) {
      logger.info('没有可回滚的迁移');
      return;
    }
    
    const lastMigration = appliedMigrations[appliedMigrations.length - 1];
    
    await rollbackMigration(lastMigration);
    
    logger.info('迁移回滚完成');
  } catch (error) {
    logger.error('回滚过程中发生错误:', error);
    throw error;
  }
}

/**
 * 回滚所有迁移
 */
async function migrateReset() {
  try {
    await createMigrationsTable();
    
    const appliedMigrations = await getAppliedMigrations();
    
    if (appliedMigrations.length === 0) {
      logger.info('没有可回滚的迁移');
      return;
    }
    
    // 从最后一个迁移开始回滚
    for (let i = appliedMigrations.length - 1; i >= 0; i--) {
      await rollbackMigration(appliedMigrations[i]);
    }
    
    logger.info('所有迁移已回滚');
  } catch (error) {
    logger.error('重置过程中发生错误:', error);
    throw error;
  }
}

/**
 * 刷新所有迁移（回滚后重新应用）
 */
async function migrateRefresh() {
  try {
    await migrateReset();
    await migrateUp();
    
    logger.info('迁移刷新完成');
  } catch (error) {
    logger.error('刷新过程中发生错误:', error);
    throw error;
  }
}

/**
 * 显示迁移状态
 */
async function migrateStatus() {
  try {
    await createMigrationsTable();
    
    const appliedMigrations = await getAppliedMigrations();
    const allMigrations = getAllMigrations();
    
    logger.info('迁移状态:');
    
    for (const migration of allMigrations) {
      const status = appliedMigrations.includes(migration) ? '已应用' : '未应用';
      logger.info(`${migration}: ${status}`);
    }
  } catch (error) {
    logger.error('获取迁移状态失败:', error);
    throw error;
  }
}

module.exports = {
  migrateUp,
  migrateDown,
  migrateReset,
  migrateRefresh,
  migrateStatus
};