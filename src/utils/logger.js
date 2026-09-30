const formatTimestamp = () => new Date().toISOString();

export const logger = {
  info: (message, meta) => {
    console.log(`[${formatTimestamp()}] [INFO] ${message}`, meta !== undefined ? meta : '');
  },
  warn: (message, meta) => {
    console.warn(`[${formatTimestamp()}] [WARN] ${message}`, meta !== undefined ? meta : '');
  },
  error: (message, error) => {
    console.error(`[${formatTimestamp()}] [ERROR] ${message}`, error !== undefined ? error : '');
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${formatTimestamp()}] [DEBUG] ${message}`, meta !== undefined ? meta : '');
    }
  },
};

export default logger;
