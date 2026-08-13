import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { Config } from '../config/config';

export interface SessionTokenPayload {
  id: string;
  sid: string;
  role?: string;
}

// Secrets are validated at boot by the config layer (non-empty, distinct, and ≥32 chars
// in production), so there is no per-call presence check to make here.

export const generateAccessToken = (payload: SessionTokenPayload): string =>
  jwt.sign(payload, Config.jwt.accessSecret, {
    expiresIn: Config.jwt.accessExpiresIn as SignOptions['expiresIn'],
  });

export const verifyAccessToken = (token: string): SessionTokenPayload =>
  jwt.verify(token, Config.jwt.accessSecret) as SessionTokenPayload;

/**
 * Claims carried by a refresh token, all of them explicit.
 *
 * `iat` and `exp` are supplied by the caller rather than derived from an `expiresIn`
 * string, for two reasons that both matter since M3:
 *
 *  - **The refresh window is absolute, not sliding.** A rotated child inherits its
 *    parent's `exp`, so signing each generation with a fresh `expiresIn` would silently
 *    extend the family every time the client refreshed — an unbounded session.
 *  - **The token is a deterministic function of its stored record.** Given `jti`, `iat`,
 *    `exp`, the sid and the secret, the exact token string can be reproduced. That is
 *    what lets the grace-window path hand a concurrent refresh the *same* successor it
 *    already issued, without ever storing a token in plaintext. See
 *    `refresh-token.service.ts`, which verifies the reproduction against the stored hash
 *    rather than assuming it.
 */
export interface RefreshTokenClaims extends SessionTokenPayload {
  /** Public, loggable id for this token. The token itself never appears in a log. */
  jti: string;
  /** Seconds since the epoch, matching the stored `issuedAt`. */
  iat: number;
  /** Seconds since the epoch, matching the stored `expiresAt`. */
  exp: number;
}

export const generateRefreshToken = (claims: RefreshTokenClaims): string =>
  jwt.sign(claims, Config.jwt.refreshSecret);

export const verifyRefreshToken = (token: string): RefreshTokenClaims =>
  jwt.verify(token, Config.jwt.refreshSecret) as RefreshTokenClaims;
