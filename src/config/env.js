import dotenv from 'dotenv';

dotenv.config();

const parseSentinelNodes = (nodesString) => {
  if (!nodesString) return [];
  return nodesString
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, port] = entry.split(':');
      return {
        host: host || '127.0.0.1',
        port: parseInt(port || '26379', 10),
      };
    });
};

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',

  redis: {
    mode: (process.env.REDIS_MODE || 'standalone').toLowerCase(), // 'standalone' | 'sentinel'
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '5', 10),

    // Sentinel options
    sentinelMasterName: process.env.REDIS_SENTINEL_MASTER_NAME || 'mymaster',
    sentinelNodes: parseSentinelNodes(process.env.REDIS_SENTINEL_NODES || '127.0.0.1:26379,127.0.0.1:26380,127.0.0.1:26381'),
    sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD || undefined,
  },

  cache: {
    defaultTtl: parseInt(process.env.DEFAULT_TTL || '3600', 10),
  },
};

export default config;
