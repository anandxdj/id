import 'dotenv/config';
import type { Server } from 'node:http';
import { createApp } from './src/app';
import { connectDB, disconnectDB } from './src/common/config/db';
import { getRedis, disconnectRedis } from './src/common/config/redis';
import { IndexSync } from './src/common/config/indexSync';
import { Config } from './src/common/config/config';
import { Logger } from './src/common/logger/index.logger';
import { initOidcKeys } from './src/common/utils/keys.utils';

/** Server-level timeouts. Without these, a slow client can hold a socket indefinitely. */
const KEEP_ALIVE_TIMEOUT_MS = 65_000;
const HEADERS_TIMEOUT_MS = 66_000;
const REQUEST_TIMEOUT_MS = 30_000;

let shuttingDown = false;

/**
 * Drain in-flight work before exiting. Without this, every deploy severs live requests
 * mid-flight — a user's login POST is dropped, and any non-idempotent handler is left
 * half-applied.
 */
const shutdown = async (server: Server, reason: string, exitCode: number): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  Logger.info('Shutdown initiated', { reason, timeoutMs: Config.server.shutdownTimeoutMs });

  // Hard ceiling: if a connection refuses to drain, exit anyway rather than hang forever
  // and get SIGKILLed by the orchestrator with no cleanup at all.
  const forceExit = setTimeout(() => {
    Logger.error('Shutdown timed out — forcing exit', { reason });
    process.exit(exitCode || 1);
  }, Config.server.shutdownTimeoutMs);
  forceExit.unref();

  try {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    Logger.info('HTTP server closed');

    await Promise.allSettled([disconnectDB(), disconnectRedis()]);
  } catch (error) {
    Logger.error('Error during shutdown', { error });
    process.exit(1);
  }

  clearTimeout(forceExit);
  Logger.info('Shutdown complete');
  process.exit(exitCode);
};

async function main(): Promise<void> {
  // Validate the whole environment before touching anything external, so a
  // misconfigured deployment fails in milliseconds with every problem listed at once.
  Config.validate();

  if (Config.server.usingDevSecrets) {
    Logger.warn(
      'JWT secrets are using development fallbacks — set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (openssl rand -hex 32)',
    );
  }

  await connectDB();
  await IndexSync.run();

  // Remove alongside the M1 Redis migration.
  await getRedis().ping();
  Logger.info('Redis ping OK');

  await initOidcKeys();
  Logger.info('OIDC signing keys ready', { issuer: Config.oidc.issuer, kid: Config.oidc.keyId });

  const app = createApp();
  const server = app.listen(Config.server.port, () => {
    Logger.info('Identity provider listening', {
      port: Config.server.port,
      env: Config.server.env,
      issuer: Config.oidc.issuer,
      corsOrigins: Config.web.corsOrigins,
    });
  });

  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
  server.requestTimeout = REQUEST_TIMEOUT_MS;

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      void shutdown(server, signal, 0);
    });
  }

  // An unhandled rejection leaves the process in an unknown state. Log it with a real
  // stack (the logger serialises Error properly) and drain rather than limp on.
  process.on('unhandledRejection', (reason) => {
    Logger.error('Unhandled promise rejection', { error: reason });
    void shutdown(server, 'unhandledRejection', 1);
  });

  process.on('uncaughtException', (error) => {
    Logger.error('Uncaught exception', { error });
    void shutdown(server, 'uncaughtException', 1);
  });
}

main().catch((error) => {
  Logger.error('Startup failed', { error });
  process.exit(1);
});
