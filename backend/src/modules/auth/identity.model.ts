import mongoose from 'mongoose';
import type { Document, Model } from 'mongoose';

/**
 * A login identity from one provider, linked to a canonical User. One user can have
 * many identities (google + github + credentials). Unique per (provider, providerAccountId).
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
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
  (mongoose.models.Identity as Model<IIdentity>) ||
  mongoose.model<IIdentity>('Identity', identitySchema);

export default Identity;
