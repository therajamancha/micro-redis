import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes/index.js';
import requestLogger from './middleware/requestLogger.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security and standard middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP Request logging
app.use(requestLogger());

// Mount API routes under /api
app.use('/api', routes);

// Top-level root health check redirect/alias
app.get('/health', (req, res) => res.redirect('/api/cache/health'));

// 404 and Error handling middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
