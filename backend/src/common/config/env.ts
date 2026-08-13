import { z } from 'zod';
import { ARGON2_LIMITS, CRYPTO } from '../constants/index.constants';

/**
 * The ONE place `process.env` is read in this codebase (tests and seed scripts aside).
 * Everything else consumes the frozen `Config` object in `./config`.
 *
 * Validation is lazy-but-memoised: `loadEnv()` parses on first call and caches.
 * `index.ts` calls it during boot so a misconfigured deployment dies immediately
 * instead of 500-ing on the first login.
 */

const PLACEHOLDER_SECRETS = new Set([
  'change-me',
  'change-me-access',
  'change-me-refresh',
  'secret',
  'changeme',
]);

/**
 * Sentinels used when a non-secret-critical variable is omitted outside production.
 * They exist so local dev and the test suite boot without a .env, while `superRefine`
 * can still recognise "this was never configured" and refuse to start in production.
 */
export const DEV_DEFAULTS = {
  MONGO_URI: 'mongodb://127.0.0.1:27017',
  CORS_ORIGIN: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'dev-only-access-secret-not-for-production',
  JWT_REFRESH_SECRET: 'dev-only-refresh-secret-not-for-production',
  /**
   * M4. Deterministic on purpose: every dev machine and test process must derive the
   * same KEK, or a signing key persisted by one run cannot be decrypted by the next.
   * Production refuses to boot without a real value (see the superRefine below).
   */
  OIDC_KEY_ENCRYPTION_KEY: 'dev-only-oidc-kek-not-for-production',
} as const;

const DEV_SENTINELS = new Set<string>(Object.values(DEV_DEFAULTS));

/** `"a, b/, c"` -> `['a', 'b', 'c']`, trailing slashes stripped. */
const csvList = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/\/+$/, ''))
    .filter(Boolean);

/**
 * `z.coerce.boolean()` is a trap — it uses JS truthiness, so the string "false"
 * coerces to `true`. Parse the literal instead.
 */
const booleanish = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false', '1', '0'])
    .default(defaultValue)
    .transform((value) => value === 'true' || value === '1');

const envSchema = z
  .object({
    // ── Server ───────────────────────────────────────────────────────────────
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(4000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),

    // ── Datastores ───────────────────────────────────────────────────────────
    MONGO_URI: z.string().min(1).default(DEV_DEFAULTS.MONGO_URI),
    MONGO_DB_NAME: z.string().min(1).optional(),
    // Cache and counters only — see `common/config/redis.ts`. Nothing authoritative
    // lives here, so an unreachable Redis degrades rate-limit accuracy and nothing else.
    REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),

    // ── Retention ────────────────────────────────────────────────────────────
    EVENT_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(90),

    // ── Frontend / CORS ──────────────────────────────────────────────────────
    FRONTEND_URL: z.string().url().optional(),
    // Comma-separated allowlist. Fails closed: required when NODE_ENV=production.
    CORS_ORIGINS: z.string().optional(),
    OIDC_LOGIN_REDIRECT_BASE: z.string().url().optional(),
    OIDC_CONSENT_REDIRECT_BASE: z.string().url().optional(),

    // ── First-party session JWTs (NOT the OIDC ID token) ─────────────────────
    JWT_ACCESS_SECRET: z.string().min(1).default(DEV_DEFAULTS.JWT_ACCESS_SECRET),
    JWT_REFRESH_SECRET: z.string().min(1).default(DEV_DEFAULTS.JWT_REFRESH_SECRET),
    JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('7d'),
    COOKIE_SECURE: booleanish('false'),
    COOKIE_DOMAIN: z.string().min(1).optional(),

    // ── OIDC issuer + signing key ────────────────────────────────────────────
    OIDC_ISSUER: z.string().url().optional(),
    OIDC_KEY_ID: z.string().min(1).default('oidc-1'),
    OIDC_RSA_PRIVATE_KEY: z.string().min(1).optional(),
    OIDC_RSA_PRIVATE_KEY_PATH: z.string().min(1).optional(),

    // ── OIDC signing-key ring (M4) ───────────────────────────────────────────
    /**
     * Key-encryption key for the AES-256-GCM envelope around every stored private
     * signing key. Required in production: without it a database dump hands over the
     * ability to mint ID tokens for every user of every relying party.
     */
    OIDC_KEY_ENCRYPTION_KEY: z.string().min(1).optional(),
    /**
     * How long a rotated-out key keeps verifying and stays published in JWKS. Must
     * exceed the longest-lived signed artefact plus RP JWKS cache lifetime.
     */
    OIDC_KEY_ROTATION_OVERLAP_SECONDS: z.coerce.number().int().positive().optional(),

    // ── Social connectors ────────────────────────────────────────────────────
    AUTH_CONNECTORS: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // ── Password hashing (Argon2id) ──────────────────────────────────────────
    // Cost is a per-deployment tuning decision — a box that must sustain 50 logins/s
    // cannot use the same memory cost as one serving 5 — so it is configuration, with
    // the OWASP-current values as defaults. Bounded on both sides: a mistyped floor
    // silently weakens every password, and an over-large value OOMs under a burst.
    ARGON2_MEMORY_KIB: z.coerce
      .number()
      .int()
      .min(ARGON2_LIMITS.MEMORY_KIB.MIN)
      .max(ARGON2_LIMITS.MEMORY_KIB.MAX)
      .default(CRYPTO.ARGON2.memoryCost),
    ARGON2_TIME_COST: z.coerce
      .number()
      .int()
      .min(ARGON2_LIMITS.TIME_COST.MIN)
      .max(ARGON2_LIMITS.TIME_COST.MAX)
      .default(CRYPTO.ARGON2.timeCost),
    ARGON2_PARALLELISM: z.coerce
      .number()
      .int()
      .min(ARGON2_LIMITS.PARALLELISM.MIN)
      .max(ARGON2_LIMITS.PARALLELISM.MAX)
      .default(CRYPTO.ARGON2.parallelism),
    /**
     * Read, never written: libuv fixes its pool size the first time the pool is used,
     * long before this schema is parsed, so setting it from here would do nothing.
     * It is surfaced so `PasswordService.warmup()` can tell the operator at boot that
     * Argon2 is about to starve every other libuv consumer.
     */
    UV_THREADPOOL_SIZE: z.coerce.number().int().positive().max(1024).optional(),

    // ── Email (M2) ───────────────────────────────────────────────────────────
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),

    // ── Sessions / refresh tokens (M3) ───────────────────────────────────────
    /**
     * Blast radius of refresh-token reuse detection.
     *
     * Default (`false`): kill the offending family and the session it belongs to. That is
     * the proportionate response — the compromise is scoped to one login, and a false
     * positive costs the user one device rather than all of them.
     *
     * `true` is the paranoid posture: any reuse anywhere signs the account out
     * everywhere. Defensible for a high-value tenant, and wrong as a default, because it
     * makes every false positive catastrophic and punishes a user whose other devices are
     * demonstrably fine. It is a setting rather than a hardcode precisely because which
     * one is right depends on what the deployment is protecting.
     */
    REFRESH_REUSE_REVOKES_ALL_SESSIONS: booleanish('false'),

    // ── Seed ─────────────────────────────────────────────────────────────────
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_NAME: z.string().min(1).optional(),
    SEED_ADMIN_PASSWORD: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    const isProd = env.NODE_ENV === 'production';

    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      const value = env[key];

      if (DEV_SENTINELS.has(value)) {
        if (isProd) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required in production — generate one with \`openssl rand -hex 32\``,
          });
        }
        // Outside production the sentinel is intentional; skip the remaining checks so
        // a bare `pnpm test` does not need a .env file.
        continue;
      }

      if (PLACEHOLDER_SECRETS.has(value.toLowerCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is still a placeholder value — generate one with \`openssl rand -hex 32\``,
        });
      }
      if (isProd && value.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must be at least 32 characters in production`,
        });
      }
    }

    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      });
    }

    // Fail closed on CORS. An unset allowlist used to mean `origin: true`, which with
    // `credentials: true` reflects any caller's Origin — i.e. every site on the
    // internet gets credentialed access to the identity API.
    if (isProd && csvList(env.CORS_ORIGINS).length === 0 && !env.FRONTEND_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message:
          'Set CORS_ORIGINS (comma-separated) or FRONTEND_URL — the allowlist must never be empty in production',
      });
    }

    if (isProd) {
      if (env.MONGO_URI === DEV_DEFAULTS.MONGO_URI) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MONGO_URI'],
          message: 'MONGO_URI is required in production',
        });
      }
      if (!env.OIDC_ISSUER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OIDC_ISSUER'],
          message: 'OIDC_ISSUER is required in production — it is baked into every issued token',
        });
      }
      if (!env.OIDC_RSA_PRIVATE_KEY && !env.OIDC_RSA_PRIVATE_KEY_PATH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OIDC_RSA_PRIVATE_KEY'],
          message:
            'Provide OIDC_RSA_PRIVATE_KEY or OIDC_RSA_PRIVATE_KEY_PATH in production — ephemeral keys differ per replica, so tokens signed by one instance fail verification on another',
        });
      }
      // M4: the signing keyring is encrypted at rest, and the KEK is the only thing
      // standing between a database dump and the ability to mint tokens for anyone.
      if (!env.OIDC_KEY_ENCRYPTION_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OIDC_KEY_ENCRYPTION_KEY'],
          message:
            'OIDC_KEY_ENCRYPTION_KEY is required in production — stored signing keys are AES-256-GCM encrypted with it, and without it a database dump can mint tokens for every user',
        });
      }
      if (!env.COOKIE_SECURE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['COOKIE_SECURE'],
          message: 'COOKIE_SECURE must be true in production — the refresh cookie carries a session credential',
        });
      }
      // Email became load-bearing in M2: a password-reset link is the only account
      // recovery path there is. Booting production without a provider ships a register
      // page that mints accounts nobody can ever verify or recover.
      if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RESEND_API_KEY'],
          message:
            'Set RESEND_API_KEY and EMAIL_FROM in production — email verification and password reset have no fallback delivery path',
        });
      }
    }
  });

export type RawEnv = z.infer<typeof envSchema>;

let cached: Readonly<RawEnv> | undefined;

export const Env = {
  /** Parse + freeze on first call, memoised thereafter. Throws with every issue at once. */
  load(): Readonly<RawEnv> {
    if (cached) return cached;

    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${issues}`);
    }

    cached = Object.freeze(parsed.data);
    return cached;
  },

  /** Test-only: drop the memoised value so a mutated `process.env` is re-read. */
  reset(): void {
    cached = undefined;
  },

  /** Exposed for the config layer so CSV parsing lives in exactly one place. */
  toList: csvList,
};
