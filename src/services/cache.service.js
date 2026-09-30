import { getRedisClient } from '../config/redis.js';
import {
  recordHit,
  recordMiss,
  recordSet,
  recordDelete,
  recordPurge,
  recordIncrement,
} from './metrics.service.js';
import logger from '../utils/logger.js';

const safeJsonParse = (val) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return val;
    }
  }
  return val;
};

const formatStreamEntries = (rawEntries) => {
  if (!Array.isArray(rawEntries)) return [];
  return rawEntries.map(([id, fields]) => {
    const data = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = safeJsonParse(fields[i + 1]);
    }
    return { id, data };
  });
};

export const getCacheByKey = async (key) => {
  const client = getRedisClient();
  const keyType = await client.type(key);

  if (keyType === 'none') {
    recordMiss();
    return null;
  }

  let value = null;
  const ttl = await client.ttl(key);

  switch (keyType) {
    case 'string': {
      const raw = await client.get(key);
      value = safeJsonParse(raw);
      break;
    }

    case 'hash': {
      const rawHash = await client.hgetall(key);
      value = {};
      for (const [k, v] of Object.entries(rawHash)) {
        value[k] = safeJsonParse(v);
      }
      break;
    }

    case 'list': {
      const rawList = await client.lrange(key, 0, -1);
      value = rawList.map(safeJsonParse);
      break;
    }

    case 'set': {
      const rawSet = await client.smembers(key);
      value = rawSet.map(safeJsonParse);
      break;
    }

    case 'zset': {
      const rawZSet = await client.zrange(key, 0, -1, 'WITHSCORES');
      value = [];
      for (let i = 0; i < rawZSet.length; i += 2) {
        value.push({
          member: safeJsonParse(rawZSet[i]),
          score: parseFloat(rawZSet[i + 1]),
        });
      }
      break;
    }

    case 'stream': {
      const rawEntries = await client.xrevrange(key, '+', '-', 'COUNT', 50);
      value = formatStreamEntries(rawEntries);
      break;
    }

    default: {
      value = await client.get(key);
      break;
    }
  }

  recordHit();
  return {
    key,
    type: keyType,
    value,
    ttl,
  };
};

export const setCache = async ({ key, value, ttl, type = 'string' }) => {
  const client = getRedisClient();
  const normalizedType = (type || 'string').toLowerCase();

  switch (normalizedType) {
    case 'string': {
      const serializedValue = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
      if (ttl !== undefined && ttl !== null && Number(ttl) > 0) {
        await client.set(key, serializedValue, 'EX', parseInt(ttl, 10));
      } else {
        await client.set(key, serializedValue);
      }
      break;
    }

    case 'hash': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error("Value for 'hash' type must be a key-value object");
      }

      const flatEntries = {};
      for (const [k, v] of Object.entries(value)) {
        flatEntries[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
      }

      const pipeline = client.multi();
      pipeline.hset(key, flatEntries);
      if (ttl !== undefined && ttl !== null && Number(ttl) > 0) {
        pipeline.expire(key, parseInt(ttl, 10));
      }
      await pipeline.exec();
      break;
    }

    case 'list': {
      const items = Array.isArray(value) ? value : [value];
      const serializedItems = items.map((item) =>
        typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)
      );

      const pipeline = client.multi();
      pipeline.rpush(key, ...serializedItems);
      if (ttl !== undefined && ttl !== null && Number(ttl) > 0) {
        pipeline.expire(key, parseInt(ttl, 10));
      }
      await pipeline.exec();
      break;
    }

    case 'set': {
      const items = Array.isArray(value) ? value : [value];
      const serializedItems = items.map((item) =>
        typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)
      );

      const pipeline = client.multi();
      pipeline.sadd(key, ...serializedItems);
      if (ttl !== undefined && ttl !== null && Number(ttl) > 0) {
        pipeline.expire(key, parseInt(ttl, 10));
      }
      await pipeline.exec();
      break;
    }

    case 'zset': {
      if (!Array.isArray(value)) {
        throw new Error("Value for 'zset' must be an array of { score, member } or { score, value }");
      }

      const zaddArgs = [];
      for (const item of value) {
        const score = item.score !== undefined ? item.score : 0;
        const member = item.member !== undefined ? item.member : item.value;
        const serialized = typeof member === 'object' && member !== null ? JSON.stringify(member) : String(member);
        zaddArgs.push(score, serialized);
      }

      if (zaddArgs.length === 0) {
        throw new Error("At least one { score, member } element is required for 'zset'");
      }

      const pipeline = client.multi();
      pipeline.zadd(key, ...zaddArgs);
      if (ttl !== undefined && ttl !== null && Number(ttl) > 0) {
        pipeline.expire(key, parseInt(ttl, 10));
      }
      await pipeline.exec();
      break;
    }

    case 'stream': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error("Value for 'stream' must be an object of field-value pairs");
      }

      const streamArgs = [];
      for (const [k, v] of Object.entries(value)) {
        streamArgs.push(k, typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
      }

      const pipeline = client.multi();
      pipeline.xadd(key, '*', ...streamArgs);
      if (ttl !== undefined && ttl !== null && Number(ttl) > 0) {
        pipeline.expire(key, parseInt(ttl, 10));
      }
      await pipeline.exec();
      break;
    }

    default:
      throw new Error(`Unsupported Redis type '${type}'. Supported: string, hash, list, set, zset, stream`);
  }

  recordSet();

  const finalTtl = ttl ? parseInt(ttl, 10) : -1;
  return {
    key,
    type: normalizedType,
    ttl: finalTtl,
  };
};

export const deleteCacheByKey = async (key) => {
  const client = getRedisClient();
  const count = await client.del(key);
  recordDelete();

  return {
    key,
    deleted: count > 0,
    count,
  };
};

export const purgeCacheByPattern = async (pattern) => {
  const client = getRedisClient();
  const searchPattern = pattern || '*';

  let totalPurged = 0;
  const stream = client.scanStream({
    match: searchPattern,
    count: 100,
  });

  return new Promise((resolve, reject) => {
    stream.on('data', async (keys = []) => {
      if (keys.length > 0) {
        stream.pause();
        try {
          // unlink is non-blocking asynchronous key deallocation in Redis
          const deleted = await client.unlink(...keys);
          totalPurged += deleted;
          stream.resume();
        } catch (err) {
          logger.error('[Purge] Error during unlink batch:', err.message);
          stream.destroy(err);
          reject(err);
        }
      }
    });

    stream.on('end', () => {
      recordPurge();
      logger.info(`[Purge] Successfully purged ${totalPurged} keys matching pattern: '${searchPattern}'`);
      resolve({
        pattern: searchPattern,
        purgedCount: totalPurged,
      });
    });

    stream.on('error', (err) => {
      logger.error('[Purge] Stream error during pattern scan:', err.message);
      reject(err);
    });
  });
};

export const incrementCacheKey = async ({ key, amount = 1, ttl }) => {
  const client = getRedisClient();
  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    throw new Error('Amount must be a valid number');
  }

  const isFloat = !Number.isInteger(numericAmount);
  let newValue;

  if (ttl !== undefined && ttl !== null && Number(ttl) > 0) {
    const pipeline = client.multi();
    if (isFloat) {
      pipeline.incrbyfloat(key, numericAmount);
    } else {
      pipeline.incrby(key, numericAmount);
    }
    // Set expiration only if key does not have an existing expiry or enforce new TTL
    pipeline.expire(key, parseInt(ttl, 10));

    const results = await pipeline.exec();
    const [incrErr, incrResult] = results[0];
    if (incrErr) throw incrErr;

    newValue = isFloat ? parseFloat(incrResult) : parseInt(incrResult, 10);
  } else {
    if (isFloat) {
      const res = await client.incrbyfloat(key, numericAmount);
      newValue = parseFloat(res);
    } else {
      newValue = await client.incrby(key, numericAmount);
    }
  }

  recordIncrement();

  const currentTtl = await client.ttl(key);

  return {
    key,
    value: newValue,
    ttl: currentTtl,
  };
};

export default {
  getCacheByKey,
  setCache,
  deleteCacheByKey,
  purgeCacheByPattern,
  incrementCacheKey,
};
