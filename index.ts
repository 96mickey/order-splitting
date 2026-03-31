import { port, env } from './config/vars';
import { connectRedis, disconnectRedis } from './config/redis';
import { logger } from './config/logger';

let shuttingDown = false;

const initializeConnections = async (): Promise<void> => {
  await connectRedis();
};

export const startServer = async (): Promise<void> => {
  await initializeConnections();
  const app = (await import('./config/express')).default;
  const server = app.listen(port, () => {
    logger.info(`Server listening on port ${port} [${env}]`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      try {
        await disconnectRedis();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Shutdown failure', { error });
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((error) => {
      logger.error('SIGTERM shutdown failure', { error });
    });
  });

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((error) => {
      logger.error('SIGINT shutdown failure', { error });
    });
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
