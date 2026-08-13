import { z } from 'zod';

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

    // ── Social connectors ────────────────────────────────────────────────────
    AUTH_CONNECTORS: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // ── Email (M2) ───────────────────────────────────────────────────────────
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),

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
      if (!env.COOKIE_SECURE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['COOKIE_SECURE'],
          message: 'COOKIE_SECURE must be true in production — the refresh cookie carries a session credential',
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
