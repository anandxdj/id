import rateLimit from 'express-rate-limit';
import type { Options } from 'express-rate-limit';
import { ERROR_CODES, ERROR_MESSAGES, RATE_LIMITS } from '../constants/index.constants';

/**
 * NOTE ON STORE: these use express-rate-limit's default in-process memory store, so
 * limits are per-replica — N instances means N× the effective ceiling. That was
 * previously masked by Redis being available; with Redis removed (M1) the options are
 * a Mongo-backed store or enforcement at the reverse proxy. Until that decision lands,
 * treat these as a safety net, not a security boundary, and keep a hard limit at the edge.
 */

const base = (limit: { windowMs: number; max: number }, message: string): Partial<Options> => ({
  windowMs: limit.windowMs,
  limit: limit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message, code: ERROR_CODES.TOO_MANY_REQUESTS },
});

/** Loose global backstop on the whole API surface. */
export const apiLimiter = rateLimit(base(RATE_LIMITS.API, ERROR_MESSAGES.TOO_MANY_REQUESTS));

/** Strict limiter for brute-forceable credential endpoints (login, register). */
export const authLimiter = rateLimit(base(RATE_LIMITS.AUTH, ERROR_MESSAGES.TOO_MANY_REQUESTS));

/**
 * The OAuth token endpoint. Previously unthrottled: it is simultaneously a
 * client-secret oracle and an authorization-code oracle, and it sits outside the
 * `/api` mount that `apiLimiter` covers.
 */
export const tokenLimiter = rateLimit(base(RATE_LIMITS.TOKEN, ERROR_MESSAGES.TOO_MANY_REQUESTS));

/**
 * Endpoints that send mail or mint action tokens (verification, password reset).
 * Unbounded, these are a mail-bomb primitive aimed at a third party's inbox.
 */
export const sensitiveLimiter = rateLimit(
  base(RATE_LIMITS.SENSITIVE, ERROR_MESSAGES.TOO_MANY_REQUESTS),
);
