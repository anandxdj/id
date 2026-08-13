import { hashToken } from '../../common/utils/crypto.utils';
import { LOGIN_THROTTLE, MILLISECONDS } from '../../common/constants/index.constants';
import { LoginThrottle } from './login-throttle.model';

/**
 * The only module that queries `loginThrottles`.
 *
 * The whole design fits in one sentence: **one aggregation-pipeline `findOneAndUpdate`
 * increments the counter and decides the lock server-side, in one round trip, on one
 * document.** The reference reads the row, adds one in application code, and writes it
 * back — so a parallel burst of guesses is a lost update and the five-attempt limit is
 * bypassable by concurrency alone (§2.3-10).
 *
 * A pipeline update rather than `$inc` because the increment is conditional: if the window
 * has already elapsed the counter must *restart* at 1 rather than continue climbing, and
 * `$inc` cannot express "increment, unless the window expired, in which case set to 1".
 * Two stages, because the second needs to see the value the first produced.
 */

/** Internal: the addressable key for an email. The one place this hash is computed. */
const _keyOf = (emailNormalized: string): string => hashToken(emailNormalized);

export interface ThrottleState {
  failedAttempts: number;
  lockedUntil: Date | null;
  /** Whether the identity is locked *right now*, derived from `lockedUntil` alone. */
  locked: boolean;
  /** Seconds until the lock lifts. Zero when not locked — this is what proves recovery. */
  retryAfterSeconds: number;
}

/** Internal: project a stored counter into the decision the caller actually needs. */
const _toState = (
  doc: { failedAttempts: number; lockedUntil: Date | null } | null,
  now: Date,
): ThrottleState => {
  const lockedUntil = doc?.lockedUntil ?? null;
  const locked = lockedUntil !== null && lockedUntil.getTime() > now.getTime();
  return {
    failedAttempts: doc?.failedAttempts ?? 0,
    lockedUntil,
    locked,
    retryAfterSeconds: locked
      ? Math.ceil((lockedUntil.getTime() - now.getTime()) / MILLISECONDS.SECOND)
      : 0,
  };
};

export const LoginThrottleStore = {
  /**
   * Is this identity locked right now?
   *
   * Keyed on the *submitted* address rather than a resolved user, which is what keeps it
   * from becoming an existence oracle: an address that has never been registered locks on
   * five failures exactly like one that has.
   *
   * The explicit `windowExpiresAt: { $gt: now }` predicate is the same discipline every
   * other expiring collection follows — an un-reaped document must not be able to hold a
   * lock past its window.
   */
  async check(emailNormalized: string): Promise<ThrottleState> {
    const now = new Date();
    const doc = await LoginThrottle.findOne({
      _id: _keyOf(emailNormalized),
      windowExpiresAt: { $gt: now },
    }).lean<{ failedAttempts: number; lockedUntil: Date | null }>();
    return _toState(doc, now);
  },

  /**
   * Record one failed attempt and return the resulting state.
   *
   * Atomic and upserting: the increment, the window decision, and the lock decision all
   * happen inside a single document update on the server, so N concurrent failures count
   * as N.
   */
  async recordFailure(emailNormalized: string): Promise<ThrottleState> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + LOGIN_THROTTLE.WINDOW_MS);
    const lockUntil = new Date(now.getTime() + LOGIN_THROTTLE.LOCK_MS);

    const updated = await LoginThrottle.findOneAndUpdate(
      { _id: _keyOf(emailNormalized) },
      [
        {
          $set: {
            // Continue the current window, or start a fresh one if it has elapsed. This
            // is the decay: a slow guesser never accumulates, because their count resets
            // every time they let the window lapse.
            failedAttempts: {
              $cond: [
                { $gt: ['$windowExpiresAt', now] },
                { $add: [{ $ifNull: ['$failedAttempts', 0] }, 1] },
                1,
              ],
            },
            windowExpiresAt: {
              $cond: [{ $gt: ['$windowExpiresAt', now] }, '$windowExpiresAt', windowEnd],
            },
            lastFailedAt: now,
          },
        },
        {
          $set: {
            lockedUntil: {
              $cond: [
                { $gte: ['$failedAttempts', LOGIN_THROTTLE.MAX_ATTEMPTS] },
                lockUntil,
                // Never clear an existing lock here — only the window elapsing does that.
                '$lockedUntil',
              ],
            },
            // A lock must outlive the window that produced it, or the TTL reaper deletes
            // the document mid-lock and hands the attacker their attempts straight back.
            windowExpiresAt: {
              $cond: [
                { $gte: ['$failedAttempts', LOGIN_THROTTLE.MAX_ATTEMPTS] },
                { $max: ['$windowExpiresAt', lockUntil] },
                '$windowExpiresAt',
              ],
            },
          },
        },
      ],
      { upsert: true, returnDocument: 'after' },
    ).lean<{ failedAttempts: number; lockedUntil: Date | null }>();

    return _toState(updated, now);
  },

  /**
   * Forget the counter for an identity, on a successful login.
   *
   * A delete rather than a reset: the counter is *only* a throttle, so a zeroed row is
   * indistinguishable from no row and costs a document. Failed-attempt history that an
   * audit needs is written to the events store by the caller, which is the right home for
   * it — this collection is a control, not a log.
   */
  async clear(emailNormalized: string): Promise<void> {
    await LoginThrottle.deleteOne({ _id: _keyOf(emailNormalized) });
  },
};
