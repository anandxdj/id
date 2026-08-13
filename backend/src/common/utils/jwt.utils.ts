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

export const generateRefreshToken = (payload: SessionTokenPayload): string =>
  jwt.sign(payload, Config.jwt.refreshSecret, {
    expiresIn: Config.jwt.refreshExpiresIn as SignOptions['expiresIn'],
  });

export const verifyRefreshToken = (token: string): SessionTokenPayload =>
  jwt.verify(token, Config.jwt.refreshSecret) as SessionTokenPayload;
