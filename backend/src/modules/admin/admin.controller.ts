import type { Request, Response } from 'express';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ApiError } from '../../common/utils/ApiError';
import { PAGINATION, SUCCESS_MESSAGES } from '../../common/constants/index.constants';
import { reqContext } from '../events/event.service';
import type { EventType } from '../events/event.types';
import * as adminService from './admin.service';
import type { AdminActionCtx } from './admin.service';

const adminCtx = (req: Request): AdminActionCtx => {
  if (!req.user) throw ApiError.unauthorized('Not authenticated');
  return { actorUserId: req.user.id, actorRole: req.user.role, ...reqContext(req) };
};

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const int = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// ── Users ──────────────────────────────────────────────────────────────────────
export const listUsers = async (req: Request, res: Response) => {
  const data = await adminService.listUsers({
    search: str(req.query.search),
    page: int(req.query.page, PAGINATION.DEFAULT_PAGE),
    limit: int(req.query.limit, PAGINATION.DEFAULT_LIMIT),
    after: str(req.query.after),
  });
  ApiResponse.ok(res, 'Users', data);
};

export const getUser = async (req: Request, res: Response) => {
  const data = await adminService.getUser(req.params.id!);
  ApiResponse.ok(res, 'User detail', data);
};

export const suspendUser = async (req: Request, res: Response) => {
  const data = await adminService.suspendUser(req.params.id!, req.body?.reason, adminCtx(req));
  ApiResponse.ok(res, 'User suspended', data);
};

export const unsuspendUser = async (req: Request, res: Response) => {
  const data = await adminService.unsuspendUser(req.params.id!, adminCtx(req));
  ApiResponse.ok(res, SUCCESS_MESSAGES.USER_REINSTATED, data);
};

export const changeUserRole = async (req: Request, res: Response) => {
  try {
    const data = await adminService.changeUserRole(req.params.id!, req.body.role, adminCtx(req));
    ApiResponse.ok(res, SUCCESS_MESSAGES.USER_ROLE_CHANGED, data);
  } catch (error) {
    throw error;
  }
};

// ── Metrics + activity ───────────────────────────────────────────────────────────
export const metrics = async (_req: Request, res: Response) => {
  ApiResponse.ok(res, 'Metrics', await adminService.metrics());
};

export const activity = async (req: Request, res: Response) => {
  const typeParam = str(req.query.type);
  const page = await adminService.activity({
    type: typeParam ? (typeParam.split(',') as EventType[]) : undefined,
    clientId: str(req.query.clientId),
    actorUserId: str(req.query.userId),
    limit: int(req.query.limit, PAGINATION.ACTIVITY_DEFAULT_LIMIT),
    after: str(req.query.after),
  });
  // Array-shaped for the existing admin UI; cursor is additive so a client that
  // does not keyset-paginate still works.
  ApiResponse.ok(res, 'Activity', page.items);
};

// ── Clients ──────────────────────────────────────────────────────────────────────
export const listClients = async (_req: Request, res: Response) => {
  ApiResponse.ok(res, 'Clients', await adminService.listClients());
};

export const getClient = async (req: Request, res: Response) => {
  const data = await adminService.getClient(req.params.clientId!);
  ApiResponse.ok(res, 'Client detail', data);
};


export const createClient = async (req: Request, res: Response) => {
  const data = await adminService.createClient(req.body, adminCtx(req));
  ApiResponse.created(res, 'Client created', data);
};

export const updateClient = async (req: Request, res: Response) => {
  const data = await adminService.updateClient(req.params.clientId!, req.body, adminCtx(req));
  ApiResponse.ok(res, 'Client updated', data);
};

export const rotateSecret = async (req: Request, res: Response) => {
  const data = await adminService.rotateClientSecret(req.params.clientId!, adminCtx(req));
  ApiResponse.ok(res, 'Client secret rotated', data);
};

export const suspendClient = async (req: Request, res: Response) => {
  const data = await adminService.setClientSuspended(req.params.clientId!, true, req.body?.reason, adminCtx(req));
  ApiResponse.ok(res, 'Client suspended', data);
};

export const unsuspendClient = async (req: Request, res: Response) => {
  const data = await adminService.setClientSuspended(req.params.clientId!, false, undefined, adminCtx(req));
  ApiResponse.ok(res, 'Client reinstated', data);
};

export const deleteClient = async (req: Request, res: Response) => {
  const data = await adminService.deleteClient(req.params.clientId!, adminCtx(req));
  ApiResponse.ok(res, 'Client deleted', data);
};

export const configPrompt = async (req: Request, res: Response) => {
  const prompt = await adminService.getClientConfigPrompt(req.params.clientId!, str(req.query.stack));
  ApiResponse.ok(res, 'Config prompt', { prompt });
};
