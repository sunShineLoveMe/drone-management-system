const redis = require('redis');
const logger = require('../utils/logger');

let client;

const initializeRedis = async () => {
  try {
    client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server connection refused');
          return new Error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis connection attempts exhausted');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    client.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    client.on('connect', () => {
      logger.info('Redis client connected');
    });

    client.on('ready', () => {
      logger.info('Redis client ready');
    });

    await client.connect();
    
    // Test connection
    await client.ping();
    logger.info('Redis connected successfully');
    
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

const getClient = () => {
  if (!client) {
    throw new Error('Redis not initialized');
  }
  return client;
};

// Cache helper functions
const cache = {
  async get(key) {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  },

  async set(key, value, ttl = 3600) {
    try {
      await client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  },

  async del(key) {
    try {
      await client.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  },

  async exists(key) {
    try {
      return await client.exists(key);
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  },

  async flushAll() {
    try {
      await client.flushAll();
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }
};

module.exports = {
  initializeRedis,
  getClient,
  cache
};