import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { errorHandler } from './common/middleware/errorHandler';
import { apiLimiter } from './common/middleware/rateLimit';
import { ApiError } from './common/utils/ApiError';
import authRoutes from './modules/auth/auth.routes';
import oauthRoutes from './modules/oauth/oauth.routes';
import oauthApiRoutes from './modules/oauth/oauth-api.routes';
import { getOpenIdConfiguration } from './modules/oauth/oidc-discovery.controller';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    const dbOk = mongoose.connection.readyState === 1;
    res.status(200).json({
      status: 'ok',
      database: dbOk ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  // ── OIDC discovery (well-known, must sit at the root, no /api prefix) ─────────
  app.get('/.well-known/openid-configuration', getOpenIdConfiguration);

  // ── API + OIDC routes ───────────────────────────────────────────────────────
  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/oauth', oauthApiRoutes);
  app.use('/oauth', oauthRoutes);

  // Final fallthrough — any unmatched route is a 404 (version-agnostic, no path pattern).
  app.use((req, _res, next) => {
    next(ApiError.notFound(`Route ${req.originalUrl} not found`));
  });

  app.use(errorHandler);

  return app;
}
