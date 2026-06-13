import mongoose from 'mongoose';
import type { Document, Model } from 'mongoose';

export interface IOAuthClient extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: string;
  clientSecretHash: string;
  clientName: string;
  redirectUris: string[];
  description: string;
  logoUrl: string;
  suspended: boolean;
  suspendedReason?: string;
  suspendedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const oauthClientSchema = new mongoose.Schema<IOAuthClient>(
  {
    clientId: { type: String, required: true, unique: true, index: true },
    clientSecretHash: { type: String, required: true, select: false },
    clientName: { type: String, required: true, trim: true, maxlength: 120 },
    redirectUris: {
      type: [String],
      required: true,
      validate: [(v: string[]) => Array.isArray(v) && v.length > 0, 'At least one redirect URI'],
    },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    logoUrl: { type: String, trim: true, maxlength: 2048, default: '' },
    suspended: { type: Boolean, default: false, index: true },
    suspendedReason: { type: String, maxlength: 500 },
    suspendedAt: { type: Date },
  },
  { timestamps: true },
);

export const OAuthClient: Model<IOAuthClient> =
  (mongoose.models.OAuthClient as Model<IOAuthClient>) ||
  mongoose.model<IOAuthClient>('OAuthClient', oauthClientSchema);

export default OAuthClient;
