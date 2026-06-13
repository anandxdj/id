import rateLimit from 'express-rate-limit';

/** Loose global backstop on the whole API surface. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Strict limiter for brute-forceable / token-guessing endpoints (login, register, token grants). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, try again later' },
});
