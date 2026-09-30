import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { getRedisClient, disconnectRedis } from '../src/config/redis.js';

describe('Micro-Redis Cache Microservice Integration Tests', () => {
  let redisClient;

  before(async () => {
    redisClient = getRedisClient();
  });

  after(async () => {
    try {
      // Clean up test keys
      const keys = await redisClient.keys('test:*');
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch {
      // Ignore if Redis wasn't connected
    }
    await disconnectRedis();
  });

  test('GET /api/cache/health - Should return health status', async () => {
    const res = await request(app).get('/api/cache/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, 'healthy');
    assert.ok(typeof res.body.data.latencyMs === 'number');
  });

  test('POST /api/cache - Should store string key with TTL', async () => {
    const payload = {
      key: 'test:string:user:101',
      value: { id: 101, name: 'Alice Smith', role: 'engineer' },
      ttl: 300,
      type: 'string',
    };

    const res = await request(app).post('/api/cache').send(payload);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.key, payload.key);
    assert.strictEqual(res.body.data.type, 'string');
    assert.strictEqual(res.body.data.ttl, 300);
  });

  test('GET /api/cache/:key - Should retrieve stored string object and parse JSON', async () => {
    const key = 'test:string:user:101';
    const res = await request(app).get(`/api/cache/${encodeURIComponent(key)}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.key, key);
    assert.strictEqual(res.body.data.type, 'string');
    assert.deepStrictEqual(res.body.data.value, { id: 101, name: 'Alice Smith', role: 'engineer' });
    assert.ok(res.body.data.ttl > 0);
  });

  test('POST /api/cache - Should store hash object structure', async () => {
    const payload = {
      key: 'test:hash:session:abc',
      value: {
        userId: '101',
        token: 'xyz-999',
        active: 'true',
      },
      ttl: 600,
      type: 'hash',
    };

    const res = await request(app).post('/api/cache').send(payload);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.key, payload.key);
    assert.strictEqual(res.body.data.type, 'hash');
  });

  test('GET /api/cache/:key - Should retrieve hash structure correctly', async () => {
    const key = 'test:hash:session:abc';
    const res = await request(app).get(`/api/cache/${encodeURIComponent(key)}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.type, 'hash');
    assert.strictEqual(res.body.data.value.userId, '101');
    assert.strictEqual(res.body.data.value.token, 'xyz-999');
  });

  test('POST /api/cache/increment - Should atomically increment counter', async () => {
    const key = 'test:counter:ratelimit:ip123';

    // First increment by 1
    const res1 = await request(app).post('/api/cache/increment').send({ key, amount: 1, ttl: 60 });
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.data.value, 1);

    // Second increment by 5
    const res2 = await request(app).post('/api/cache/increment').send({ key, amount: 5 });
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.data.value, 6);
  });

  test('POST & GET List Operations - Push, Range, and Pop', async () => {
    const key = 'test:list:jobs';

    // Push items to queue
    const pushRes = await request(app)
      .post('/api/cache/list/push')
      .send({ key, values: [{ task: 'email' }, { task: 'sms' }] });
    assert.strictEqual(pushRes.status, 201);
    assert.strictEqual(pushRes.body.data.length, 2);

    // Get range
    const rangeRes = await request(app).get(`/api/cache/list/${encodeURIComponent(key)}`);
    assert.strictEqual(rangeRes.status, 200);
    assert.strictEqual(rangeRes.body.data.items.length, 2);
    assert.deepStrictEqual(rangeRes.body.data.items[0], { task: 'email' });

    // Pop item
    const popRes = await request(app).post('/api/cache/list/pop').send({ key, direction: 'left' });
    assert.strictEqual(popRes.status, 200);
    assert.deepStrictEqual(popRes.body.data.item, { task: 'email' });
  });

  test('POST & GET Set Operations - Add and Members', async () => {
    const key = 'test:set:tags';

    const addRes = await request(app).post('/api/cache/set/add').send({ key, members: ['nodejs', 'redis', 'express'] });
    assert.strictEqual(addRes.status, 201);

    const membersRes = await request(app).get(`/api/cache/set/${encodeURIComponent(key)}`);
    assert.strictEqual(membersRes.status, 200);
    assert.strictEqual(membersRes.body.data.count, 3);
    assert.ok(membersRes.body.data.members.includes('redis'));

    // Check membership
    const checkRes = await request(app).post('/api/cache/set/ismember').send({ key, member: 'redis' });
    assert.strictEqual(checkRes.status, 200);
    assert.strictEqual(checkRes.body.data.isMember, true);
  });

  test('POST & GET Sorted Set Operations - Leaderboard', async () => {
    const key = 'test:zset:leaderboard';

    const addRes = await request(app)
      .post('/api/cache/zset/add')
      .send({
        key,
        entries: [
          { member: 'player1', score: 100 },
          { member: 'player2', score: 250 },
          { member: 'player3', score: 180 },
        ],
      });
    assert.strictEqual(addRes.status, 201);

    // Get ordered descending
    const rangeRes = await request(app).get(`/api/cache/zset/${encodeURIComponent(key)}?reverse=true`);
    assert.strictEqual(rangeRes.status, 200);
    assert.strictEqual(rangeRes.body.data.items[0].member, 'player2');
    assert.strictEqual(rangeRes.body.data.items[0].score, 250);
  });

  test('POST & GET Stream Operations - Event Logging', async () => {
    const key = 'test:stream:events';

    const addRes = await request(app)
      .post('/api/cache/stream/add')
      .send({ key, data: { event: 'USER_LOGIN', userId: '101' } });
    assert.strictEqual(addRes.status, 201);
    assert.ok(addRes.body.data.id);

    const readRes = await request(app).get(`/api/cache/stream/${encodeURIComponent(key)}`);
    assert.strictEqual(readRes.status, 200);
    assert.ok(readRes.body.data.entries.length >= 1);
    assert.strictEqual(readRes.body.data.entries[0].data.event, 'USER_LOGIN');
  });

  test('DELETE /api/cache/:key - Should delete an existing key', async () => {
    const key = 'test:string:user:101';
    const res = await request(app).delete(`/api/cache/${encodeURIComponent(key)}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.deleted, true);

    // Verify key no longer exists
    const checkRes = await request(app).get(`/api/cache/${encodeURIComponent(key)}`);
    assert.strictEqual(checkRes.status, 404);
    assert.strictEqual(checkRes.body.error.code, 'KEY_NOT_FOUND');
  });

  test('POST /api/cache/purge - Should purge keys matching pattern', async () => {
    // Create multiple keys to purge
    await request(app).post('/api/cache').send({ key: 'test:purge:one', value: '1' });
    await request(app).post('/api/cache').send({ key: 'test:purge:two', value: '2' });
    await request(app).post('/api/cache').send({ key: 'test:purge:three', value: '3' });

    const purgeRes = await request(app).post('/api/cache/purge').send({ pattern: 'test:purge:*' });
    assert.strictEqual(purgeRes.status, 200);
    assert.ok(purgeRes.body.data.purgedCount >= 3);

    // Verify one of them is gone
    const checkRes = await request(app).get('/api/cache/test:purge:one');
    assert.strictEqual(checkRes.status, 404);
  });

  test('GET /api/cache/metrics - Should return application and Redis metrics', async () => {
    const res = await request(app).get('/api/cache/metrics');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.application);
    assert.ok(res.body.data.application.hits > 0);
    assert.ok(typeof res.body.data.application.hitRatioPercentage === 'number');
    assert.ok(res.body.data.redis);
  });

  test('POST /api/cache - Validation error on missing required fields', async () => {
    const res = await request(app).post('/api/cache').send({});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });
});
