import Redis from 'ioredis';
import { Config } from './config';
import { Logger } from '../logger/index.logger';
import { REDIS_CACHE } from '../constants/index.constants';

/**
 * Redis, demoted to a cache-and-counter tier (plan §3, D1).
 *
 * Every authoritative keyspace this client used to hold — sessions, authorization
 * codes, pending authorization requests, OIDC access tokens, social-login state — is now
 * a TTL-indexed Mongo collection. What is left is shared rate-limit counters, which
 * genuinely belong here: they must be atomic across replicas, they are worthless once
 * their window closes, and `INCR`/`EXPIRE` is one round trip with no index maintenance.
 *
 * **The rule this file exists to enforce: nothing whose loss is a correctness or safety
 * failure may live here.** Flushing this instance must cost latency and rate-limit
 * accuracy, and nothing else — never a logged-out user, never a forgotten redemption.
 *
 * Client tuning follows from being a cache rather than a store:
 *  - `maxRetriesPerRequest` is small, so a command fails instead of retrying forever;
 *  - reconnection retries forever with capped backoff, so a blip self-heals rather than
 *    permanently disabling rate limiting until someone restarts the process;
 *  - the client is created lazily, so importing this module neither reads configuration
 *    nor opens a socket — a test that never touches Redis must not be left holding the
 *    event loop open.
 */

let client: Redis | undefined;

const create = (): Redis => {
  const instance = new Redis(Config.redis.url, {
    lazyConnect: true,
    maxRetriesPerRequest: REDIS_CACHE.MAX_RETRIES_PER_REQUEST,
    connectTimeout: REDIS_CACHE.CONNECT_TIMEOUT_MS,
    retryStrategy: (attempt) =>
      Math.min(attempt * REDIS_CACHE.RECONNECT_BASE_MS, REDIS_CACHE.RECONNECT_MAX_MS),
  });

  instance.on('error', (error) => Logger.error('Redis error', { error }));
  instance.on('connect', () => Logger.info('Redis connected'));

  return instance;
};

export const getRedis = (): Redis => {
  if (!client) client = create();
  return client;
};

/** Raised when the cache is not usable right now. Callers degrade; they never fail. */
export class RedisUnavailableError extends Error {
  constructor(reason: string) {
    super(`Redis unavailable: ${reason}`);
    this.name = 'RedisUnavailableError';
  }
}

/** ioredis reports `'wait'` for a lazy client that has never connected. */
const STATUS = { WAIT: 'wait', READY: 'ready' } as const;

/**
 * Run one Redis command without ever making the request path wait on the cache.
 *
 * Two distinct hazards, because ioredis handles neither the way a cache tier needs:
 *
 *  1. **A command issued while the socket is down joins the offline queue** and sits
 *     there until a reconnect that may never come — `maxRetriesPerRequest` bounds retries
 *     of an in-flight command, not that wait. So anything other than a ready client is
 *     refused outright: the caller degrades in microseconds instead of stalling, and a
 *     permanently dead Redis costs no latency at all.
 *  2. **A command on a ready client can still hang** (a wedged server, a half-open
 *     socket), so the send is raced against a deadline. The loser's rejection is
 *     swallowed deliberately — an abandoned promise that rejects later would surface as
 *     an `unhandledRejection` and take the process down over a cache miss.
 */
export const redisCommand = async (args: (string | number)[]): Promise<unknown> => {
  const [command, ...rest] = args.map(String);
  if (!command) throw new Error('redisCommand called with no command');

  const instance = getRedis();

  if (instance.status === STATUS.WAIT) {
    // First use of the lazy client: start connecting, but let this call degrade rather
    // than pay for the handshake. Subsequent calls find a ready client.
    try {
      void instance.connect().catch(() => undefined);
    } catch {
      // Already connecting — another request got here first.
    }
  }

  if (instance.status !== STATUS.READY) {
    throw new RedisUnavailableError(`client status is "${instance.status}"`);
  }

  const inFlight = instance.call(command, ...rest);
  inFlight.catch(() => undefined);

  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      inFlight,
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new RedisUnavailableError(`command timed out after ${REDIS_CACHE.COMMAND_TIMEOUT_MS}ms`)),
          REDIS_CACHE.COMMAND_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (!client) return;
  const instance = client;
  client = undefined;

  /*
   * `quit()` drains politely, but on a client that is mid-reconnect it stays pending
   * until a connection it may never get — which would hang a shutdown (or a test run)
   * indefinitely. Bound it, then sever the socket regardless: `disconnect()` also clears
   * the reconnect timer, which is what actually keeps the event loop alive.
   */
  try {
    await Promise.race([
      instance.quit(),
      new Promise((resolve) => setTimeout(resolve, REDIS_CACHE.COMMAND_TIMEOUT_MS)),
    ]);
  } catch {
    // Never connected, or the socket is already gone. Nothing to drain.
  }
  instance.disconnect();
  Logger.info('Redis disconnected cleanly');
};
