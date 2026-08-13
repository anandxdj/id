import rateLimit from 'express-rate-limit';
import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import RedisRateLimitStore from 'rate-limit-redis';
import type { RedisReply } from 'rate-limit-redis';
import { redisCommand, RedisUnavailableError } from '../config/redis';
import { Logger } from '../logger/index.logger';
import {
  ERROR_CODES,
  ERROR_MESSAGES,
  RATE_LIMITS,
  RATE_LIMIT_SCOPES,
  REDIS_KEYS,
} from '../constants/index.constants';

/**
 * Rate limiting, backed by Redis.
 *
 * The default store is per-process memory, which on an authentication API is a real
 * weakness rather than a performance detail: with N replicas every client silently gets
 * N× its budget, and every deploy hands every attacker a fresh one. A shared atomic
 * counter is the only correct answer, and `INCR`/`EXPIRE` is exactly that — one round
 * trip, no index maintenance, O(1) expiry.
 *
 * Two properties this file is responsible for:
 *
 *  1. **Namespaced keys.** The instance may be shared with other applications, so an
 *     un-prefixed `rl:1.2.3.4` is a key collision waiting to become an outage.
 *  2. **Fail open.** A cache being unavailable must not lock every user out of signing
 *     in. When the counter cannot be read the request proceeds and we log loudly: losing
 *     rate-limit accuracy is a far smaller failure than losing authentication outright.
 *     Failing closed would promote a Redis blip into a total auth outage.
 */

type LimiterScope = (typeof RATE_LIMIT_SCOPES)[keyof typeof RATE_LIMIT_SCOPES];

// Internal: log an outage at most once per window per tier, so a Redis failure does not
// become its own denial of service against the log pipeline.
const _lastOutageLogAt = new Map<LimiterScope, number>();

const _logOutage = (scope: LimiterScope, error: unknown): void => {
  const now = Date.now();
  if (now - (_lastOutageLogAt.get(scope) ?? 0) < RATE_LIMITS.API.windowMs) return;
  _lastOutageLogAt.set(scope, now);

  const message = 'Rate-limit store unavailable — requests are passing UNLIMITED';
  // A client that is still connecting (or reconnecting after a blip) is expected and
  // self-healing; anything else is a genuine incident. Reporting both at `error` would
  // make the loud one impossible to trust.
  if (error instanceof RedisUnavailableError) Logger.warn(message, { scope, reason: error.message });
  else Logger.error(message, { scope, error });
};

/**
 * Internal: a Redis-backed store for one tier that can never reject a request.
 *
 * Three things are deliberate here:
 *
 *  - **Lazy construction.** `RedisRateLimitStore`'s constructor issues `SCRIPT LOAD`
 *    immediately. Building it at import time would open a socket on import (breaking the
 *    property the test suites rely on) and, worse, leave two rejected promises with no
 *    handler if Redis is not up yet — an `unhandledRejection` that would take the process
 *    down over a cache miss.
 *  - **Handlers on the script SHAs.** `getScriptSha` is never awaited in our
 *    configuration, so its rejection needs an owner regardless. Swallowing it is safe:
 *    the library reloads the script on the next attempt, so nothing is lost permanently.
 *  - **Fail open on everything.** `express-rate-limit` has `passOnStoreError`, set below
 *    as a backstop, but it reports through `console.*` and cannot see a command that
 *    hangs. Owning the failure here routes the outage through our redacting logger, while
 *    `redisCommand`'s deadline keeps the request path bounded.
 */
const _store = (scope: LimiterScope): Store => {
  const prefix = `${REDIS_KEYS.RATE_LIMIT}${scope}:`;
  let delegate: RedisRateLimitStore | undefined;
  let initOptions: Options | undefined;

  const _resolve = (): RedisRateLimitStore => {
    if (delegate) return delegate;
    delegate = new RedisRateLimitStore({
      prefix,
      sendCommand: (...args: string[]) => redisCommand(args) as Promise<RedisReply>,
    });
    delegate.incrementScriptSha.catch(() => undefined);
    delegate.getScriptSha.catch(() => undefined);
    // `windowMs` reaches the Lua script through `init`, so it must be applied before the
    // first increment rather than whenever express-rate-limit happened to call it.
    if (initOptions) delegate.init(initOptions);
    return delegate;
  };

  return {
    prefix,

    init(options: Options) {
      initOptions = options;
      delegate?.init(options);
    },

    async increment(key: string): Promise<ClientRateLimitInfo> {
      try {
        return await _resolve().increment(key);
      } catch (error) {
        _logOutage(scope, error);
        // One hit and no reset time: never at the limit, so the request passes.
        return { totalHits: 1, resetTime: undefined };
      }
    },

    async decrement(key: string): Promise<void> {
      try {
        await _resolve().decrement(key);
      } catch (error) {
        _logOutage(scope, error);
      }
    },

    async resetKey(key: string): Promise<void> {
      try {
        await _resolve().resetKey(key);
      } catch (error) {
        _logOutage(scope, error);
      }
    },
  };
};

const base = (
  scope: LimiterScope,
  limit: { windowMs: number; max: number },
  message: string,
): Partial<Options> => ({
  windowMs: limit.windowMs,
  limit: limit.max,
  standardHeaders: true,
  legacyHeaders: false,
  store: _store(scope),
  // Backstop only — `_failOpen` already absorbs store failures before this can fire.
  passOnStoreError: true,
  message: { success: false, message, code: ERROR_CODES.TOO_MANY_REQUESTS },
});

/** Loose global backstop on the whole API surface. */
export const apiLimiter = rateLimit(
  base(RATE_LIMIT_SCOPES.API, RATE_LIMITS.API, ERROR_MESSAGES.TOO_MANY_REQUESTS),
);

/** Strict limiter for brute-forceable credential endpoints (login, register). */
export const authLimiter = rateLimit(
  base(RATE_LIMIT_SCOPES.AUTH, RATE_LIMITS.AUTH, ERROR_MESSAGES.TOO_MANY_REQUESTS),
);

/**
 * The OAuth token endpoint. Previously unthrottled: it is simultaneously a
 * client-secret oracle and an authorization-code oracle, and it sits outside the
 * `/api` mount that `apiLimiter` covers.
 */
export const tokenLimiter = rateLimit(
  base(RATE_LIMIT_SCOPES.TOKEN, RATE_LIMITS.TOKEN, ERROR_MESSAGES.TOO_MANY_REQUESTS),
);

/**
 * Endpoints that send mail or mint action tokens (verification, password reset).
 * Unbounded, these are a mail-bomb primitive aimed at a third party's inbox.
 */
export const sensitiveLimiter = rateLimit(
  base(RATE_LIMIT_SCOPES.SENSITIVE, RATE_LIMITS.SENSITIVE, ERROR_MESSAGES.TOO_MANY_REQUESTS),
);
