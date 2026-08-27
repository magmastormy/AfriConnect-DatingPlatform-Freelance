import { createApp } from './app';
import { config } from './config';
import { prisma } from './config/prisma';
import { logger } from '@africonnect/shared';
import { RealtimeHub, setRealtimeHub } from './modules/chat';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'AfriConnect API listening');
});

// ─── Load-balancer-friendly socket timeouts ────────────────────────────────
// Render/Fly's edge LB closes idle keep-alive sockets at ~60s. If Node's
// keepAliveTimeout is SHORTER than that, the server tears down a socket the LB
// still considers open, and the next request on it arrives to a half-closed
// connection → intermittent 502/ECONNRESET under load. Keep Node's idle
// timeout a touch ABOVE the LB's so the LB always wins the race and closes
// cleanly. headersTimeout must exceed keepAliveTimeout so a slow headers-only
// request can't be killed mid-flight.
server.keepAliveTimeout = 65000; // 5s above a typical 60s LB idle timeout
server.headersTimeout = 66000; // 1s above keepAliveTimeout

// Realtime chat hub shares the HTTP server via the upgrade handshake.
setRealtimeHub(new RealtimeHub(server));

let shuttingDown = false;

/**
 * Graceful shutdown. Must never reject: it is invoked from signal handlers
 * where an unhandled rejection would terminate the process with a non-zero
 * exit code, which an orchestrator reads as a crash rather than a clean stop.
 */
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn({ signal }, 'Shutting down');

  // Hard deadline so a keep-alive socket that refuses to drain cannot hang the
  // container past the orchestrator's kill timeout.
  const deadline = setTimeout(() => process.exit(1), 5000);
  deadline.unref();

  try {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  } catch (err) {
    logger.error({ err, signal }, 'Error during shutdown');
  } finally {
    clearTimeout(deadline);
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Last-resort observability: without these, a stray rejection or throw kills the
// process with a raw stack on stderr and never reaches the structured logger.
// Both still exit non-zero so the platform restarts a process of unknown state.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection — exiting');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
