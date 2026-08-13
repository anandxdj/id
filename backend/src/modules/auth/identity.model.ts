import mongoose from 'mongoose';
import type { Document, Model } from 'mongoose';
import { COLLECTIONS } from '../../common/constants/index.constants';

/**
 * A login identity from one provider, linked to a canonical User. One user can have
 * many identities (google + github + credentials). Unique per (provider, providerAccountId).
 *
 * Pure schema (house rule 6) — linking and revocation rules live in `social.service.ts`
 * and `account.service.ts`.
 *
 * Note what closing an account does to these rows: it **deletes** them rather than
 * flagging them. A soft `revokedAt` would leave the unique `{ provider,
 * providerAccountId }` key occupied, so the same Google account could never be linked
 * again — the identity-shaped version of the reference's "soft delete burns the email
 * address forever" bug (§2.3-16). Making that index partial on `{ revokedAt: null }`
 * would also work, at the cost of rebuilding a unique index on a live collection; the
 * evidence lives in the `account.deleted` event either way, so deletion is the honest
 * and deterministic choice.
 */
export interface IIdentity extends Document {
  userId: mongoose.Types.ObjectId;
  provider: string; // 'google' | 'github' | 'credentials' | ...
  providerAccountId: string; // the provider's stable subject id
  email?: string;
  name?: string;
  picture?: string;
  createdAt: Date;
  updatedAt: Date;
}

const identitySchema = new mongoose.Schema<IIdentity>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: COLLECTIONS.USER,
      required: true,
      index: true,
    },
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    name: { type: String, trim: true },
    picture: { type: String, trim: true },
  },
  { timestamps: true },
);

identitySchema.index({ provider: 1, providerAccountId: 1 }, { unique: true });

export const Identity: Model<IIdentity> =
  (mongoose.models[COLLECTIONS.IDENTITY] as Model<IIdentity>) ||
  mongoose.model<IIdentity>(COLLECTIONS.IDENTITY, identitySchema);

export default Identity;
