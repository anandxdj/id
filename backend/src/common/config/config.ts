import { Env, DEV_DEFAULTS } from './env';
import { SECONDS, SIGNING_KEY } from '../constants/index.constants';

/**
 * The single frozen configuration surface. Consume it as `Config.jwt.accessSecret`,
 * never `process.env.JWT_ACCESS_SECRET`.
 *
 * Each accessor is a getter over a memoised, deep-frozen object, so:
 *   - nothing reads the environment at module-load time (imports stay side-effect free,
 *     which is what lets the integration tests set env vars before touching a route), and
 *   - no consumer can mutate shared config at runtime.
 */

const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
};

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const build = () => {
  const env = Env.load();

  const frontendUrl = env.FRONTEND_URL ? stripTrailingSlash(env.FRONTEND_URL) : undefined;

  // Explicit allowlist wins; FRONTEND_URL is the single-origin convenience path.
  // Never falls back to a reflect-any-origin value — production requires one of the two
  // to be set (see the CORS check in env.ts), and dev gets localhost rather than `true`.
  const corsOrigins = (() => {
    const explicit = Env.toList(env.CORS_ORIGINS);
    if (explicit.length > 0) return explicit;
    if (frontendUrl) return [frontendUrl];
    return env.NODE_ENV === 'production' ? [] : [DEV_DEFAULTS.CORS_ORIGIN];
  })();

  const usingDevSecrets =
    env.JWT_ACCESS_SECRET === DEV_DEFAULTS.JWT_ACCESS_SECRET ||
    env.JWT_REFRESH_SECRET === DEV_DEFAULTS.JWT_REFRESH_SECRET;

  const issuer = env.OIDC_ISSUER
    ? stripTrailingSlash(env.OIDC_ISSUER)
    : `http://localhost:${env.PORT}`;

  const loginRedirectBase = stripTrailingSlash(
    env.OIDC_LOGIN_REDIRECT_BASE ?? frontendUrl ?? 'http://localhost:3000',
  );

  return deepFreeze({
    server: {
      env: env.NODE_ENV,
      isProduction: env.NODE_ENV === 'production',
      isTest: env.NODE_ENV === 'test',
      port: env.PORT,
      trustProxyHops: env.TRUST_PROXY_HOPS,
      shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
      logLevel: env.LOG_LEVEL,
      /** True when JWT secrets fell back to the dev sentinels. Impossible in production. */
      usingDevSecrets,
    },

    mongo: {
      uri: env.MONGO_URI,
      dbName: env.MONGO_DB_NAME,
    },

    redis: {
      url: env.REDIS_URL,
    },

    retention: {
      eventDays: env.EVENT_RETENTION_DAYS,
      eventSeconds: env.EVENT_RETENTION_DAYS * SECONDS.DAY,
    },

    web: {
      frontendUrl,
      corsOrigins,
      loginRedirectBase,
      consentRedirectBase: stripTrailingSlash(
        env.OIDC_CONSENT_REDIRECT_BASE ?? frontendUrl ?? loginRedirectBase,
      ),
    },

    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },

    cookie: {
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN,
    },

    oidc: {
      issuer,
      /**
       * @deprecated Superseded by the M4 keyring: `kid` is now the RFC 7638 thumbprint
       * of the key it names, derived rather than configured. Retained so an existing
       * `.env` does not fail validation; nothing reads it. Remove with the M6 cleanup.
       */
      keyId: env.OIDC_KEY_ID,
      privateKeyPem: env.OIDC_RSA_PRIVATE_KEY,
      privateKeyPath: env.OIDC_RSA_PRIVATE_KEY_PATH,
      // ── M4 — signing keyring (additive) ──────────────────────────────────
      /** KEK for the AES-256-GCM envelope around stored private keys. */
      keyEncryptionKey: env.OIDC_KEY_ENCRYPTION_KEY ?? DEV_DEFAULTS.OIDC_KEY_ENCRYPTION_KEY,
      /** Overlap window during which a rotated-out key still verifies and stays in JWKS. */
      keyRotationOverlapSeconds:
        env.OIDC_KEY_ROTATION_OVERLAP_SECONDS ?? SIGNING_KEY.DEFAULT_OVERLAP_SECONDS,
    },

    connectors: {
      /** Optional allowlist restricting which configured connectors are exposed. */
      enabled: Env.toList(env.AUTH_CONNECTORS),
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },

    password: {
      /**
       * Argon2id cost. Overridable per deployment precisely so that raising it is a
       * config change plus a rolling restart, not a release — and
       * `PasswordService.needsRehash` turns the raise into an actual upgrade of stored
       * hashes on each user's next successful login.
       */
      argon2: {
        memoryCost: env.ARGON2_MEMORY_KIB,
        timeCost: env.ARGON2_TIME_COST,
        parallelism: env.ARGON2_PARALLELISM,
      },
      /** `undefined` means libuv's default of 4. See UV_THREADPOOL_MIN_FOR_ARGON2. */
      uvThreadpoolSize: env.UV_THREADPOOL_SIZE,
    },

    email: {
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
      get configured(): boolean {
        return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
      },
    },

    // M3
    sessions: {
      /** See REFRESH_REUSE_REVOKES_ALL_SESSIONS in env.ts for the trade-off. */
      reuseRevokesAllSessions: env.REFRESH_REUSE_REVOKES_ALL_SESSIONS,
    },

    seed: {
      adminEmail: env.SEED_ADMIN_EMAIL,
      adminName: env.SEED_ADMIN_NAME,
      adminPassword: env.SEED_ADMIN_PASSWORD,
    },
  });
};

type AppConfig = ReturnType<typeof build>;

let cached: AppConfig | undefined;

const load = (): AppConfig => {
  if (!cached) cached = build();
  return cached;
};

export const Config = {
  get server() {
    return load().server;
  },
  get mongo() {
    return load().mongo;
  },
  get redis() {
    return load().redis;
  },
  get retention() {
    return load().retention;
  },
  get web() {
    return load().web;
  },
  get jwt() {
    return load().jwt;
  },
  get cookie() {
    return load().cookie;
  },
  get oidc() {
    return load().oidc;
  },
  get connectors() {
    return load().connectors;
  },
  get password() {
    return load().password;
  },
  get email() {
    return load().email;
  },
  // M3
  get sessions() {
    return load().sessions;
  },
  get seed() {
    return load().seed;
  },

  /** Force validation now so a bad deployment dies at boot rather than on first request. */
  validate(): void {
    load();
  },

  /** Test-only: re-derive from a mutated `process.env`. */
  reload(): void {
    cached = undefined;
    Env.reset();
  },
};
