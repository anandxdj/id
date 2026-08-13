import 'dotenv/config';
import type { Server } from 'node:http';
import { createApp } from './src/app';
import { connectDB, disconnectDB } from './src/common/config/db';
import { getRedis, disconnectRedis } from './src/common/config/redis';
import { IndexSync } from './src/common/config/indexSync';
import { Config } from './src/common/config/config';
import { Logger } from './src/common/logger/index.logger';
import { initOidcKeys } from './src/common/utils/keys.utils';
import { PasswordService } from './src/modules/auth/password.service';

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

  /*
   * Redis is a cache-and-counter tier now (plan §3, D1) — it backs the shared rate-limit
   * counters and nothing authoritative. Connect eagerly so the first request does not pay
   * for the handshake, but never fatally: rate limiting fails open by design, so a Redis
   * that is down at boot must not stop the identity provider from serving logins.
   */
  try {
    await getRedis().ping();
    Logger.info('Redis ping OK — rate-limit counters are shared across replicas');
  } catch (error) {
    Logger.error(
      'Redis unreachable at boot — rate limiting will pass requests UNLIMITED until it recovers',
      { error },
    );
  }

  await initOidcKeys();
  Logger.info('OIDC signing keys ready', { issuer: Config.oidc.issuer, kid: Config.oidc.keyId });

  /*
   * Load the Argon2 binding, publish the cost actually in force, and measure it — so a
   * mistuned deployment is visible in the boot log rather than in next week's p99, and the
   * first real login does not pay for the module load. Also warns when
   * UV_THREADPOOL_SIZE is left at libuv's default of four, which the hashing shares with
   * DNS and filesystem work.
   */
  await PasswordService.warmup();

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
