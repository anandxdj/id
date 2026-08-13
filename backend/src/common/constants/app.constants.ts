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

export const TOKEN_ENDPOINT_AUTH_METHODS = {
  CLIENT_SECRET_BASIC: 'client_secret_basic',
  CLIENT_SECRET_POST: 'client_secret_post',
  NONE: 'none',
} as const;

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

// ── Datastore key prefixes ────────────────────────────────────────────────────
/**
 * Redis keyspaces. These disappear in M1 as each becomes a TTL-indexed Mongo
 * collection; they are centralised here so the migration is a mechanical
 * find-and-replace against one file instead of 20 inline string literals.
 */
export const REDIS_KEYS = {
  SESSION: 'session',
  ACCESS_TOKEN: 'access_token',
  USER_CLIENT_TOKENS: 'user_client_tokens',
  AUTH_REQUEST: 'auth_req',
  AUTH_CODE: 'auth_code',
  OAUTH_STATE: 'oauth_state',
} as const;

export const COLLECTIONS = {
  USER: 'User',
  IDENTITY: 'Identity',
  CONSENT: 'Consent',
  OAUTH_CLIENT: 'OAuthClient',
  AUTH_EVENT: 'AuthEvent',
} as const;

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
  /** OIDC access token (opaque, Redis/Mongo-backed). */
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

/** How stale `lastSeenAt` may get before we spend a write on it. */
export const LAST_SEEN_THROTTLE_MS = 60 * MILLISECONDS.SECOND;

// ── Cookies ───────────────────────────────────────────────────────────────────
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;

export const COOKIE_SAME_SITE = 'lax' as const;

// ── Rate limiting ─────────────────────────────────────────────────────────────
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
    AUTH_CODE: 32,
    ACCESS_TOKEN: 32,
    REFRESH_TOKEN: 64,
    ACTION_TOKEN: 32,
    STATE: 16,
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
