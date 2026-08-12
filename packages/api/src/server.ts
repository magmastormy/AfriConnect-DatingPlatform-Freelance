import { createApp } from './app';
import { config } from './config';
import { prisma } from './config/prisma';
import { logger } from '@africonnect/shared';
import { RealtimeHub, setRealtimeHub } from './modules/chat';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'AfriConnect API listening');
});

// Realtime chat hub shares the HTTP server via the upgrade handshake.
setRealtimeHub(new RealtimeHub(server));

async function shutdown(signal: string): Promise<void> {
  logger.warn({ signal }, 'Shutting down');
  server.close(() => process.exit(0));
  await prisma.$disconnect();
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
