import { Router } from 'express';
import cacheController from '../controllers/cache.controller.js';
import systemController from '../controllers/system.controller.js';
import dataStructuresController from '../controllers/dataStructures.controller.js';
import {
  validateBody,
  setCacheSchema,
  purgeCacheSchema,
  incrementCacheSchema,
  listPushSchema,
  listPopSchema,
  setAddSchema,
  zsetAddSchema,
  streamAddSchema,
} from '../middleware/validator.js';

const router = Router();

// ==========================================
// 1. Health & Metrics Endpoints
// ==========================================
// Explicitly placed before parameter routes (:key)
router.get('/health', systemController.getHealth);
router.get('/metrics', systemController.getMetrics);

// ==========================================
// 2. Cache Utility Actions (Purge & Increment)
// ==========================================
router.post('/purge', validateBody(purgeCacheSchema), cacheController.purgeCache);
router.post('/increment', validateBody(incrementCacheSchema), cacheController.incrementCache);

// ==========================================
// 3. Advanced Data Structure Endpoints
// ==========================================
// Lists (Queues / Stacks)
router.post('/list/push', validateBody(listPushSchema), dataStructuresController.pushList);
router.post('/list/pop', validateBody(listPopSchema), dataStructuresController.popList);
router.get('/list/:key', dataStructuresController.getListRange);

// Sets (Tags / Unique collections)
router.post('/set/add', validateBody(setAddSchema), dataStructuresController.addSet);
router.get('/set/:key', dataStructuresController.getSetMembers);
router.post('/set/ismember', dataStructuresController.checkSetMember);
router.post('/set/remove', dataStructuresController.removeSetMembers);

// Sorted Sets (Leaderboards / Ranking)
router.post('/zset/add', validateBody(zsetAddSchema), dataStructuresController.addZSet);
router.get('/zset/:key', dataStructuresController.getZSetRange);
router.get('/zset/:key/score/:member', dataStructuresController.getZSetScore);

// Streams (Event Logging & Queues)
router.post('/stream/add', validateBody(streamAddSchema), dataStructuresController.addStreamEntry);
router.get('/stream/:key', dataStructuresController.readStreamEntries);

// ==========================================
// 4. Primary Key-Value REST Operations
// ==========================================
router.post('/', validateBody(setCacheSchema), cacheController.setCache);
router.get('/:key', cacheController.getCache);
router.delete('/:key', cacheController.deleteCache);

export default router;
