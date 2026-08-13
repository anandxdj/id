import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { validate } from '../../common/middleware/validate.middleware';
import { authLimiter, sensitiveLimiter } from '../../common/middleware/rateLimit';
import { authenticate } from './auth.middleware';
import { registerSchema } from './dto/register.schema';
import { loginSchema } from './dto/login.schema';
import {
  emailOnlySchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './dto/action-token.schema';
import * as controller from './auth.controller';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(controller.register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(controller.login));
router.post('/refresh-token', asyncHandler(controller.refreshToken));
router.post('/logout', authenticate, asyncHandler(controller.logout));
router.get('/me', authenticate, asyncHandler(controller.getMe));

// ── Mailbox-authenticated flows (M2) ───────────────────────────────────────────
// The three endpoints that *mint* a token and send mail carry `sensitiveLimiter`, not
// `authLimiter`: unbounded, they are a mail-bomb primitive pointed at a third party's inbox,
// and the budget for that has to be far tighter than for a login attempt.
//
// Redemption endpoints carry `authLimiter` instead. They send no mail, but a token is a
// guessable-in-principle secret and an unbounded redemption endpoint is an offline oracle
// with online cost.
router.post(
  '/verify-email',
  authLimiter,
  validate(verifyEmailSchema),
  asyncHandler(controller.verifyEmail),
);
router.post(
  '/resend-verification',
  sensitiveLimiter,
  validate(emailOnlySchema),
  asyncHandler(controller.resendVerification),
);
router.post(
  '/forgot-password',
  sensitiveLimiter,
  validate(emailOnlySchema),
  asyncHandler(controller.forgotPassword),
);
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  asyncHandler(controller.resetPassword),
);

/**
 * Development affordance: read the mail that was suppressed for want of a provider.
 *
 * Always mounted, and always gated inside the controller on `DevOutbox.enabled` — which is
 * false in production and false whenever a provider *is* configured. Mounting conditionally
 * would make the route's existence depend on config evaluated at import time, which is
 * exactly the module-load side effect the config layer is built to avoid; a 404 from the
 * handler is the same answer with none of that.
 */
router.get('/dev/outbox', asyncHandler(controller.devOutbox));

// ── Social connectors (Google, GitHub, …) ──────────────────────────────────────
router.get('/connectors', asyncHandler(controller.listConnectors));
router.get('/oauth/:provider', authLimiter, asyncHandler(controller.oauthStart));
router.get('/oauth/:provider/callback', asyncHandler(controller.oauthCallback));

export default router;
