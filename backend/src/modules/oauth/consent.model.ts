import mongoose from 'mongoose';
import type { Document, Model } from 'mongoose';
import { COLLECTIONS, OIDC_SCOPES } from '../../common/constants/index.constants';

/**
 * What a user has actually approved for a client.
 *
 * ⚠ This document is an **authorization decision, not a bookmark**. Before M4 the
 * authorize flow only asked whether a row existed, then issued a code for whatever
 * scope the current request named — so a client approved once for `openid` could ask
 * for `openid profile email` on its next authorize and be handed it without the user
 * ever seeing a second consent screen. The same bug exists in the reference
 * implementation (plan §2.3-12).
 *
 * `grantedScopes` is the fix and the authority. Both issuance points — authorization
 * code and access token — grant `requested ∩ granted`, and a request reaching past the
 * grant re-prompts instead of silently upgrading.
 */
export interface IConsent extends Document {
  userId: mongoose.Types.ObjectId;
  clientId: string;
  /**
   * Space-delimited mirror of `grantedScopes`, kept for the authorized-apps screen and
   * anything else that wants a display string. Derived, never the source of a decision.
   */
  scope: string;
  /** The authoritative granted set. Every issuance intersects against this array. */
  grantedScopes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const consentSchema = new mongoose.Schema<IConsent>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: COLLECTIONS.USER,
      required: true,
      index: true,
    },
    clientId: { type: String, required: true, index: true },
    scope: { type: String, default: OIDC_SCOPES.OPENID },
    /**
     * Defaulted rather than required so consent rows written before M4 still read
     * sensibly. The service treats an empty array as "nothing granted", which
     * re-prompts — the safe direction for a record whose true grant is unknown.
     */
    grantedScopes: { type: [String], default: [] },
  },
  { timestamps: true },
);

consentSchema.index({ userId: 1, clientId: 1 }, { unique: true });

export const Consent: Model<IConsent> =
  (mongoose.models[COLLECTIONS.CONSENT] as Model<IConsent>) ||
  mongoose.model<IConsent>(COLLECTIONS.CONSENT, consentSchema);

export default Consent;
