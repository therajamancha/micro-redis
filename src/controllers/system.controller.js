import { checkRedisHealth } from '../config/redis.js';
import { getMetrics as fetchMetrics } from '../services/metrics.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getHealth = async (req, res) => {
  const health = await checkRedisHealth();

  if (health.status === 'unhealthy') {
    return res.status(503).json({
      success: false,
      message: 'Redis connection is unhealthy',
      data: health,
    });
  }

  return successResponse(res, health, 'Service and Redis are healthy', 200);
};

export const getMetrics = async (req, res, next) => {
  try {
    const metrics = await fetchMetrics();
    return successResponse(res, metrics, 'Metrics retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export default {
  getHealth,
  getMetrics,
};
