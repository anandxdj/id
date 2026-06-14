import type { Request, Response } from 'express';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ApiError } from '../../common/utils/ApiError';
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
    page: int(req.query.page, 1),
    limit: int(req.query.limit, 20),
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
  ApiResponse.ok(res, 'User reinstated', data);
};

// ── Metrics + activity ───────────────────────────────────────────────────────────
export const metrics = async (_req: Request, res: Response) => {
  ApiResponse.ok(res, 'Metrics', await adminService.metrics());
};

export const activity = async (req: Request, res: Response) => {
  const typeParam = str(req.query.type);
  const data = await adminService.activity({
    type: typeParam ? (typeParam.split(',') as EventType[]) : undefined,
    clientId: str(req.query.clientId),
    actorUserId: str(req.query.userId),
    limit: int(req.query.limit, 100),
  });
  ApiResponse.ok(res, 'Activity', data);
};

// ── Clients ──────────────────────────────────────────────────────────────────────
export const listClients = async (_req: Request, res: Response) => {
  ApiResponse.ok(res, 'Clients', await adminService.listClients());
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

export const configPrompt = async (req: Request, res: Response) => {
  const prompt = await adminService.getClientConfigPrompt(req.params.clientId!, str(req.query.stack));
  ApiResponse.ok(res, 'Config prompt', { prompt });
};
