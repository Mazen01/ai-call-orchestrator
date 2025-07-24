import dotenv from 'dotenv';
import { createApp } from './app';
import { AppDataSource } from './config/database';
import { CallService } from './services/call.service';
import { logger } from './utils/logger';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

async function bootstrap() {
  try {
    // Initialize database connection
    logger.info('Connecting to database...');
    await AppDataSource.initialize();
    logger.info('Database connected successfully');

    // Create Express app
    const app = createApp();
    const server = createServer(app);

    // Start the server
    server.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`, {
        environment: NODE_ENV,
        port: PORT
      });
    });

    // Start the call processing worker
    logger.info('Starting call processing worker...');
    const callService = new CallService();
    
    // Run the queue processor in the background
    callService.processCallQueue().catch(error => {
      logger.error('Call queue processor crashed', { error: error.message });
      process.exit(1);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      server.close(async () => {
        try {
          await AppDataSource.destroy();
          logger.info('Database connection closed');
          process.exit(0);
        } catch (error: any) {
          logger.error('Error during shutdown', { error: error.message });
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error: any) {
    logger.error('Failed to start application', { error: error.message });
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

bootstrap();