import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'reflect-metadata';
import callRoutes from './routes/call.routes';
import { requestLogger, errorHandler, rateLimiter } from './middleware';
import { logger } from './utils/logger';

export const createApp = () => {
  const app = express();

  // Security middleware
  app.use(helmet());
  
  // CORS configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Rate limiting
  app.use(rateLimiter(100, 60000)); // 100 requests per minute

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // API routes
  app.use('/api/v1', callRoutes);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: 'Endpoint not found'
    });
  });

  // Error handling middleware
  app.use(errorHandler);

  return app;
};