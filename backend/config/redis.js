const redis = require('redis');
const logger = require('../utils/logger');

let client = null;

const connectRedis = async () => {
  try {
    const redisURL = process.env.REDIS_URL || 'redis://localhost:6379';
    
    client = redis.createClient({
      url: redisURL,
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
          logger.error('Redis max retry attempts reached');
          return undefined;
        }
        // Retry after 3 seconds
        return Math.min(options.attempt * 100, 3000);
      }
    });

    client.on('connect', () => {
      logger.info('Redis client connected');
    });

    client.on('ready', () => {
      logger.info('Redis client ready');
    });

    client.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    client.on('end', () => {
      logger.warn('Redis client disconnected');
    });

    client.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });

    await client.connect();

    // Test connection
    await client.ping();
    logger.info('Redis connection successful');

    return client;
  } catch (error) {
    logger.error('Error connecting to Redis:', error);
    throw error;
  }
};

const getClient = () => {
  if (!client) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return client;
};

// Redis utility functions
const redisUtils = {
  // Set key with expiration
  async setex(key, ttl, value) {
    const client = getClient();
    return await client.setEx(key, ttl, JSON.stringify(value));
  },

  // Get key
  async get(key) {
    const client = getClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  },

  // Delete key
  async del(key) {
    const client = getClient();
    return await client.del(key);
  },

  // Check if key exists
  async exists(key) {
    const client = getClient();
    return await client.exists(key);
  },

  // Set hash field
  async hset(key, field, value) {
    const client = getClient();
    return await client.hSet(key, field, JSON.stringify(value));
  },

  // Get hash field
  async hget(key, field) {
    const client = getClient();
    const value = await client.hGet(key, field);
    return value ? JSON.parse(value) : null;
  },

  // Get all hash fields
  async hgetall(key) {
    const client = getClient();
    const hash = await client.hGetAll(key);
    const result = {};
    for (const [field, value] of Object.entries(hash)) {
      result[field] = JSON.parse(value);
    }
    return result;
  },

  // Add to sorted set
  async zadd(key, score, member) {
    const client = getClient();
    return await client.zAdd(key, { score, value: member });
  },

  // Get range from sorted set
  async zrange(key, start, stop) {
    const client = getClient();
    return await client.zRange(key, start, stop);
  },

  // Publish message
  async publish(channel, message) {
    const client = getClient();
    return await client.publish(channel, JSON.stringify(message));
  },

  // Subscribe to channel
  async subscribe(channel, callback) {
    const subscriber = redis.createClient({ url: process.env.REDIS_URL });
    await subscriber.connect();
    
    subscriber.subscribe(channel, (message) => {
      callback(JSON.parse(message));
    });
    
    return subscriber;
  },

  // Increment counter
  async incr(key) {
    const client = getClient();
    return await client.incr(key);
  },

  // Increment counter by value
  async incrby(key, increment) {
    const client = getClient();
    return await client.incrBy(key, increment);
  },

  // Set multiple keys
  async mset(keyValuePairs) {
    const client = getClient();
    const serializedPairs = [];
    for (let i = 0; i < keyValuePairs.length; i += 2) {
      serializedPairs.push(keyValuePairs[i]);
      serializedPairs.push(JSON.stringify(keyValuePairs[i + 1]));
    }
    return await client.mSet(serializedPairs);
  },

  // Get multiple keys
  async mget(keys) {
    const client = getClient();
    const values = await client.mGet(keys);
    return values.map(value => value ? JSON.parse(value) : null);
  }
};

module.exports = {
  connectRedis,
  getClient,
  redisUtils
};
