import Redis from 'ioredis';
import config from './env.js';
import logger from '../utils/logger.js';

let redisClient = null;
let isConnected = false;
let lastError = null;

const createRedisOptions = () => {
  const commonOptions = {
    db: config.redis.db,
    password: config.redis.password,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    connectTimeout: config.redis.connectTimeout,
    keepAlive: 10000,
    lazyConnect: false,

    retryStrategy(times) {
      const delay = Math.min(times * 150, 3000);
      logger.warn(`[Redis] Connection retry attempt #${times}, waiting ${delay}ms before reconnecting...`);
      return delay;
    },

    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Only reconnect when the error starts with "READONLY" (e.g. during Redis Sentinel failover)
        logger.warn('[Redis] Detected READONLY replica error. Triggering immediate reconnection to discover new master...');
        return 2; // 2 forces a reconnect and resends the command
      }
      return false;
    },
  };

  if (config.redis.mode === 'sentinel') {
    logger.info(`[Redis] Initializing in SENTINEL mode with master [${config.redis.sentinelMasterName}] and nodes:`, config.redis.sentinelNodes);
    return {
      ...commonOptions,
      sentinels: config.redis.sentinelNodes,
      name: config.redis.sentinelMasterName,
      role: 'master',
      sentinelPassword: config.redis.sentinelPassword,
      sentinelRetryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        logger.warn(`[Redis-Sentinel] Sentinel connection retry #${times} in ${delay}ms`);
        return delay;
      },
    };
  }

  logger.info(`[Redis] Initializing in STANDALONE mode connecting to ${config.redis.host}:${config.redis.port}`);
  return {
    ...commonOptions,
    host: config.redis.host,
    port: config.redis.port,
  };
};

export const getRedisClient = () => {
  if (redisClient) {
    return redisClient;
  }

  const options = createRedisOptions();
  redisClient = new Redis(options);

  redisClient.on('connect', () => {
    logger.info(`[Redis] Socket connected successfully (${config.redis.mode} mode)`);
  });

  redisClient.on('ready', () => {
    isConnected = true;
    lastError = null;
    logger.info('[Redis] Client is READY to process commands');
  });

  redisClient.on('error', (err) => {
    isConnected = false;
    lastError = err.message;
    logger.error('[Redis] Client error:', err.message);
  });

  redisClient.on('close', () => {
    isConnected = false;
    logger.warn('[Redis] Connection closed');
  });

  redisClient.on('reconnecting', (delay) => {
    isConnected = false;
    logger.info(`[Redis] Reconnecting in ${delay}ms...`);
  });

  redisClient.on('end', () => {
    isConnected = false;
    logger.warn('[Redis] Connection permanently ended');
  });

  return redisClient;
};

export const isRedisConnected = () => isConnected;

export const checkRedisHealth = async () => {
  const client = getRedisClient();
  const startTime = Date.now();

  try {
    const pingResponse = await client.ping();
    const latencyMs = Date.now() - startTime;

    let role = 'unknown';
    let redisVersion = 'unknown';
    let uptimeSeconds = 0;
    let usedMemory = 'unknown';

    try {
      const replicationInfo = await client.info('replication');
      const roleMatch = replicationInfo.match(/role:(master|slave)/);
      if (roleMatch) role = roleMatch[1];

      const serverInfo = await client.info('server');
      const versionMatch = serverInfo.match(/redis_version:([^\r\n]+)/);
      if (versionMatch) redisVersion = versionMatch[1];

      const uptimeMatch = serverInfo.match(/uptime_in_seconds:([^\r\n]+)/);
      if (uptimeMatch) uptimeSeconds = parseInt(uptimeMatch[1], 10);

      const memoryInfo = await client.info('memory');
      const memMatch = memoryInfo.match(/used_memory_human:([^\r\n]+)/);
      if (memMatch) usedMemory = memMatch[1];
    } catch (infoErr) {
      logger.warn('[Redis] Failed to query full INFO during health check:', infoErr.message);
    }

    return {
      status: pingResponse === 'PONG' ? 'healthy' : 'degraded',
      mode: config.redis.mode,
      latencyMs,
      role,
      redisVersion,
      uptimeSeconds,
      usedMemory,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      mode: config.redis.mode,
      latencyMs: Date.now() - startTime,
      error: err.message,
      lastError,
      timestamp: new Date().toISOString(),
    };
  }
};

export const disconnectRedis = async () => {
  if (redisClient) {
    try {
      logger.info('[Redis] Gracefully quitting Redis connection...');
      await redisClient.quit();
    } catch (err) {
      logger.warn('[Redis] Forcing client disconnect due to error:', err.message);
      redisClient.disconnect();
    } finally {
      redisClient = null;
      isConnected = false;
    }
  }
};

export default {
  getRedisClient,
  isRedisConnected,
  checkRedisHealth,
  disconnectRedis,
};
