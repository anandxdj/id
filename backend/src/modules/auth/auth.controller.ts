import type { Request, Response, CookieOptions } from 'express';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ApiError } from '../../common/utils/ApiError';
import * as authService from './auth.service';

const isProd = () => process.env.NODE_ENV === 'production';

const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: 'lax',
  path: '/',
  maxAge: authService.REFRESH_TTL_SECONDS * 1000,
});

export const register = async (req: Request, res: Response) => {
  const user = await authService.register(req.body);
  ApiResponse.created(res, 'Account created', { user });
};

export const login = async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  res.cookie('refreshToken', refreshToken, refreshCookieOptions());
  ApiResponse.ok(res, 'Logged in', { user, accessToken });
};

export const refreshToken = async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken as string | undefined;
  const { accessToken } = await authService.refresh(token);
  ApiResponse.ok(res, 'Token refreshed', { accessToken });
};

export const logout = async (req: Request, res: Response) => {
  if (req.user) await authService.logout(req.user.id, req.user.sessionId);
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('accessToken', { path: '/' });
  ApiResponse.ok(res, 'Logged out');
};

export const getMe = async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Not authenticated');
  const user = await authService.getMe(req.user.id);
  ApiResponse.ok(res, 'Current user', user);
};
