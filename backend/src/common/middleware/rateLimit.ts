import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import RedisRateLimitStore from 'rate-limit-redis';
import type { RedisReply } from 'rate-limit-redis';
import { redisCommand, RedisUnavailableError } from '../config/redis';
import { Logger } from '../logger/index.logger';
import { ClientCredentialsUtil } from '../utils/clientCredentials.utils';
import { hashToken } from '../utils/crypto.utils';
import {
  ERROR_CODES,
  ERROR_MESSAGES,
  IPV6_SUBNET_HEXTETS,
  RATE_LIMITS,
  RATE_LIMIT_KEY_HASH_LENGTH,
  RATE_LIMIT_KEY_KINDS,
  RATE_LIMIT_SCOPES,
  REDIS_KEYS,
  TOKEN_RATE_LIMITS,
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

/**
 * Internal: the address component of a limiter key.
 *
 * Writing a custom `keyGenerator` means taking over the IPv6 problem the library's
 * default handles: end sites are allocated a /64 or shorter, so a full /128 key hands
 * anyone with an ordinary residential prefix an unlimited supply of fresh budgets. The
 * address is bucketed to `IPV6_SUBNET_HEXTETS` so the limit applies to the subnet.
 * IPv4 has no equivalent slack and is used whole.
 */
const _ipKey = (req: Request): string => {
  const ip = req.ip ?? '';
  if (!ip.includes(':')) return ip;
  return ip.split(':').slice(0, IPV6_SUBNET_HEXTETS).join(':');
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

/**
 * Loose global backstop on the whole API surface, keyed on source address. Mounted on
 * `/oauth` as well as the `/api` prefixes, which is what bounds the number of distinct
 * keys `tokenLimiter` can be made to create.
 */
export const apiLimiter = rateLimit(
  base(RATE_LIMIT_SCOPES.API, RATE_LIMITS.API, ERROR_MESSAGES.TOO_MANY_REQUESTS),
);

/** Strict limiter for brute-forceable credential endpoints (login, register). */
export const authLimiter = rateLimit(
  base(RATE_LIMIT_SCOPES.AUTH, RATE_LIMITS.AUTH, ERROR_MESSAGES.TOO_MANY_REQUESTS),
);

/**
 * The OAuth token endpoint (and revocation and introspection, which take the same
 * credential and the same kind of token). Previously unthrottled altogether.
 *
 * ## Why not the default IP key
 *
 * `express-rate-limit` falls back to the source address, which on this endpoint is an
 * availability bug rather than a conservative default. Token exchanges are server-to-
 * server or come from whatever egress the user's network happens to have, so a corporate
 * NAT, a mobile carrier's CGNAT or a VPN concentrator collapses an entire population
 * into one budget — and the busier a tenant is, the sooner it locks its own users out of
 * signing in. The address is not the actor here.
 *
 * ## The key
 *
 * The presented `client_id` when there is one, the source address otherwise. That puts
 * the budget on the dimension abuse actually runs in: guessing a secret, a code or a
 * PKCE verifier means targeting one specific client, and a client is an identified,
 * suspendable party in a way an IP address is not.
 *
 * **The `client_id` is used exactly as presented, with no existence check.** That is the
 * security property, not laziness: looking it up would make the limiter's behaviour
 * depend on whether the client is real, and an unauthenticated caller could then
 * enumerate valid ids by watching which requests get which budget — the endpoint would
 * leak through its rate limiter what it carefully refuses to leak through its responses
 * (`ClientAuthService` returns one indistinguishable `invalid_client` for unknown
 * client, wrong method and bad secret). A made-up `client_id` gets its own bucket with
 * the same limit and the same headers as a real one, so there is nothing to observe. The
 * cost is that spraying ids mints Redis keys; `apiLimiter` on the `/oauth` mount already
 * bounds that per address, and each key is `windowMs`-expiring and O(1).
 *
 * The id is hashed into the key rather than interpolated: it is caller-controlled input
 * heading into a shared Redis keyspace, and a fixed-width digest cannot smuggle a
 * delimiter or run to an unbounded length. It is not a secrecy measure — a `client_id`
 * travels in browser URLs.
 */
const _tokenLimiterKey = (req: Request): string => {
  const clientId = ClientCredentialsUtil.presentedClientId(req);
  if (clientId) {
    const digest = hashToken(clientId).slice(0, RATE_LIMIT_KEY_HASH_LENGTH);
    return `${RATE_LIMIT_KEY_KINDS.CLIENT}:${digest}`;
  }
  return `${RATE_LIMIT_KEY_KINDS.IP}:${_ipKey(req)}`;
};

export const tokenLimiter = rateLimit({
  ...base(RATE_LIMIT_SCOPES.TOKEN, TOKEN_RATE_LIMITS.PER_CLIENT, ERROR_MESSAGES.TOO_MANY_REQUESTS),
  keyGenerator: _tokenLimiterKey,
  /**
   * The two key kinds carry different budgets. An identified client gets a generous one;
   * a caller presenting no `client_id` at all gets the original tight number, because
   * such a request cannot succeed — it is `invalid_client` before any lookup — so the
   * bucket only ever holds malformed or probing traffic.
   *
   * This branches on *presence*, never on validity, so it tells an attacker only what
   * they already know: whether they themselves sent a `client_id`.
   */
  limit: (req: Request): number =>
    ClientCredentialsUtil.presentedClientId(req)
      ? TOKEN_RATE_LIMITS.PER_CLIENT.max
      : TOKEN_RATE_LIMITS.PER_IP.max,
});

/**
 * Endpoints that send mail or mint action tokens (verification, password reset).
 * Unbounded, these are a mail-bomb primitive aimed at a third party's inbox.
 */
export const sensitiveLimiter = rateLimit(
  base(RATE_LIMIT_SCOPES.SENSITIVE, RATE_LIMITS.SENSITIVE, ERROR_MESSAGES.TOO_MANY_REQUESTS),
);
