import app from './app.js';
import config from './config/env.js';
import { getRedisClient, disconnectRedis } from './config/redis.js';
import logger from './utils/logger.js';

// Initialize Redis Client eagerly on startup
const redisClient = getRedisClient();

const server = app.listen(config.port, () => {
  logger.info(`========================================================`);
  logger.info(`🚀 Micro-Redis Cache Service running on port ${config.port}`);
  logger.info(`📡 Environment: ${config.nodeEnv}`);
  logger.info(`🔄 Redis Mode: ${config.redis.mode.toUpperCase()}`);
  if (config.redis.mode === 'sentinel') {
    logger.info(`🛡️  Sentinel Master: ${config.redis.sentinelMasterName}`);
    logger.info(`🔗 Sentinel Nodes:`, config.redis.sentinelNodes);
  } else {
    logger.info(`🎯 Standalone Redis Target: ${config.redis.host}:${config.redis.port}`);
  }
  logger.info(`========================================================`);
});

// Graceful Shutdown handling
const handleGracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed. Releasing Redis connection...');
    await disconnectRedis();
    logger.info('Graceful shutdown completed successfully. Exiting process.');
    process.exit(0);
  });

  // Force shutdown after timeout if pending connections do not drain
  setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception thrown:', err);
  // Optional: In production, trigger restart or graceful exit
});

export default server;
