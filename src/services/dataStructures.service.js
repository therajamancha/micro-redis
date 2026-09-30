import { getRedisClient } from '../config/redis.js';

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

// ==========================================
// List Operations (Queues / Stacks / Logs)
// ==========================================
export const listPush = async ({ key, values, direction = 'right', ttl }) => {
  const client = getRedisClient();
  const items = Array.isArray(values) ? values : [values];
  const serialized = items.map((i) => (typeof i === 'object' && i !== null ? JSON.stringify(i) : String(i)));

  const pipeline = client.multi();
  if (direction === 'left') {
    pipeline.lpush(key, ...serialized);
  } else {
    pipeline.rpush(key, ...serialized);
  }

  if (ttl && ttl > 0) {
    pipeline.expire(key, parseInt(ttl, 10));
  }

  const results = await pipeline.exec();
  const newLength = results[0][1];
  return { key, length: newLength };
};

export const listPop = async ({ key, direction = 'left', count = 1 }) => {
  const client = getRedisClient();
  let popped;

  if (count > 1) {
    popped = direction === 'right' ? await client.rpop(key, count) : await client.lpop(key, count);
    return { key, items: Array.isArray(popped) ? popped.map(safeJsonParse) : [] };
  }

  popped = direction === 'right' ? await client.rpop(key) : await client.lpop(key);
  return { key, item: popped !== null ? safeJsonParse(popped) : null };
};

export const listRange = async ({ key, start = 0, stop = -1 }) => {
  const client = getRedisClient();
  const [items, length] = await Promise.all([
    client.lrange(key, parseInt(start, 10), parseInt(stop, 10)),
    client.llen(key),
  ]);

  return {
    key,
    totalLength: length,
    items: items.map(safeJsonParse),
  };
};

// ==========================================
// Set Operations (Tags / Unique Collections)
// ==========================================
export const setAdd = async ({ key, members, ttl }) => {
  const client = getRedisClient();
  const items = Array.isArray(members) ? members : [members];
  const serialized = items.map((i) => (typeof i === 'object' && i !== null ? JSON.stringify(i) : String(i)));

  const pipeline = client.multi();
  pipeline.sadd(key, ...serialized);
  if (ttl && ttl > 0) {
    pipeline.expire(key, parseInt(ttl, 10));
  }

  const results = await pipeline.exec();
  const added = results[0][1];
  return { key, addedCount: added };
};

export const setMembers = async (key) => {
  const client = getRedisClient();
  const members = await client.smembers(key);
  return {
    key,
    count: members.length,
    members: members.map(safeJsonParse),
  };
};

export const setIsMember = async (key, member) => {
  const client = getRedisClient();
  const serialized = typeof member === 'object' && member !== null ? JSON.stringify(member) : String(member);
  const isMember = await client.sismember(key, serialized);
  return { key, member, isMember: isMember === 1 };
};

export const setRemove = async (key, members) => {
  const client = getRedisClient();
  const items = Array.isArray(members) ? members : [members];
  const serialized = items.map((i) => (typeof i === 'object' && i !== null ? JSON.stringify(i) : String(i)));
  const removedCount = await client.srem(key, ...serialized);
  return { key, removedCount };
};

// ==========================================
// Sorted Set Operations (Leaderboards / Ranking)
// ==========================================
export const zsetAdd = async ({ key, entries, ttl }) => {
  const client = getRedisClient();
  const items = Array.isArray(entries) ? entries : [entries];
  const args = [];

  for (const item of items) {
    const score = item.score !== undefined ? item.score : 0;
    const member = item.member !== undefined ? item.member : item.value;
    const serialized = typeof member === 'object' && member !== null ? JSON.stringify(member) : String(member);
    args.push(score, serialized);
  }

  const pipeline = client.multi();
  pipeline.zadd(key, ...args);
  if (ttl && ttl > 0) {
    pipeline.expire(key, parseInt(ttl, 10));
  }

  const results = await pipeline.exec();
  return { key, addedCount: results[0][1] };
};

export const zsetRange = async ({ key, start = 0, stop = -1, reverse = false }) => {
  const client = getRedisClient();
  const raw = reverse
    ? await client.zrevrange(key, parseInt(start, 10), parseInt(stop, 10), 'WITHSCORES')
    : await client.zrange(key, parseInt(start, 10), parseInt(stop, 10), 'WITHSCORES');

  const items = [];
  for (let i = 0; i < raw.length; i += 2) {
    items.push({
      member: safeJsonParse(raw[i]),
      score: parseFloat(raw[i + 1]),
    });
  }

  const totalCount = await client.zcard(key);
  return { key, totalCount, items };
};

export const zsetScore = async (key, member) => {
  const client = getRedisClient();
  const serialized = typeof member === 'object' && member !== null ? JSON.stringify(member) : String(member);
  const score = await client.zscore(key, serialized);
  return { key, member, score: score !== null ? parseFloat(score) : null };
};

// ==========================================
// Stream Operations (Event Logging & Queues)
// ==========================================
export const streamAdd = async ({ key, data, id = '*', maxLen, ttl }) => {
  const client = getRedisClient();
  const args = [];

  if (maxLen && maxLen > 0) {
    args.push('MAXLEN', '~', parseInt(maxLen, 10));
  }

  args.push(id || '*');

  for (const [k, v] of Object.entries(data)) {
    args.push(k, typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
  }

  const entryId = await client.xadd(key, ...args);

  if (ttl && ttl > 0) {
    await client.expire(key, parseInt(ttl, 10));
  }

  return { key, id: entryId, data };
};

export const streamRead = async ({ key, count = 50, lastId = '0-0' }) => {
  const client = getRedisClient();
  const result = await client.xread('COUNT', parseInt(count, 10), 'STREAMS', key, lastId);

  if (!result || result.length === 0) {
    return { key, entries: [] };
  }

  const rawEntries = result[0][1];
  const entries = rawEntries.map(([id, fields]) => {
    const data = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = safeJsonParse(fields[i + 1]);
    }
    return { id, data };
  });

  return { key, count: entries.length, entries };
};

export default {
  listPush,
  listPop,
  listRange,
  setAdd,
  setMembers,
  setIsMember,
  setRemove,
  zsetAdd,
  zsetRange,
  zsetScore,
  streamAdd,
  streamRead,
};
