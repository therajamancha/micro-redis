import morgan from 'morgan';
import config from '../config/env.js';

export const requestLogger = () => {
  if (!config.enableRequestLogging) {
    return (_req, _res, next) => next();
  }

  const format = config.nodeEnv === 'production' ? 'combined' : 'dev';
  return morgan(format);
};

export default requestLogger;
