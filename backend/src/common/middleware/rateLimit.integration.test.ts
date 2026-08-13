/**
 * Rate limiting is Redis-backed and must fail open.
 *
 * Two properties are worth a test because getting either wrong is a security or
 * availability incident rather than a bug:
 *
 *  1. counters actually land in Redis, under an `id:`-namespaced key — an in-process
 *     store silently multiplies every client's budget by the replica count, and an
 *     un-prefixed key collides with whatever else shares the instance;
 *  2. an unreachable Redis lets requests through. Failing closed here would turn a cache
 *     blip into "nobody can sign in".
 *
 * Ordered: the first test needs Redis, the second deliberately points at a dead port.
 * `node --test` gives each file its own process, so mutating the environment is contained.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { IntegrationGate } from '../testing/index.testing';
import { REDIS_KEYS, RATE_LIMIT_SCOPES } from '../constants/index.constants';

process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.MONGO_DB_NAME ??= 'id_test';

const REAL_REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
/** A port nothing is listening on, so every command fails fast. */
const DEAD_REDIS_URL = 'redis://127.0.0.1:6399';

let server: Server | undefined;
let base = '';
let available = false;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('probe timeout')), ms))]);

const listen = async (): Promise<void> => {
  const { createApp } = await import('../../app');
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server!.address();
      base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
      resolve();
    });
  });
};

before(async () => {
  try {
    const { getRedis } = await import('../config/redis');
    await withTimeout(getRedis().ping(), 2000);
    await listen();
    available = true;
  } catch (cause) {
    available = false;
    try {
      const { disconnectRedis } = await import('../config/redis');
      await disconnectRedis();
    } catch {
      /* ignore */
    }
    IntegrationGate.reportUnavailable('rateLimit.integration', cause);
  }
});

after(async () => {
  server?.close();
  const { disconnectRedis } = await import('../config/redis');
  await disconnectRedis();
  process.env.REDIS_URL = REAL_REDIS_URL;
});

test('counters live in Redis under an id-namespaced key', async (t) => {
  if (!available) return t.skip('Redis not reachable');
  const { getRedis } = await import('../config/redis');
  const redis = getRedis();
  const pattern = `${REDIS_KEYS.RATE_LIMIT}${RATE_LIMIT_SCOPES.API}:*`;

  const existing = await redis.keys(pattern);
  if (existing.length) await redis.del(...existing);

  // Any /api request passes through apiLimiter; 401 is fine, it was still counted.
  await fetch(`${base}/api/me/profile`);

  const keys = await redis.keys(pattern);
  assert.ok(keys.length > 0, 'the hit was recorded in Redis, not in process memory');
  assert.ok(
    keys.every((key) => key.startsWith(REDIS_KEYS.NAMESPACE)),
    'every key is namespaced, because the instance may be shared',
  );
  assert.ok(Number(await redis.get(keys[0]!)) >= 1, 'the counter incremented');

  await redis.del(...keys);
});

test('an unreachable Redis fails open rather than locking everyone out', async (t) => {
  if (!available) return t.skip('Redis not reachable');
  const { disconnectRedis } = await import('../config/redis');
  const { Config } = await import('../config/config');

  // Repoint the client at a closed port and force the next command to use it.
  await disconnectRedis();
  process.env.REDIS_URL = DEAD_REDIS_URL;
  Config.reload();
  assert.equal(Config.redis.url, DEAD_REDIS_URL);

  // The store cannot be read, so the limiter must let the request proceed. 404 is the
  // route's own answer; what matters is that it is not a 429 or a 500 from the store.
  const res = await fetch(`${base}/api/no-such-route`);
  assert.equal(res.status, 404, 'the request was served despite the store being down');

  await disconnectRedis();
  process.env.REDIS_URL = REAL_REDIS_URL;
  Config.reload();
});
