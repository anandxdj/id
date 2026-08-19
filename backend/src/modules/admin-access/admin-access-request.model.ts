import mongoose from 'mongoose';
import type { Document, Model } from 'mongoose';
import { COLLECTIONS, FIELD_LIMITS } from '../../common/constants/index.constants';

export const ADMIN_ACCESS_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type AdminAccessRequestStatus =
  (typeof ADMIN_ACCESS_REQUEST_STATUS)[keyof typeof ADMIN_ACCESS_REQUEST_STATUS];

export interface IAdminAccessRequest extends Document {
  userId: mongoose.Types.ObjectId;
  justification: string;
  status: AdminAccessRequestStatus;
  decidedBy?: mongoose.Types.ObjectId;
  decisionNote: string;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema<IAdminAccessRequest>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: COLLECTIONS.USER, required: true, index: true },
    justification: { type: String, trim: true, maxlength: FIELD_LIMITS.ADMIN_ACCESS_JUSTIFICATION, default: '' },
    status: {
      type: String,
      enum: Object.values(ADMIN_ACCESS_REQUEST_STATUS),
      default: ADMIN_ACCESS_REQUEST_STATUS.PENDING,
      required: true,
      index: true,
    },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: COLLECTIONS.USER },
    decisionNote: { type: String, trim: true, maxlength: FIELD_LIMITS.ADMIN_ACCESS_DECISION_NOTE, default: '' },
    decidedAt: { type: Date },
  },
  { timestamps: true },
);

schema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: ADMIN_ACCESS_REQUEST_STATUS.PENDING } },
);
schema.index({ status: 1, createdAt: -1 });

export const AdminAccessRequest: Model<IAdminAccessRequest> =
  (mongoose.models[COLLECTIONS.ADMIN_ACCESS_REQUEST] as Model<IAdminAccessRequest>) ||
  mongoose.model<IAdminAccessRequest>(COLLECTIONS.ADMIN_ACCESS_REQUEST, schema);

export default AdminAccessRequest;
