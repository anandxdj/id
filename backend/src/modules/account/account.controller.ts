import type { Request, Response } from 'express';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ApiError } from '../../common/utils/ApiError';
import { reqContext } from '../events/event.service';
import * as accountService from './account.service';

const requireUser = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized('Not authenticated');
  return req.user;
};

export const listApps = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const apps = await accountService.listApps(user.id);
  ApiResponse.ok(res, 'Authorized apps', apps);
};

export const revokeApp = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const result = await accountService.revokeApp(user.id, req.params.clientId!, reqContext(req));
  ApiResponse.ok(res, 'App access revoked', result);
};

export const listSessions = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const sessions = await accountService.listSessions(user.id, user.sessionId);
  ApiResponse.ok(res, 'Active sessions', sessions);
};

export const revokeSession = async (req: Request, res: Response) => {
  const user = requireUser(req);
  await accountService.revokeSession(user.id, req.params.sid!, reqContext(req));
  ApiResponse.ok(res, 'Session revoked');
};

export const revokeAllSessions = async (req: Request, res: Response) => {
  const user = requireUser(req);
  // Keep the caller's current session alive; sign out everywhere else.
  const count = await accountService.revokeAllSessions(user.id, user.sessionId, reqContext(req));
  ApiResponse.ok(res, 'Signed out of other sessions', { revoked: count });
};

export const getProfile = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const profile = await accountService.getProfile(user.id);
  ApiResponse.ok(res, 'Profile', profile);
};

export const updateProfile = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const profile = await accountService.updateProfile(user.id, req.body);
  ApiResponse.ok(res, 'Profile updated', profile);
};
