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
} as const;

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
  /** Token endpoint — a client-secret and authorization-code oracle. */
  TOKEN: { windowMs: 15 * MILLISECONDS.MINUTE, max: 120 },
  /** Endpoints that send email or mint action tokens. */
  SENSITIVE: { windowMs: 60 * MILLISECONDS.MINUTE, max: 10 },
} as const;

// ── Login throttle (M2) ───────────────────────────────────────────────────────
export const LOGIN_THROTTLE = {
  MAX_ATTEMPTS: 5,
  LOCK_MS: 15 * MILLISECONDS.MINUTE,
  /**
   * Sliding window. The reference implementation had no decay at all, so five
   * failures bricked an account permanently — the lock is evaluated from
   * `lockedUntil` only, and the counter document self-expires after this window.
   */
  WINDOW_MS: 60 * MILLISECONDS.MINUTE,
} as const;

// ── Crypto ────────────────────────────────────────────────────────────────────
export const CRYPTO = {
  /** Argon2id parameters (OWASP-current). */
  ARGON2: { memoryCost: 65_536, timeCost: 3, parallelism: 4 },
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
  },
  SIGNING_ALG: 'RS256',
} as const;

// ── Field caps ────────────────────────────────────────────────────────────────
export const FIELD_LIMITS = {
  USER_AGENT: 400,
  IP_ADDRESS: 45,
  DEVICE_NAME: 200,
  NAME: 100,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
} as const;

// ── Pagination ────────────────────────────────────────────────────────────────
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
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
