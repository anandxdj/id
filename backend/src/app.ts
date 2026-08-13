import express from 'express';
import cors from 'cors';
import type { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { errorHandler } from './common/middleware/errorHandler';
import { requestContext } from './common/middleware/requestContext';
import { apiLimiter } from './common/middleware/rateLimit';
import { ApiError } from './common/utils/ApiError';
import { Config } from './common/config/config';
import { Logger } from './common/logger/index.logger';
import { API, BODY_LIMITS, ROUTE_SEGMENTS } from './common/constants/index.constants';
import authRoutes from './modules/auth/auth.routes';
import accountRoutes from './modules/account/account.routes';
import adminRoutes from './modules/admin/admin.routes';
import oauthRoutes from './modules/oauth/oauth.routes';
import oauthApiRoutes from './modules/oauth/oauth-api.routes';
import { getOpenIdConfiguration } from './modules/oauth/oidc-discovery.controller';

/**
 * Credentialed CORS against an explicit allowlist. The previous
 * `origin: process.env.FRONTEND_URL || true` was a live vulnerability: with
 * `credentials: true`, `origin: true` reflects the caller's own Origin, so an unset
 * env var silently granted every site on the internet cookie-authenticated access to
 * the identity API. `Config` now refuses to boot with an empty allowlist.
 */
const buildCorsOptions = (): CorsOptions => {
  const allowlist = new Set(Config.web.corsOrigins);

  return {
    origin(origin, callback) {
      // No Origin header: same-origin navigations, curl, server-to-server. Nothing to
      // reflect, so there is no CSRF surface to open here.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowlist.has(origin.replace(/\/+$/, ''))) {
        callback(null, true);
        return;
      }
      Logger.warn('CORS origin rejected', { origin });
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  };
};

/** Mount a router on both the versioned path and the legacy unversioned alias. */
const mountVersioned = (
  app: express.Express,
  segment: string,
  router: express.Router,
): void => {
  app.use(`${API.PREFIX}/${segment}`, router);
  app.use(`${API.LEGACY_PREFIX}/${segment}`, router);
};

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', Config.server.trustProxyHops);

  app.use(requestContext);

  app.use(
    helmet({
      // Pure JSON API: a CSP has nothing to protect here, and the default
      // same-origin resource policy blocks legitimate cross-origin API reads.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: BODY_LIMITS.JSON }));
  // `extended: false` — the OAuth token endpoint takes flat form bodies; deep object
  // parsing is attack surface with no legitimate use here.
  app.use(express.urlencoded({ extended: false, limit: BODY_LIMITS.URLENCODED }));
  app.use(cookieParser());

  // ── Probes ──────────────────────────────────────────────────────────────────
  // Liveness: is the process up? Must not depend on downstreams, or a brief DB blip
  // makes the orchestrator kill otherwise-healthy pods.
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });

  // Readiness: should this instance receive traffic? This one *does* check the DB, so a
  // pod with a dead connection is pulled from rotation instead of serving 500s.
  app.get('/ready', (_req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;
    res.status(dbConnected ? 200 : 503).json({
      status: dbConnected ? 'ready' : 'not_ready',
      database: dbConnected ? 'connected' : 'disconnected',
    });
  });

  // ── OIDC discovery (well-known must sit at the root, unversioned per spec) ───
  app.get('/.well-known/openid-configuration', getOpenIdConfiguration);

  // ── API routes ──────────────────────────────────────────────────────────────
  // Mounted once at `/api`, which already prefixes `/api/v1` — mounting on both would
  // double-count every versioned request against the same window.
  app.use(API.LEGACY_PREFIX, apiLimiter);

  mountVersioned(app, ROUTE_SEGMENTS.AUTH, authRoutes);
  mountVersioned(app, ROUTE_SEGMENTS.ACCOUNT, accountRoutes);
  mountVersioned(app, ROUTE_SEGMENTS.ADMIN, adminRoutes);
  mountVersioned(app, ROUTE_SEGMENTS.OAUTH_API, oauthApiRoutes);

  // Protocol endpoints (/oauth/authorize, /oauth/token, …) stay unversioned: their
  // URLs are published in the discovery document and baked into every registered
  // client, so they are part of the OIDC contract rather than our API surface.
  // They sit outside the /api mount, so the backstop limiter is applied explicitly
  // here; /token carries its own stricter limiter in the router.
  app.use('/oauth', apiLimiter, oauthRoutes);

  // Final fallthrough — any unmatched route is a 404 (version-agnostic, no path pattern).
  app.use((req, _res, next) => {
    next(ApiError.notFound(`Route ${req.originalUrl} not found`));
  });

  app.use(errorHandler);

  return app;
}
