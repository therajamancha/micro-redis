import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';

const appStartTime = Date.now();

const internalMetrics = {
  totalRequests: 0,
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  purges: 0,
  increments: 0,
};

export const recordHit = () => {
  internalMetrics.hits += 1;
  internalMetrics.totalRequests += 1;
};

export const recordMiss = () => {
  internalMetrics.misses += 1;
  internalMetrics.totalRequests += 1;
};

export const recordSet = () => {
  internalMetrics.sets += 1;
  internalMetrics.totalRequests += 1;
};

export const recordDelete = () => {
  internalMetrics.deletes += 1;
  internalMetrics.totalRequests += 1;
};

export const recordPurge = () => {
  internalMetrics.purges += 1;
  internalMetrics.totalRequests += 1;
};

export const recordIncrement = () => {
  internalMetrics.increments += 1;
  internalMetrics.totalRequests += 1;
};

const parseInfoSection = (infoString) => {
  const lines = infoString.split('\r\n');
  const result = {};

  for (const line of lines) {
    if (line && !line.startsWith('#') && line.includes(':')) {
      const [key, ...values] = line.split(':');
      result[key.trim()] = values.join(':').trim();
    }
  }

  return result;
};

export const getMetrics = async () => {
  const client = getRedisClient();
  const uptimeSeconds = Math.floor((Date.now() - appStartTime) / 1000);

  const totalReads = internalMetrics.hits + internalMetrics.misses;
  const hitRatio = totalReads > 0 ? Number(((internalMetrics.hits / totalReads) * 100).toFixed(2)) : 0;

  let redisMetrics = {};

  try {
    const rawInfo = await client.info();
    const parsed = parseInfoSection(rawInfo);

    const redisHits = parseInt(parsed.keyspace_hits || '0', 10);
    const redisMisses = parseInt(parsed.keyspace_misses || '0', 10);
    const redisTotalReads = redisHits + redisMisses;
    const redisHitRatio = redisTotalReads > 0 ? Number(((redisHits / redisTotalReads) * 100).toFixed(2)) : 0;

    redisMetrics = {
      version: parsed.redis_version || 'unknown',
      role: parsed.role || 'unknown',
      uptimeSeconds: parseInt(parsed.uptime_in_seconds || '0', 10),
      connectedClients: parseInt(parsed.connected_clients || '0', 10),
      blockedClients: parseInt(parsed.blocked_clients || '0', 10),
      usedMemory: parsed.used_memory_human || 'unknown',
      usedMemoryPeak: parsed.used_memory_peak_human || 'unknown',
      memoryFragmentationRatio: parseFloat(parsed.mem_fragmentation_ratio || '0'),
      totalCommandsProcessed: parseInt(parsed.total_commands_processed || '0', 10),
      opsPerSec: parseInt(parsed.instantaneous_ops_per_sec || '0', 10),
      keyspaceHits: redisHits,
      keyspaceMisses: redisMisses,
      keyspaceHitRatioPercentage: redisHitRatio,
    };
  } catch (err) {
    logger.warn('[Metrics] Could not fetch Redis INFO:', err.message);
    redisMetrics = { error: err.message };
  }

  return {
    application: {
      uptimeSeconds,
      ...internalMetrics,
      hitRatioPercentage: hitRatio,
    },
    redis: redisMetrics,
    timestamp: new Date().toISOString(),
  };
};

export default {
  recordHit,
  recordMiss,
  recordSet,
  recordDelete,
  recordPurge,
  recordIncrement,
  getMetrics,
};
