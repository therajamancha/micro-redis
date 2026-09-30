import logger from '../utils/logger.js';
import { errorResponse } from '../utils/response.js';

export const notFoundHandler = (req, res) => {
  return errorResponse(res, `Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND');
};

export const errorHandler = (err, req, res, _next) => {
  logger.error(`[Error] Unhandled error during ${req.method} ${req.originalUrl}:`, err.stack || err.message);

  // Redis connection / network issues
  if (err.name === 'MaxRetriesPerRequestError' || err.message?.includes('Connection is closed')) {
    return errorResponse(
      res,
      'Redis service is temporarily unavailable. Please retry in a few moments.',
      503,
      'REDIS_UNAVAILABLE'
    );
  }

  // Syntax or bad input errors
  if (err.name === 'SyntaxError' && 'body' in err) {
    return errorResponse(res, 'Invalid JSON body in request', 400, 'INVALID_JSON');
  }

  // Validation / custom business errors
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  return errorResponse(
    res,
    message,
    statusCode,
    code,
    process.env.NODE_ENV === 'development' ? err.stack : undefined
  );
};

export default {
  notFoundHandler,
  errorHandler,
};
