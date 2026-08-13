import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import {
  COLLECTIONS,
  COLLECTION_NAMES,
  TTL_EXPIRE_AT_DATE,
} from '../../common/constants/index.constants';

/**
 * Per-identity failed-login counter. **Deliberately in Mongo, not Redis.**
 *
 * Every other counter in this system lives in Redis and fails open, because a cache blip
 * must not become an authentication outage (see `middleware/rateLimit.ts`). This one is
 * the exception, for two reasons that do not apply to the others:
 *
 *  1. **Failing open here means unlimited password guessing.** For general rate limiting
 *     the fail-open trade is right: the cost is inaccurate limits, the alternative is
 *     locking everyone out. For a login throttle the cost is that a Redis outage becomes
 *     an open brute-force window on every account.
 *  2. **The volume is trivial.** This counter is written only on *failed* logins, so
 *     durability costs essentially nothing — unlike the general limiter, which writes on
 *     every request and would be a genuine burden on the oplog.
 *
 * ⚠ TTL IS GARBAGE COLLECTION, NOT A SECURITY BOUNDARY — but here the direction of the
 * error is the safe one: a document the reaper has not yet collected still carries an
 * elapsed `lockedUntil`, and the read path checks that explicitly, so a stale document
 * cannot extend a lock. The `expiresAt`-style predicate is present anyway, for the same
 * reason it is present everywhere else: consistency is what makes the rule auditable.
 *
 * **This is a window, never a lockout.** The reference implementation resets
 * `failedAttempts` only on a *successful* login while refusing to examine credentials
 * whenever the counter is at the threshold — so success is unreachable and five
 * unauthenticated requests permanently brick any known email address (§2.3-2). That
 * converts a brute-force defence into a trivial denial of service. Here, the lock is read
 * from `lockedUntil` alone, never from the raw counter, and `windowExpiresAt` reaps the
 * whole document, so the state decays to "no record" without anything having to run.
 */
export interface ILoginThrottle {
  /**
   * `sha256(emailNormalized)`. Hashed, and doubling as `_id`, for a reason specific to
   * this collection: it is the one collection an unauthenticated attacker can grow at
   * will, one document per address they guess. Storing those addresses verbatim would
   * accumulate an attacker-curated mailing list with no operational upside — every lookup
   * here is an exact match, so the digest serves identically. Failed-attempt history that
   * support actually needs is in the events store.
   */
  _id: string;
  failedAttempts: number;
  /** The only thing consulted to decide "is this identity locked right now?". */
  lockedUntil: Date | null;
  lastFailedAt: Date;
  /** When the counter forgets. Also the TTL field, so decay needs no scheduled job. */
  windowExpiresAt: Date;
}

const loginThrottleSchema = new mongoose.Schema<ILoginThrottle>(
  {
    _id: { type: String, required: true },
    failedAttempts: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastFailedAt: { type: Date, required: true },
    windowExpiresAt: { type: Date, required: true },
  },
  { timestamps: false, collection: COLLECTION_NAMES.LOGIN_THROTTLE },
);

// Storage reclamation. This is also the decay mechanism: once the window passes there is
// no document, hence no counter and no lock.
loginThrottleSchema.index({ windowExpiresAt: 1 }, { expireAfterSeconds: TTL_EXPIRE_AT_DATE });

export const LoginThrottle: Model<ILoginThrottle> =
  (mongoose.models[COLLECTIONS.LOGIN_THROTTLE] as Model<ILoginThrottle>) ||
  mongoose.model<ILoginThrottle>(COLLECTIONS.LOGIN_THROTTLE, loginThrottleSchema);
