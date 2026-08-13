/**
 * Every literal that used to be inlined at a call site. Nothing in `src/` should
 * contain a magic number, a bare enum member, or a hand-typed key prefix.
 *
 * Values that vary per deployment belong in `common/config` instead — this file is
 * for constants that are part of the protocol or the product, not the environment.
 */

// ── API surface ───────────────────────────────────────────────────────────────
export const API = {
  VERSION: 'v1',
  PREFIX: '/api/v1',
  /** Unversioned mounts kept as aliases for one release so the frontend keeps working. */
  LEGACY_PREFIX: '/api',
} as const;

export const ROUTE_SEGMENTS = {
  AUTH: 'auth',
  ACCOUNT: 'me',
  ADMIN: 'admin',
  OAUTH_API: 'oauth',
  SESSIONS: 'sessions',
} as const;

/**
 * Frontend paths the emailed links point at. They live here rather than in the email
 * templates so that "which page redeems a verification token" is one grep, and so the
 * token travels in the URL *fragment* — never the query string, which the reference
 * project got wrong (§2.3-14) and which leaks into referrer headers, browser history,
 * and every proxy access log on the way.
 */
export const FRONTEND_PATHS = {
  VERIFY_EMAIL: '/verify-email',
  RESET_PASSWORD: '/reset-password',
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
} as const;

// ── Roles ─────────────────────────────────────────────────────────────────────
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/** Roles allowed through the admin gate. */
export const ADMIN_ROLES: readonly UserRole[] = [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN];

// ── OIDC scopes ───────────────────────────────────────────────────────────────
export const OIDC_SCOPES = {
  OPENID: 'openid',
  PROFILE: 'profile',
  EMAIL: 'email',
  OFFLINE_ACCESS: 'offline_access',
} as const;

export const SUPPORTED_SCOPES: readonly string[] = [
  OIDC_SCOPES.OPENID,
  OIDC_SCOPES.PROFILE,
  OIDC_SCOPES.EMAIL,
];

// ── OAuth protocol literals ───────────────────────────────────────────────────
export const GRANT_TYPES = {
  AUTHORIZATION_CODE: 'authorization_code',
  REFRESH_TOKEN: 'refresh_token',
} as const;

export const RESPONSE_TYPES = {
  CODE: 'code',
} as const;

export const CODE_CHALLENGE_METHODS = {
  S256: 'S256',
} as const;

/** Prefix on the opaque consent-transaction id, so it is recognisable in a log line. */
export const OAUTH_TRANSACTION_ID_PREFIX = 'txn_';

export const TOKEN_ENDPOINT_AUTH_METHODS = {
  CLIENT_SECRET_BASIC: 'client_secret_basic',
  CLIENT_SECRET_POST: 'client_secret_post',
  NONE: 'none',
} as const;

/**
 * Outcomes of a single-use authorization-code claim.
 *
 * All four return the same `invalid_grant` to the client — telling them apart would be
 * an oracle. They are kept apart internally because they mean different things to us:
 * `REPLAYED` is an attack signal that must revoke the tokens the first redemption
 * issued, while `UNKNOWN` is an ordinary client bug.
 */
export const CODE_REDEMPTION = {
  CLAIMED: 'claimed',
  REPLAYED: 'replayed',
  EXPIRED: 'expired',
  UNKNOWN: 'unknown',
} as const;

export type CodeRedemptionOutcome = (typeof CODE_REDEMPTION)[keyof typeof CODE_REDEMPTION];

/** RFC 6749 §4.1.2.1 / §5.2 error codes. */
export const OAUTH_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  INVALID_SCOPE: 'invalid_scope',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  ACCESS_DENIED: 'access_denied',
  LOGIN_REQUIRED: 'login_required',
  CONSENT_REQUIRED: 'consent_required',
  SERVER_ERROR: 'server_error',
  /** RFC 7009 §2.2.1 — the endpoint does not support revoking this kind of token. */
  UNSUPPORTED_TOKEN_TYPE: 'unsupported_token_type',
  /** RFC 6750 §3.1 — returned by resource endpoints, not by /token. */
  INVALID_TOKEN: 'invalid_token',
  /** OIDC Core §3.1.2.6 — prompt=none but interaction is unavoidable. */
  INTERACTION_REQUIRED: 'interaction_required',
} as const;

export type OAuthErrorCode = (typeof OAUTH_ERRORS)[keyof typeof OAUTH_ERRORS];

// ── Redis: cache and counters only ────────────────────────────────────────────
/**
 * Redis holds nothing whose loss would be a correctness or safety failure (D1).
 * Every authoritative keyspace it used to own — sessions, authorization codes,
 * pending authorization requests, OIDC access tokens, social-login state — is now a
 * TTL-indexed Mongo collection. What is left is shared counters: worthless once
 * their window closes, high churn, and needed atomically across replicas.
 *
 * `FLUSHALL` on this instance must cost latency and rate-limit accuracy, nothing else.
 *
 * Keys are namespaced because the instance may be shared with other applications —
 * an un-prefixed `rl:1.2.3.4` is a collision waiting to become an outage.
 */
const REDIS_NAMESPACE = 'id:';

export const REDIS_KEYS = {
  NAMESPACE: REDIS_NAMESPACE,
  /** `express-rate-limit` counters. */
  RATE_LIMIT: `${REDIS_NAMESPACE}rl:`,
} as const;

/**
 * Client tuning for a cache tier. A cache must never hold the request path open:
 * a command that cannot complete inside the timeout is abandoned and the caller
 * degrades (see `rateLimit.ts`), rather than making a Redis stall an auth outage.
 */
export const REDIS_CACHE = {
  COMMAND_TIMEOUT_MS: 250,
  MAX_RETRIES_PER_REQUEST: 1,
  CONNECT_TIMEOUT_MS: 2_000,
  /** Capped exponential reconnect backoff; retries forever so a blip self-heals. */
  RECONNECT_BASE_MS: 100,
  RECONNECT_MAX_MS: 3_000,
} as const;

// ── Mongoose model + collection names ─────────────────────────────────────────
/** Registered Mongoose model names (what `ref:` and `mongoose.models` key on). */
export const COLLECTIONS = {
  USER: 'User',
  IDENTITY: 'Identity',
  CONSENT: 'OAuthConsent',
  OAUTH_CLIENT: 'OAuthClient',
  AUTH_EVENT: 'AuthEvent',
  SESSION: 'Session',
  OAUTH_STATE: 'OAuthState',
  OAUTH_AUTH_REQUEST: 'OAuthAuthRequest',
  OAUTH_AUTH_CODE: 'OAuthAuthCode',
  OAUTH_ACCESS_TOKEN: 'OAuthAccessToken',
  AUTH_ACTION_TOKEN: 'AuthActionToken',
  LOGIN_THROTTLE: 'LoginThrottle',
  // M3
  REFRESH_TOKEN: 'RefreshToken',
  // M4
  OAUTH_SIGNING_KEY: 'OAuthSigningKey',
} as const;

/**
 * Physical collection names, pinned explicitly rather than left to Mongoose's
 * pluraliser — which would turn `OAuthAuthCode` into `oauthauthcodes` and make the
 * collection names in the design doc not match the ones in the database.
 */
export const COLLECTION_NAMES = {
  SESSION: 'sessions',
  OAUTH_STATE: 'oauthStates',
  OAUTH_AUTH_REQUEST: 'oauthAuthRequests',
  OAUTH_AUTH_CODE: 'oauthAuthCodes',
  OAUTH_ACCESS_TOKEN: 'oauthAccessTokens',
  AUTH_ACTION_TOKEN: 'authActionTokens',
  LOGIN_THROTTLE: 'loginThrottles',
  // M3
  REFRESH_TOKEN: 'refreshTokens',
  // M4
  OAUTH_SIGNING_KEY: 'oauthSigningKeys',
} as const;

/**
 * `expireAfterSeconds` for a TTL index on an absolute `expiresAt` date: expire the
 * document the moment that date passes, rather than N seconds after it.
 *
 * TTL is storage reclamation, NOT authorization. Mongo's reaper runs on a ~60 s cycle
 * and never runs on a secondary, so an expired document stays readable for up to a
 * minute after it dies. Every read against these collections must therefore carry an
 * explicit `expiresAt: { $gt: new Date() }` predicate of its own.
 */
export const TTL_EXPIRE_AT_DATE = 0;

// ── Time ──────────────────────────────────────────────────────────────────────
export const SECONDS = {
  MINUTE: 60,
  HOUR: 3_600,
  DAY: 86_400,
} as const;

export const MILLISECONDS = {
  SECOND: 1_000,
  MINUTE: 60_000,
  HOUR: 3_600_000,
  DAY: 86_400_000,
} as const;

export const TTL_SECONDS = {
  /** OIDC access token (opaque, Mongo-backed). */
  ACCESS_TOKEN: 15 * SECONDS.MINUTE,
  /** Pending consent transaction. */
  AUTH_REQUEST: 15 * SECONDS.MINUTE,
  /** Authorization code — short by design (RFC 6749 §4.1.2 recommends ≤10 min). */
  AUTH_CODE: 5 * SECONDS.MINUTE,
  /** Social-login CSRF state. */
  OAUTH_STATE: 10 * SECONDS.MINUTE,
  /** First-party session whitelist entry. */
  SESSION: 7 * SECONDS.DAY,
  /** Email-verification action token. */
  EMAIL_VERIFICATION: 24 * SECONDS.HOUR,
  /** Password-reset action token. */
  PASSWORD_RESET: 1 * SECONDS.HOUR,
} as const;

/** Default TTL baked into the AuthEvent index; the configured value is applied via collMod at boot. */
export const DEFAULT_EVENT_RETENTION_SECONDS = 90 * SECONDS.DAY;

/**
 * How long a spent authorization code is *kept* past the moment it stops being *valid*.
 *
 * Validity and retention are different things. Validity is the `expiresAt` predicate
 * every query carries; retention is how long the row survives so that a replay is still
 * distinguishable from a code that never existed. Reaping the document the instant it
 * expires would silently downgrade the attack signal to a plain 400 for anyone who
 * replays a stolen code a few minutes late.
 */
export const AUTH_CODE_REPLAY_RETENTION_SECONDS = 10 * SECONDS.MINUTE;

/** How stale `lastSeenAt` may get before we spend a write on it. */
export const LAST_SEEN_THROTTLE_MS = 60 * MILLISECONDS.SECOND;

// ── Auth action tokens (email verification, password reset) ───────────────────
/**
 * Type-discriminated action tokens, so a verification token can never be redeemed as a
 * password reset. The type is part of the redemption filter, not an afterthought.
 */
export const ACTION_TOKEN_TYPES = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
} as const;

export type ActionTokenType = (typeof ACTION_TOKEN_TYPES)[keyof typeof ACTION_TOKEN_TYPES];

/** TTL per token type, keyed so the store never has to branch on the type itself. */
export const ACTION_TOKEN_TTL_SECONDS: Record<ActionTokenType, number> = {
  [ACTION_TOKEN_TYPES.EMAIL_VERIFICATION]: TTL_SECONDS.EMAIL_VERIFICATION,
  [ACTION_TOKEN_TYPES.PASSWORD_RESET]: TTL_SECONDS.PASSWORD_RESET,
};

/**
 * Why an outstanding action token was killed before it was used. Recorded so a support
 * question ("my link stopped working") has an answer other than a shrug.
 */
export const ACTION_TOKEN_REVOKE_REASONS = {
  /** A newer token of the same type was issued for the same user. */
  SUPERSEDED: 'superseded',
  /** A password reset completed, so every other outstanding token is stale. */
  PASSWORD_RESET: 'password_reset',
  ACCOUNT_DELETED: 'account_deleted',
} as const;

export type ActionTokenRevokeReason =
  (typeof ACTION_TOKEN_REVOKE_REASONS)[keyof typeof ACTION_TOKEN_REVOKE_REASONS];

/**
 * Outcomes of a single-use action-token claim.
 *
 * `EXPIRED` gets its own client-facing code, because "this link expired, request a new
 * one" is materially better copy and learning it requires already holding the token —
 * there is no user-existence oracle in it. Every other failure collapses to
 * `INVALID_ACTION_TOKEN`, so a replay of a genuine token is indistinguishable from a
 * guess. They stay distinct internally because they are different events: `CONSUMED` is
 * a replay, `SUPERSEDED` is an old link from an old inbox, `UNKNOWN` is noise.
 */
export const ACTION_TOKEN_OUTCOME = {
  CLAIMED: 'claimed',
  CONSUMED: 'consumed',
  SUPERSEDED: 'superseded',
  EXPIRED: 'expired',
  UNKNOWN: 'unknown',
} as const;

export type ActionTokenOutcome =
  (typeof ACTION_TOKEN_OUTCOME)[keyof typeof ACTION_TOKEN_OUTCOME];

// ── Account deletion ─────────────────────────────────────────────────────────
/**
 * Soft deletion has to free the email address, or re-registration hits a duplicate-key
 * error forever — the reference's §2.3-16 bug.
 *
 * The address is moved to `deletedEmail` and `email` is replaced with a tombstone, which
 * frees the live `unique` index on `users.email` **without** rebuilding it. The
 * alternative — a unique index made partial on `{ deletedAt: null }` — is prettier data
 * but requires dropping and recreating a unique index on a live collection, and leans on
 * the null-matching semantics of `partialFilterExpression`. Determinism wins here.
 *
 * `.invalid` is reserved by RFC 2606, so a tombstone can never collide with a real
 * address, and the ObjectId makes it unique without a lookup.
 */
export const DELETED_ACCOUNT = {
  EMAIL_PREFIX: 'deleted+',
  EMAIL_DOMAIN: 'deleted.invalid',
} as const;

// ── Email delivery ───────────────────────────────────────────────────────────
export const EMAIL_DELIVERY = {
  /** Resend's transactional send endpoint. */
  RESEND_ENDPOINT: 'https://api.resend.com/emails',
  /**
   * Delivery is fire-and-forget *after* the token is persisted, but it still needs a
   * ceiling: an un-timed fetch against a hung provider holds a socket and a promise for
   * as long as the provider feels like it.
   */
  TIMEOUT_MS: 10 * MILLISECONDS.SECOND,
  /**
   * How many suppressed messages the development outbox keeps. Bounded because it is an
   * in-memory ring and an unbounded one is a memory leak with a friendly name.
   */
  DEV_OUTBOX_SIZE: 25,
} as const;

// ── Cookies ───────────────────────────────────────────────────────────────────
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;

export const COOKIE_SAME_SITE = 'lax' as const;

// ── Rate limiting ─────────────────────────────────────────────────────────────
/**
 * One key namespace per limiter tier, so the tiers count independently instead of
 * sharing a bucket. Appended to `REDIS_KEYS.RATE_LIMIT`.
 */
export const RATE_LIMIT_SCOPES = {
  API: 'api',
  AUTH: 'auth',
  TOKEN: 'token',
  SENSITIVE: 'sensitive',
} as const;

export const RATE_LIMITS = {
  /** Loose backstop across the whole API. */
  API: { windowMs: 15 * MILLISECONDS.MINUTE, max: 1_000 },
  /** Brute-forceable credential endpoints. */
  AUTH: { windowMs: 15 * MILLISECONDS.MINUTE, max: 50 },
  /**
   * Token endpoint — a client-secret and authorization-code oracle. Since the M4
   * follow-up this applies only to callers presenting no `client_id`; an identified
   * client is counted separately, see `TOKEN_RATE_LIMITS`.
   */
  TOKEN: { windowMs: 15 * MILLISECONDS.MINUTE, max: 120 },
  /** Endpoints that send email or mint action tokens. */
  SENSITIVE: { windowMs: 60 * MILLISECONDS.MINUTE, max: 10 },
} as const;

// ── Login throttle (M2) ───────────────────────────────────────────────────────
export const LOGIN_THROTTLE = {
  MAX_ATTEMPTS: 5,
  LOCK_MS: 15 * MILLISECONDS.MINUTE,
  /**
   * Expiring window. The reference implementation had no decay at all, so five
   * failures bricked an account permanently — the lock is evaluated from
   * `lockedUntil` only, and the counter document self-expires after this window.
   */
  WINDOW_MS: 60 * MILLISECONDS.MINUTE,
} as const;

// ── Crypto ────────────────────────────────────────────────────────────────────
export const CRYPTO = {
  /**
   * Argon2id parameters (OWASP-current: 64 MiB, t=3, p=4). These are *defaults* —
   * `Config.password.argon2` may override each one per deployment, because the right
   * cost is a function of the host's memory and the login rate it must sustain, and
   * raising it must never require a code change. `PasswordService.needsRehash` is what
   * makes raising it actually upgrade stored hashes.
   */
  ARGON2: { memoryCost: 65_536, timeCost: 3, parallelism: 4 },
  /**
   * `Algorithm.Argon2id` from `@node-rs/argon2`, as a number.
   *
   * The binding declares that enum as an *ambient const enum*, which cannot be referenced
   * at all under `verbatimModuleSyntax` — so the value has to be restated. Restating a
   * magic number for a security-critical parameter is only acceptable with a check, and
   * there is one: `PasswordService.warmup()` asserts at boot that the hash it produces
   * actually carries the `$argon2id$` prefix. If the binding ever renumbers, the process
   * refuses to start rather than quietly hashing with Argon2i or Argon2d.
   */
  ARGON2_ALGORITHM_ID: 2,
  /** Verify-only fallback for hashes created before the Argon2 migration. */
  LEGACY_BCRYPT_ROUNDS: 12,
  TOKEN_BYTES: {
    SESSION_ID: 24,
    AUTH_CODE: 32,
    ACCESS_TOKEN: 32,
    REFRESH_TOKEN: 64,
    ACTION_TOKEN: 32,
    /** Social-login CSRF state. */
    STATE: 24,
    TRANSACTION_ID: 24,
    /** `jti` on an OIDC access token — collision resistance, not secrecy. */
    JTI: 16,
    /** Ties every token minted from one authorization code together, for RFC 7009 cascade. */
    GRANT_ID: 18,
    /**
     * Client secret entropy. 48 bytes of CSPRNG — the premise the SHA-256 digest in
     * `CLIENT_SECRET_DIGEST` rests on, so the two must be read together.
     */
    CLIENT_SECRET: 48,
  },
  SIGNING_ALG: 'RS256',
} as const;

/**
 * Bounds on the tunable Argon2 parameters, enforced by the env schema.
 *
 * A floor exists because the failure mode of a mistyped `ARGON2_MEMORY_KIB=64` is
 * silent: every password still hashes and verifies, at roughly a thousandth of the
 * intended cost. A ceiling exists because each concurrent hash reserves `memoryCost`
 * KiB, so an over-large value turns a login burst into an OOM.
 */
export const ARGON2_LIMITS = {
  MEMORY_KIB: { MIN: 19_456, MAX: 1_048_576 },
  TIME_COST: { MIN: 2, MAX: 10 },
  PARALLELISM: { MIN: 1, MAX: 16 },
} as const;

/**
 * Password hash formats we can recognise. The stored hash is self-describing, so no
 * `algorithm` column is needed on the user document — which also means there is no way
 * for such a column to disagree with the hash it describes.
 */
export const PASSWORD_ALGORITHMS = {
  ARGON2ID: 'argon2id',
  BCRYPT: 'bcrypt',
  UNKNOWN: 'unknown',
} as const;

export type PasswordAlgorithm = (typeof PASSWORD_ALGORITHMS)[keyof typeof PASSWORD_ALGORITHMS];

/** PHC-string prefix for Argon2id, and the three bcrypt revisions in the wild. */
export const PASSWORD_HASH_PREFIXES = {
  ARGON2ID: '$argon2id$',
  BCRYPT: ['$2a$', '$2b$', '$2y$'] as readonly string[],
} as const;

/**
 * How long a `PasswordService.warmup()` hash may take before we complain at boot.
 *
 * Above this, every login pays the cost and a burst will queue on the libuv thread
 * pool — which is a tuning problem the operator needs told about at start-up, not
 * discovered from p99 latency graphs a week later.
 */
export const PASSWORD_HASH_SLOW_MS = 500;

/**
 * Floor for `UV_THREADPOOL_SIZE` once Argon2 is in play.
 *
 * `@node-rs/argon2`'s async API dispatches onto libuv's thread pool, which defaults to
 * **four** threads and is shared with `dns.lookup`, `fs`, `zlib`, and `crypto.pbkdf2`.
 * Measured on the reference machine: with the default pool, a `readFile` that takes
 * 0 ms idle takes **182 ms** while eight hashes are in flight; at 16 threads it returns
 * in 0 ms. Since Mongo and Redis reconnects need `dns.lookup`, an undersized pool means
 * a login burst can delay the very reconnect that would end an outage.
 */
export const UV_THREADPOOL_MIN_FOR_ARGON2 = 8;

// ── Field caps ────────────────────────────────────────────────────────────────
export const FIELD_LIMITS = {
  USER_AGENT: 400,
  IP_ADDRESS: 45,
  DEVICE_NAME: 200,
  NAME: 100,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  DISABLED_REASON: 500,
  BIO: 500,
  JOB_TITLE: 100,
  COUNTRY_CODE: 2,
  EMAIL: 254,
} as const;

// ── Pagination ────────────────────────────────────────────────────────────────
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  ACTIVITY_DEFAULT_LIMIT: 100,
  ACTIVITY_MAX_LIMIT: 200,
} as const;

/** Mongo ObjectId shape. Path-param validators use this so a garbage `:id` is a 400, not a CastError 500. */
export const OBJECT_ID = {
  PATTERN: /^[a-fA-F0-9]{24}$/,
  LENGTH: 24,
} as const;

/** Opaque OAuth client identifiers. Generated, never an ObjectId. */
export const CLIENT_ID = {
  PREFIX: 'cl_',
  MAX_LENGTH: 40,
} as const;

// ── Body parser limits ────────────────────────────────────────────────────────
export const BODY_LIMITS = {
  JSON: '32kb',
  URLENCODED: '16kb',
} as const;

// ── Headers ───────────────────────────────────────────────────────────────────
export const HEADERS = {
  REQUEST_ID: 'x-request-id',
  AUTHORIZATION: 'authorization',
} as const;

export const BEARER_PREFIX = 'Bearer ';
export const BASIC_PREFIX = 'Basic ';

// ── MongoDB server error codes ────────────────────────────────────────────────
/**
 * Only the ones we branch on. `DUPLICATE_KEY` is load-bearing in two places: the error
 * handler maps it to a 409 instead of a 500, and registration treats it as "this address is
 * already taken" so that losing a concurrent race answers identically to finding the account
 * on the initial read.
 */
export const MONGO_ERROR_CODES = {
  DUPLICATE_KEY: 11000,
} as const;

// ── HTTP status codes ─────────────────────────────────────────────────────────
/**
 * Named statuses, for the `ApiError.fromCode(status, code)` path.
 *
 * `ApiError`'s named constructors (`badRequest`, `forbidden`, …) hide the number, which is
 * the right place for it — but `fromCode` exists precisely so a throw can name only its
 * `ERROR_CODES` member and take the paired message for free, and it needs the status
 * separately. Naming them here keeps that from being a bare literal at the call site.
 */
export const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// M3 — Sessions, refresh-token families, and the email-verification gate.
// Appended as its own section; nothing above this line was reordered.
// ══════════════════════════════════════════════════════════════════════════════

// ── Email-verification gate ───────────────────────────────────────────────────
/**
 * The instant the "you must verify your address before signing in" rule took effect.
 *
 * It exists for exactly one reason: to make `scripts/backfill-email-verified.ts`
 * idempotent in the strong sense. A backfill written as "verify everyone who is not
 * verified" is idempotent only if you never run it twice — the second run would sweep up
 * every account created in between, which is precisely the population the gate is meant
 * to apply to. Pinning the cutoff means the script targets the same fixed set forever,
 * whether it runs once or a hundred times.
 *
 * It is deliberately **not** consulted at login. Two sources of truth for "is this
 * account gated" is worse than one, and a runtime cutoff would mean the gate silently
 * never applied to the legacy estate, with no way to ever enforce it for them. The
 * runtime check is a plain `isVerified`; the backfill is the documented prerequisite for
 * deploying it.
 */
export const EMAIL_VERIFICATION_GATE = {
  BACKFILL_CUTOFF_ISO: '2026-08-14T00:00:00.000Z',
} as const;

// ── Refresh tokens ────────────────────────────────────────────────────────────
/**
 * Lifecycle of one refresh token within a family.
 *
 * `rotated` is not a terminal state in the way `revoked` is: a rotated token is retained
 * precisely so that presenting it again is *detectable*. That detection is the whole
 * point of rotation, and it is the thing the reference implementation writes the columns
 * for and then never reads (§2.3-3).
 */
export const REFRESH_TOKEN_STATUS = {
  ACTIVE: 'active',
  ROTATED: 'rotated',
  REVOKED: 'revoked',
} as const;

export type RefreshTokenStatus =
  (typeof REFRESH_TOKEN_STATUS)[keyof typeof REFRESH_TOKEN_STATUS];

/**
 * Outcomes of a rotation attempt. All the failure cases answer the client with one of two
 * codes; they stay distinct internally because they mean very different things to us —
 * `REUSE_DETECTED` kills a family, `IN_FLIGHT` asks for a retry.
 */
export const REFRESH_OUTCOME = {
  /** The presented token was active and has been exchanged for a fresh child. */
  ROTATED: 'rotated',
  /** Benign concurrent refresh: the same token, replayed inside the grace window. */
  GRACE_REPLAY: 'grace_replay',
  /** A rotation is provably underway but its child is not readable yet. Retriable. */
  IN_FLIGHT: 'in_flight',
  /** An already-rotated token presented outside the grace window, or two generations back. */
  REUSE_DETECTED: 'reuse_detected',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
  UNKNOWN: 'unknown',
} as const;

export type RefreshOutcome = (typeof REFRESH_OUTCOME)[keyof typeof REFRESH_OUTCOME];

export const REFRESH_TOKEN = {
  /**
   * How long after rotation the immediately-previous token still answers with its own
   * successor instead of tripping reuse detection.
   *
   * **Not optional.** Multi-tab SPAs and mobile clients routinely fire two refreshes
   * milliseconds apart, and a client that retries after a dropped response presents a
   * token it has already spent. Without a grace window every one of those trips reuse
   * detection and signs a legitimate user out of everything — a self-inflicted DoS that
   * looks exactly like an attack in the logs.
   *
   * Short on purpose: it is a race window, not a validity extension. A stolen token is
   * usable inside it only if the thief wins a ten-second race against the legitimate
   * client, which is a far smaller exposure than the thirty days a never-detected
   * rotation leaves open.
   */
  GRACE_MS: 10 * MILLISECONDS.SECOND,
  /**
   * How long a spent refresh token is *kept* past the moment it stops being *valid*.
   *
   * Same argument as `AUTH_CODE_REPLAY_RETENTION_SECONDS`: validity is the `expiresAt`
   * predicate every read carries, retention is how long the row survives so a late replay
   * is still recognisable as a replay rather than degrading into "unknown token". Reaping
   * on the instant of expiry would throw the attack signal away.
   */
  REPLAY_RETENTION_SECONDS: 7 * SECONDS.DAY,
} as const;

// ── Device naming ─────────────────────────────────────────────────────────────
/**
 * Human-readable session labels derived from the user agent.
 *
 * The user agent is attacker-controlled text that ends up in a list the account owner
 * reads, so the derived label is built from `ua-parser-js`'s *parsed* fields rather than
 * from the raw string, stripped of anything that is not printable, and capped. The raw
 * string is still stored (capped at `FIELD_LIMITS.USER_AGENT`) because support needs it.
 */
export const DEVICE_NAME = {
  UNKNOWN: 'Unknown device',
  /** Joins the parsed browser and platform halves: "Chrome on Windows". */
  JOINER: ' on ',
  /** Longest UA we will hand to the parser. Beyond this it is noise or an attack. */
  MAX_PARSE_LENGTH: FIELD_LIMITS.USER_AGENT,
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// M4 — OIDC hardening
//
// Everything below is additive and self-contained so it merges cleanly alongside
// the other milestones landing in this file. Nothing above was reordered.
// ══════════════════════════════════════════════════════════════════════════════

// ── Token type discrimination (fixes reference bug §2.3-1) ────────────────────
/**
 * The `typ` header that tells one signed artefact from another.
 *
 * The reference issues OAuth access tokens that are indistinguishable from its own
 * first-party session tokens, so any relying party can drive the admin API with a
 * user's OAuth token. Three things keep ours apart, and all three are checked:
 *
 *  1. `typ` — `at+jwt` (RFC 9068) for an OIDC access token, plain `JWT` for an ID
 *     token. A first-party session token is HS256 and carries neither.
 *  2. `alg` — OIDC artefacts are RS256 against the published JWKS; first-party
 *     session tokens are HS256 against a secret that never leaves the server.
 *  3. `aud` — an access token is audienced at the *resource server* (this issuer),
 *     an ID token at the *client*. Presenting one where the other is expected fails
 *     the audience check even before the store lookup.
 */
export const TOKEN_TYP = {
  /** RFC 9068 §2.1 — OAuth 2.0 JWT access token. */
  OIDC_ACCESS: 'at+jwt',
  /** OIDC Core §2 — the ID token is an ordinary JWT. */
  ID_TOKEN: 'JWT',
} as const;

export const TOKEN_TYPE_BEARER = 'Bearer';

/** RFC 7662 §2.1 / RFC 7009 §2.1 `token_type_hint` values we accept. */
export const TOKEN_TYPE_HINTS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

// ── Client protocol metadata (plan §4.3) ──────────────────────────────────────
export const SUPPORTED_GRANT_TYPES: readonly string[] = [GRANT_TYPES.AUTHORIZATION_CODE];

export const SUPPORTED_RESPONSE_TYPES: readonly string[] = [RESPONSE_TYPES.CODE];

export const SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS: readonly string[] = [
  TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_BASIC,
  TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_POST,
  TOKEN_ENDPOINT_AUTH_METHODS.NONE,
];

/**
 * Registration defaults for a client that does not state its own policy.
 *
 * `client_secret_post` rather than the OIDC-specified `client_secret_basic`: this
 * field is being introduced *with* enforcement, and every client already registered
 * against this deployment posts its secret in the body. Defaulting to the spec value
 * would reject all of them on the first request after deploy. New clients should
 * register `client_secret_basic` explicitly.
 */
export const CLIENT_DEFAULTS = {
  SCOPES: SUPPORTED_SCOPES,
  GRANT_TYPES: [GRANT_TYPES.AUTHORIZATION_CODE] as readonly string[],
  RESPONSE_TYPES: [RESPONSE_TYPES.CODE] as readonly string[],
  TOKEN_ENDPOINT_AUTH_METHOD: TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_POST as string,
} as const;

export const CLIENT_TYPES = {
  CONFIDENTIAL: 'confidential',
  PUBLIC: 'public',
} as const;

// ── prompt / max_age (OIDC Core §3.1.2.1) ─────────────────────────────────────
export const OIDC_PROMPTS = {
  NONE: 'none',
  LOGIN: 'login',
  CONSENT: 'consent',
} as const;

export type OidcPrompt = (typeof OIDC_PROMPTS)[keyof typeof OIDC_PROMPTS];

export const SUPPORTED_PROMPTS: readonly string[] = [
  OIDC_PROMPTS.NONE,
  OIDC_PROMPTS.LOGIN,
  OIDC_PROMPTS.CONSENT,
];

/**
 * Query parameter appended to the login redirect so the sign-in page knows to force a
 * fresh credential entry. `prompt` itself is stripped from the `return_to` URL: leaving
 * it there would re-enter authorize with `prompt=login` still set and loop forever.
 */
export const LOGIN_HINT_PARAMS = {
  RETURN_TO: 'return_to',
  PROMPT: 'prompt',
  MAX_AGE: 'max_age',
} as const;

/** Tolerance when comparing `auth_time + max_age` against now, for clock drift. */
export const MAX_AGE_LEEWAY_SECONDS = 5;

// ── Signing keys (plan §4.3) ──────────────────────────────────────────────────
/**
 * Lifecycle of a signing key.
 *
 * `NEXT` is published before it ever signs, so a relying party that caches JWKS has
 * already seen the key by the time a token arrives bearing its `kid`. `RETIRED` keeps
 * verifying — and stays in JWKS — until `notAfter`, which is the overlap window that
 * makes rotation non-breaking. The reference has no such state: its `kid` is the literal
 * string `"default"` and its key-sync no-ops once a row exists, so rotation is
 * structurally impossible there.
 */
export const SIGNING_KEY_STATUS = {
  ACTIVE: 'active',
  NEXT: 'next',
  RETIRED: 'retired',
} as const;

export type SigningKeyStatus = (typeof SIGNING_KEY_STATUS)[keyof typeof SIGNING_KEY_STATUS];

export const SIGNING_KEY = {
  RSA_MODULUS_LENGTH: 2048,
  /**
   * How long a rotated-out key keeps verifying and stays published. It must exceed the
   * longest-lived artefact signed by that key (the ID token) plus any relying party's
   * JWKS cache lifetime, or rotation silently invalidates tokens still in flight.
   */
  DEFAULT_OVERLAP_SECONDS: 7 * 24 * 3_600,
  /**
   * Retention *past* `notAfter`, mirroring the authorization-code rationale: validity is
   * the explicit `notAfter` predicate every read carries, retention is how long the row
   * survives so "which key signed this?" is still answerable during an incident.
   */
  RETENTION_AFTER_NOT_AFTER_SECONDS: 30 * 24 * 3_600,
  /** AES-256-GCM envelope for the private key at rest. */
  CIPHER: 'aes-256-gcm',
  CIPHER_KEY_BYTES: 32,
  CIPHER_IV_BYTES: 12,
  /**
   * Fixed application salt for the scrypt KEK derivation. A constant salt is acceptable
   * here precisely because the input is a single high-entropy deployment secret rather
   * than a user-chosen password — there is no rainbow table to build against one value.
   */
  KEK_SALT: 'id.oidc.signing-key.kek.v1',
  /** Verification leeway for `iat`/`exp`, in seconds. */
  CLOCK_SKEW_SECONDS: 60,
} as const;

// ── Protocol endpoint paths ───────────────────────────────────────────────────
/**
 * Published in the discovery document and baked into every registered client, so these
 * are protocol surface rather than API surface — deliberately unversioned.
 */
export const OIDC_ENDPOINT_PATHS = {
  BASE: '/oauth',
  AUTHORIZE: '/authorize',
  TOKEN: '/token',
  USERINFO: '/userinfo',
  JWKS: '/jwks',
  REVOKE: '/revoke',
  INTROSPECT: '/introspect',
  END_SESSION: '/logout',
} as const;

export const WELL_KNOWN_OPENID_CONFIGURATION = '/.well-known/openid-configuration';

// ── Discovery document values ─────────────────────────────────────────────────
export const SUBJECT_TYPES: readonly string[] = ['public'];

export const RESPONSE_MODES: readonly string[] = ['query'];

export const SUPPORTED_CLAIMS: readonly string[] = [
  'sub',
  'iss',
  'aud',
  'exp',
  'iat',
  'auth_time',
  'nonce',
  'email',
  'email_verified',
  'name',
];

/**
 * Auth methods the *token* endpoint accepts. Introspection deliberately advertises a
 * narrower set: see `INTROSPECTION_AUTH_METHODS`.
 */
export const REVOCATION_AUTH_METHODS: readonly string[] = SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS;

/**
 * Introspection excludes `none`. RFC 7662 §2.1 requires the endpoint to be protected;
 * accepting an unauthenticated public client would turn it into a token oracle for
 * anyone who can read a `client_id` out of a browser URL.
 */
export const INTROSPECTION_AUTH_METHODS: readonly string[] = [
  TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_BASIC,
  TOKEN_ENDPOINT_AUTH_METHODS.CLIENT_SECRET_POST,
];

// ── Cache directives ──────────────────────────────────────────────────────────
/**
 * RFC 6749 §5.1 and RFC 7662 §2.2: responses carrying credentials or token state must
 * not be cached. `Pragma` is redundant for anything speaking HTTP/1.1 but is what the
 * RFC mandates, and intermediaries that only understand HTTP/1.0 still exist.
 */
export const NO_STORE_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
};

export const DISCOVERY_CACHE_CONTROL = 'public, max-age=3600';

// ── OAuth grant identity ──────────────────────────────────────────────────────
/**
 * Every authorization code mints a `grantId`, inherited by every token issued from it.
 * RFC 7009 §2.1 says revoking a token SHOULD cascade to everything issued under the
 * same authorization grant; without a shared identifier there is nothing to cascade
 * along, which is why the reference's revocation (had it existed) could not have done it.
 */
export const GRANT_ID_PREFIX = 'grant_';

// ── M4 follow-up — client secret digest ───────────────────────────────────────
/**
 * A client secret is `CRYPTO.TOKEN_BYTES.CLIENT_SECRET` bytes of CSPRNG output, so a
 * password KDF is the wrong primitive: the cost of Argon2/bcrypt exists to make brute
 * force expensive against low-entropy *human* input, and there is nothing here to brute
 * force. A bare SHA-256 digest is what the rest of this codebase already stores for
 * every other high-entropy bearer credential (`hashToken` guards access tokens, refresh
 * tokens and action tokens) — the client secret was the sole outlier.
 *
 * This holds *only* while secrets are server-generated. If a "bring your own secret"
 * registration path is ever added, the input becomes potentially low-entropy and this
 * decision has to be revisited — a KDF would then be correct again.
 */
export const CLIENT_SECRET_DIGEST = {
  /** Hex length of a SHA-256 digest — used to reject a truncated or corrupt stored value. */
  HEX_LENGTH: 64,
  /** Byte length of a SHA-256 digest, i.e. the width `timingSafeEqual` compares. */
  BYTE_LENGTH: 32,
  /**
   * `$2a$` / `$2b$` / `$2y$` — the bcrypt Modular Crypt Format prefix. Stored hashes
   * carrying it predate this change and are verified by the fallback, then rewritten.
   */
  LEGACY_BCRYPT_PREFIX: '$2',
} as const;

// ── M4 follow-up — token endpoint limiter keying ──────────────────────────────
/**
 * Key namespaces inside the `token` limiter scope. Short on purpose: this is a Redis key
 * component on the hot path, and the two kinds only have to be mutually unambiguous.
 */
export const RATE_LIMIT_KEY_KINDS = {
  /** Keyed by the `client_id` the caller presented. */
  CLIENT: 'c',
  /** Keyed by source address, for a caller that presented no `client_id` at all. */
  IP: 'i',
} as const;

/** Hex characters of the client-id digest kept in the limiter key. */
export const RATE_LIMIT_KEY_HASH_LENGTH = 32;

/**
 * IPv6 is allocated to end sites in blocks (a /64 is the smallest normal subnet), so
 * keying a limiter on a full /128 lets anyone with a residential prefix mint a fresh
 * budget per request. Buckets to the first four hextets.
 */
export const IPV6_SUBNET_HEXTETS = 4;

export const TOKEN_RATE_LIMITS = {
  /**
   * Per presented `client_id`. Deliberately far looser than the old per-IP number: a
   * `client_id` is an *identified* caller, so abuse is attributable and answerable by
   * suspension, and the budget no longer has to be small enough to contain an anonymous
   * attacker. This is the dimension brute force actually runs in — guessing a secret or
   * an authorization code means targeting one specific client — so it is also the
   * dimension worth counting.
   */
  PER_CLIENT: { windowMs: 15 * MILLISECONDS.MINUTE, max: 600 },
  /**
   * Per source address, for requests presenting no `client_id`. Deliberately the original
   * `RATE_LIMITS.TOKEN` number rather than a copy of it: such a request can never succeed
   * (it is `invalid_client` before any lookup happens), so this bucket only ever holds
   * malformed or probing traffic and there is no legitimate load to make room for.
   */
  PER_IP: RATE_LIMITS.TOKEN,
} as const;
