import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

export interface SessionTokenPayload {
  id: string;
  sid: string;
  role?: string;
}

const accessSecret = (): string => {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error('JWT_ACCESS_SECRET is not set');
  return s;
};

const refreshSecret = (): string => {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error('JWT_REFRESH_SECRET is not set');
  return s;
};

export const generateAccessToken = (payload: SessionTokenPayload): string =>
  jwt.sign(payload, accessSecret(), {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as SignOptions['expiresIn'],
  });

export const verifyAccessToken = (token: string): SessionTokenPayload =>
  jwt.verify(token, accessSecret()) as SessionTokenPayload;

export const generateRefreshToken = (payload: SessionTokenPayload): string =>
  jwt.sign(payload, refreshSecret(), {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  });

export const verifyRefreshToken = (token: string): SessionTokenPayload =>
  jwt.verify(token, refreshSecret()) as SessionTokenPayload;
