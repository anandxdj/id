import mongoose from 'mongoose';
import { ApiError } from '../../common/utils/ApiError';
import { PAGINATION, REVOKE_REASONS, USER_ROLES } from '../../common/constants/index.constants';
import * as authService from '../auth/auth.service';
import { UserStore } from '../auth/user.store';
import User from '../auth/auth.model';
import * as events from '../events/event.service';
import type { EventContext } from '../events/event.types';
import AdminAccessRequest, {
  ADMIN_ACCESS_REQUEST_STATUS,
  type AdminAccessRequestStatus,
  type IAdminAccessRequest,
} from './admin-access-request.model';
import type { AdminAccessDecisionInput } from './admin-access-request.schemas';

type RequestContext = Pick<EventContext, 'ip' | 'ua' | 'actorRole'>;
type DecisionContext = RequestContext & { actorUserId: string };

const view = (request: IAdminAccessRequest) => ({
  id: request._id.toString(),
  userId: request.userId.toString(),
  justification: request.justification,
  status: request.status,
  decidedBy: request.decidedBy?.toString() ?? null,
  decisionNote: request.decisionNote,
  decidedAt: request.decidedAt ?? null,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

export const listOwn = async (userId: string) => {
  const rows = await AdminAccessRequest.find({ userId }).sort({ createdAt: -1 });
  return rows.map(view);
};

export const create = async (userId: string, justification: string, ctx: RequestContext) => {
  const user = await UserStore.findLiveById(userId);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role !== USER_ROLES.USER) {
    throw ApiError.conflict('Administrative accounts cannot request admin access');
  }

  const request = await AdminAccessRequest.create({ userId, justification });
  events.record('admin.access.requested', {
    actorUserId: userId,
    actorRole: user.role,
    ...ctx,
    meta: { requestId: request._id.toString(), hasJustification: Boolean(justification) },
  });
  return view(request);
};

export const listForAdmin = async ({
  status,
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT,
}: {
  status: AdminAccessRequestStatus;
  page?: number;
  limit?: number;
}) => {
  const lim = Math.min(Math.max(limit, 1), PAGINATION.MAX_LIMIT);
  const pg = Math.max(page, PAGINATION.DEFAULT_PAGE);
  const filter = { status };
  const [rows, total] = await Promise.all([
    AdminAccessRequest.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((pg - 1) * lim)
    .limit(lim)
    .populate('userId', 'name email role disabled deletedAt')
    .populate('decidedBy', 'name email'),
    AdminAccessRequest.countDocuments(filter),
  ]);

  const items = rows.map((request) => {
    const populated = request.toObject() as unknown as {
      _id: mongoose.Types.ObjectId;
      userId: { _id: mongoose.Types.ObjectId; name: string; email: string; role: string; disabled: boolean; deletedAt?: Date };
      justification: string;
      status: AdminAccessRequestStatus;
      decidedBy?: { _id: mongoose.Types.ObjectId; name: string; email: string };
      decisionNote: string;
      decidedAt?: Date;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: populated._id.toString(),
      requester: populated.userId
        ? {
            id: populated.userId._id.toString(),
            name: populated.userId.name,
            email: populated.userId.email,
            role: populated.userId.role,
            disabled: populated.userId.disabled,
            deleted: Boolean(populated.userId.deletedAt),
          }
        : null,
      justification: populated.justification,
      status: populated.status,
      decidedBy: populated.decidedBy
        ? { id: populated.decidedBy._id.toString(), name: populated.decidedBy.name, email: populated.decidedBy.email }
        : null,
      decisionNote: populated.decisionNote,
      decidedAt: populated.decidedAt ?? null,
      createdAt: populated.createdAt,
      updatedAt: populated.updatedAt,
    };
  });
  return { items, total, page: pg, limit: lim };
};

export const decide = async (requestId: string, input: AdminAccessDecisionInput, ctx: DecisionContext) => {
  const session = await mongoose.startSession();
  let decidedRequest: IAdminAccessRequest | null = null;
  let targetUserId = '';

  try {
    await session.withTransaction(async () => {
      const request = await AdminAccessRequest.findOne({
        _id: requestId,
        status: ADMIN_ACCESS_REQUEST_STATUS.PENDING,
      }).session(session);
      if (!request) throw ApiError.conflict('This request has already been decided');

      const user = await User.findById(request.userId).session(session);

      if (input.decision === ADMIN_ACCESS_REQUEST_STATUS.APPROVED) {
        if (!user || user.deletedAt) throw ApiError.conflict('The requesting account is no longer available');
        if (user.disabled) throw ApiError.conflict('A disabled account cannot be promoted');
        if (user.role !== USER_ROLES.USER) throw ApiError.conflict('The requesting account is already privileged');
        user.role = USER_ROLES.ADMIN;
        await user.save({ session });
      }

      request.status = input.decision;
      request.decidedBy = new mongoose.Types.ObjectId(ctx.actorUserId);
      request.decisionNote = input.note;
      request.decidedAt = new Date();
      await request.save({ session });
      decidedRequest = request;
      targetUserId = request.userId.toString();
    });
  } finally {
    await session.endSession();
  }

  if (!decidedRequest) throw ApiError.conflict('This request could not be decided');

  if (input.decision === ADMIN_ACCESS_REQUEST_STATUS.APPROVED) {
    await authService.applyAccountSnapshotChange(
      targetUserId,
      { role: USER_ROLES.ADMIN },
      REVOKE_REASONS.ROLE_CHANGED,
      ctx,
    );
  }

  events.record(
    input.decision === ADMIN_ACCESS_REQUEST_STATUS.APPROVED ? 'admin.access.approved' : 'admin.access.rejected',
    { ...ctx, targetUserId, meta: { requestId, note: input.note } },
  );
  return view(decidedRequest);
};

export const resolvePendingPromotion = async (userId: string, actorUserId: string): Promise<void> => {
  await AdminAccessRequest.updateOne(
    { userId, status: ADMIN_ACCESS_REQUEST_STATUS.PENDING },
    {
      $set: {
        status: ADMIN_ACCESS_REQUEST_STATUS.APPROVED,
        decidedBy: actorUserId,
        decidedAt: new Date(),
        decisionNote: 'Approved through direct role management.',
      },
    },
  );
};
