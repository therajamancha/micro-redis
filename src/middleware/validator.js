import { z } from 'zod';
import { errorResponse } from '../utils/response.js';

export const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      const details = err.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      return errorResponse(res, 'Request validation failed', 400, 'VALIDATION_ERROR', details);
    }
    next(err);
  }
};

export const setCacheSchema = z.object({
  key: z.string().min(1, 'Key is required and cannot be empty'),
  value: z.any().refine((val) => val !== undefined, { message: 'Value is required' }),
  ttl: z.number().int().min(0, 'TTL must be a non-negative integer').optional(),
  type: z.enum(['string', 'hash', 'list', 'set', 'zset', 'stream']).optional().default('string'),
});

export const purgeCacheSchema = z.object({
  pattern: z.string().min(1).optional().default('*'),
});

export const incrementCacheSchema = z.object({
  key: z.string().min(1, 'Key is required and cannot be empty'),
  amount: z.number().optional().default(1),
  ttl: z.number().int().positive('TTL must be a positive integer').optional(),
});

export const listPushSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  values: z.any().refine((val) => val !== undefined, { message: 'Values is required' }),
  direction: z.enum(['left', 'right']).optional().default('right'),
  ttl: z.number().int().positive().optional(),
});

export const listPopSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  direction: z.enum(['left', 'right']).optional().default('left'),
  count: z.number().int().positive().optional().default(1),
});

export const setAddSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  members: z.any().refine((val) => val !== undefined, { message: 'Members is required' }),
  ttl: z.number().int().positive().optional(),
});

export const zsetAddSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  entries: z.any().refine((val) => val !== undefined, { message: 'Entries is required' }),
  ttl: z.number().int().positive().optional(),
});

export const streamAddSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  data: z.record(z.string(), z.any()),
  id: z.string().optional().default('*'),
  maxLen: z.number().int().positive().optional(),
  ttl: z.number().int().positive().optional(),
});

export default {
  validateBody,
  setCacheSchema,
  purgeCacheSchema,
  incrementCacheSchema,
  listPushSchema,
  listPopSchema,
  setAddSchema,
  zsetAddSchema,
  streamAddSchema,
};
