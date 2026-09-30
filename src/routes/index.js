import { Router } from 'express';
import cacheRoutes from './cache.routes.js';
import systemController from '../controllers/system.controller.js';

const router = Router();

// Mount cache routes under /api/cache
router.use('/cache', cacheRoutes);

// Convenience root API health check
router.get('/health', systemController.getHealth);

// Root API information endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'micro-redis-cache-service',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/cache/health',
      metrics: 'GET /api/cache/metrics',
      get: 'GET /api/cache/{key}',
      set: 'POST /api/cache',
      delete: 'DELETE /api/cache/{key}',
      purge: 'POST /api/cache/purge',
      increment: 'POST /api/cache/increment',
      lists: 'POST /api/cache/list/push, POST /api/cache/list/pop, GET /api/cache/list/{key}',
      sets: 'POST /api/cache/set/add, GET /api/cache/set/{key}, POST /api/cache/set/ismember',
      sortedSets: 'POST /api/cache/zset/add, GET /api/cache/zset/{key}',
      streams: 'POST /api/cache/stream/add, GET /api/cache/stream/{key}',
    },
  });
});

export default router;
