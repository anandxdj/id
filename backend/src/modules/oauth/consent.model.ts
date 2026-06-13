import mongoose from 'mongoose';
import type { Document, Model } from 'mongoose';

export interface IConsent extends Document {
  userId: mongoose.Types.ObjectId;
  clientId: string;
  scope: string;
  createdAt: Date;
  updatedAt: Date;
}

const consentSchema = new mongoose.Schema<IConsent>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientId: { type: String, required: true, index: true },
    scope: { type: String, default: 'openid' },
  },
  { timestamps: true },
);

consentSchema.index({ userId: 1, clientId: 1 }, { unique: true });

export const Consent: Model<IConsent> =
  (mongoose.models.OAuthConsent as Model<IConsent>) ||
  mongoose.model<IConsent>('OAuthConsent', consentSchema);

export default Consent;
