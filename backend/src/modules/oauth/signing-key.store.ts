import { SIGNING_KEY_STATUS } from '../../common/constants/index.constants';
import { OAuthSigningKey } from './oauth-signing-key.model';
import type { IOAuthSigningKey } from './oauth-signing-key.model';

/**
 * The only module that queries `oauthSigningKeys`.
 *
 * One store module per collection is what makes "every read filters on expiry"
 * reviewable rather than aspirational: the `notAfter` predicate that keeps a
 * rotated-out key from verifying past its overlap window appears exactly once here,
 * in `_publishedFilter`, and nowhere else in the codebase.
 */

export interface CreateSigningKeyInput {
  kid: string;
  alg: string;
  publicJwk: Record<string, string>;
  encryptedPrivateKey: string;
  encryptionIv: string;
  encryptionAuthTag: string;
  status: IOAuthSigningKey['status'];
}

/**
 * Internal: "this key may still verify a signature and belongs in JWKS".
 *
 * ACTIVE and NEXT have no `notAfter`; RETIRED is only published while its overlap
 * window is open. The TTL index reaps retired rows eventually, but on a ~60 s cycle and
 * with a deliberate retention margin — so this predicate, not the index, is what ends a
 * retired key's authority.
 */
const _publishedFilter = () => ({
  $or: [
    { status: { $in: [SIGNING_KEY_STATUS.ACTIVE, SIGNING_KEY_STATUS.NEXT] } },
    { status: SIGNING_KEY_STATUS.RETIRED, notAfter: { $gt: new Date() } },
  ],
});

export const SigningKeyStore = {
  async create(input: CreateSigningKeyInput): Promise<IOAuthSigningKey> {
    const now = new Date();
    const created = await OAuthSigningKey.create({
      ...input,
      createdAt: now,
      activatedAt: input.status === SIGNING_KEY_STATUS.ACTIVE ? now : null,
      retiredAt: null,
      notAfter: null,
    });
    return created.toObject();
  },

  /**
   * The key that signs. Sorted newest-first rather than left to natural order: a
   * rotation that crashes between its two writes can leave two ACTIVE rows for a
   * moment, and "the most recently activated one signs" makes that window deterministic
   * instead of arbitrary. Both are published either way, so nothing fails to verify.
   */
  async findActive(): Promise<IOAuthSigningKey | null> {
    return OAuthSigningKey.findOne({ status: SIGNING_KEY_STATUS.ACTIVE })
      .sort({ activatedAt: -1 })
      .lean<IOAuthSigningKey>();
  },

  /** Everything JWKS publishes and everything a signature may still be checked against. */
  async listPublished(): Promise<IOAuthSigningKey[]> {
    return OAuthSigningKey.find(_publishedFilter())
      .sort({ createdAt: -1 })
      .lean<IOAuthSigningKey[]>();
  },

  async findByKid(kid: string): Promise<IOAuthSigningKey | null> {
    return OAuthSigningKey.findOne({ kid }).lean<IOAuthSigningKey>();
  },

  /**
   * Demote the current ACTIVE key to RETIRED and open its overlap window.
   *
   * A single-document compare-and-set on `status`, so two replicas rotating at once
   * produce one winner and one no-op rather than two half-applied rotations. No
   * transaction: the pair of writes is ordered so the worst interleaving leaves a
   * freshly inserted ACTIVE key alongside a still-ACTIVE old one, which verifies
   * everything and signs with one of them — degraded, never broken.
   */
  async retireActive(kid: string, notAfter: Date): Promise<boolean> {
    const now = new Date();
    const result = await OAuthSigningKey.updateOne(
      { kid, status: SIGNING_KEY_STATUS.ACTIVE },
      { $set: { status: SIGNING_KEY_STATUS.RETIRED, retiredAt: now, notAfter } },
    );
    return result.modifiedCount > 0;
  },

  /** Promote a NEXT key to ACTIVE. Same CAS discipline as `retireActive`. */
  async activate(kid: string): Promise<boolean> {
    const result = await OAuthSigningKey.updateOne(
      { kid, status: { $ne: SIGNING_KEY_STATUS.ACTIVE } },
      { $set: { status: SIGNING_KEY_STATUS.ACTIVE, activatedAt: new Date(), notAfter: null } },
    );
    return result.modifiedCount > 0;
  },
};
