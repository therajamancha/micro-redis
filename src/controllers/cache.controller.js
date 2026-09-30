import cacheService from '../services/cache.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getCache = async (req, res, next) => {
  try {
    const { key } = req.params;
    const result = await cacheService.getCacheByKey(key);

    if (!result) {
      return errorResponse(res, `Cache key '${key}' not found`, 404, 'KEY_NOT_FOUND');
    }

    return successResponse(res, result, 'Cache retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const setCache = async (req, res, next) => {
  try {
    const { key, value, ttl, type } = req.body;
    const result = await cacheService.setCache({ key, value, ttl, type });

    return successResponse(res, result, 'Cache set successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const deleteCache = async (req, res, next) => {
  try {
    const { key } = req.params;
    const result = await cacheService.deleteCacheByKey(key);

    return successResponse(
      res,
      result,
      result.deleted ? `Cache key '${key}' deleted successfully` : `Cache key '${key}' did not exist`
    );
  } catch (err) {
    next(err);
  }
};

export const purgeCache = async (req, res, next) => {
  try {
    const { pattern } = req.body;
    const result = await cacheService.purgeCacheByPattern(pattern);

    return successResponse(res, result, `Cache purged successfully for pattern '${result.pattern}'`);
  } catch (err) {
    next(err);
  }
};

export const incrementCache = async (req, res, next) => {
  try {
    const { key, amount, ttl } = req.body;
    const result = await cacheService.incrementCacheKey({ key, amount, ttl });

    return successResponse(res, result, `Cache key '${key}' incremented successfully`);
  } catch (err) {
    next(err);
  }
};

export default {
  getCache,
  setCache,
  deleteCache,
  purgeCache,
  incrementCache,
};
