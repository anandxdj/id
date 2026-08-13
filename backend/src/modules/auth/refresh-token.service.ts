import mongoose from 'mongoose';
import {
  CRYPTO,
  MILLISECONDS,
  REFRESH_OUTCOME,
  REFRESH_TOKEN,
  REFRESH_TOKEN_STATUS,
  REVOKE_REASONS,
} from '../../common/constants/index.constants';
import type { RefreshOutcome } from '../../common/constants/index.constants';
import { randomBase64Url } from '../../common/utils/crypto.utils';
import { generateRefreshToken } from '../../common/utils/jwt.utils';
import { Logger } from '../../common/logger/index.logger';
import { RefreshTokenStore } from './refresh-token.store';
import type { IRefreshToken } from './refresh-token.model';

/**
 * Refresh-token rotation, with family reuse detection and a grace window.
 *
 * The property this module exists to provide: **a refresh token is good exactly once.**
 * Presenting a spent one is either a client that raced itself or a thief using a token
 * the legitimate client has already rotated past, and the two have to be told apart —
 * because the correct response to the first is "here is your token again" and the correct
 * response to the second is "this entire login is now dead".
 *
 * Getting that wrong in either direction is expensive. Treating every replay as theft
 * signs legitimate users out whenever two tabs refresh at once, which is a self-inflicted
 * denial of service that looks like an attack in the logs. Treating none of them as theft
 * is the reference's position (§2.3-3): it writes `rotated_at`, `parent_refresh_token_id`
 * and `replaced_by_refresh_token_id` and reads none of them, so a rotated token stays
 * valid for its full thirty days and re-rotates, forking the family. That is strictly
 * worse than not rotating at all, because it advertises a protection it does not provide.
 *
 * The discrimination rests on two facts, and both are established by the write ordering
 * in `_rotateActive` rather than inferred after the fact:
 *
 *  1. **How long ago the presented token was rotated.** Inside
 *     `REFRESH_TOKEN.GRACE_MS` a replay is plausibly a concurrent request or a retry
 *     after a dropped response. Outside it, nothing legitimate is still holding a token
 *     that has been superseded for that long.
 *  2. **Whether its heir is still the leaf.** A rotated token whose child is *itself*
 *     rotated is two or more generations behind the live token. No client that received
 *     the child would go back to presenting the parent; a thief working from a copy
 *     taken earlier would.
 *
 * Both must hold for the benign path. Time alone is not enough — a family can rotate
 * twice within ten seconds — and generation alone is not enough, because a token rotated
 * three days ago whose child was never used is exactly the shape of a stolen credential
 * being cashed in late.
 */

export interface IssuedRefreshToken {
  /** The signed JWT. Handed to the client and never stored, logged, or reconstructed. */
  token: string;
  record: IRefreshToken;
}

export interface RotationResult {
  outcome: RefreshOutcome;
  /** The token the client should use from now on. Present on success only. */
  token?: string;
  /** The record backing `token`. */
  record?: IRefreshToken;
  /** Whatever document the presented hash resolved to, when one exists. */
  presented?: IRefreshToken;
}

/** Internal: seconds-since-epoch, the resolution JWT claims are expressed in. */
const _epochSeconds = (date: Date): number => Math.floor(date.getTime() / MILLISECONDS.SECOND);

/**
 * Internal: sign one token and describe the row that will back it.
 *
 * `iat` and `exp` come from the record rather than from a duration, which is what makes
 * the string reproducible later — see `_reproduce`.
 */
const _mint = (input: {
  userId: mongoose.Types.ObjectId;
  sid: string;
  issuedAt: Date;
  expiresAt: Date;
}): { token: string; tokenJti: string; tokenHash: string } => {
  const tokenJti = randomBase64Url(CRYPTO.TOKEN_BYTES.REFRESH_TOKEN);
  const token = generateRefreshToken({
    id: input.userId.toString(),
    sid: input.sid,
    jti: tokenJti,
    iat: _epochSeconds(input.issuedAt),
    exp: _epochSeconds(input.expiresAt),
  });
  return { token, tokenJti, tokenHash: RefreshTokenStore.hashOf(token) };
};

/**
 * Internal: rebuild the exact token string for a record we already issued.
 *
 * This is what lets the grace window hand a concurrent refresh the *same* successor
 * rather than a retriable error, without ever keeping a token in plaintext. The claims
 * are all recoverable — `jti`, `iat` and `exp` from the row, the sid from the JWT the
 * caller just presented — and the secret is the only thing that is secret, exactly as it
 * is for every other token we sign.
 *
 * The result is checked against the stored hash rather than trusted. If a secret rotation
 * or a clock quirk ever made the reproduction differ, the caller degrades to "retry
 * shortly" instead of returning a token that would not verify.
 */
const _reproduce = (record: IRefreshToken, sid: string): string | null => {
  const token = generateRefreshToken({
    id: record.userId.toString(),
    sid,
    jti: record.tokenJti,
    iat: _epochSeconds(record.issuedAt),
    exp: _epochSeconds(record.expiresAt),
  });
  if (RefreshTokenStore.hashOf(token) !== record.tokenHash) {
    // Never log the token or the hash — the jti exists precisely so this line can be
    // written without either.
    Logger.warn('Refresh successor could not be reproduced from its record', {
      jti: record.tokenJti,
    });
    return null;
  }
  return token;
};

/**
 * Internal: benign concurrent refresh, or theft?
 *
 * Both conditions have to hold for the benign verdict — see the module comment for why
 * neither is sufficient alone.
 */
const _classifyRotated = async (
  existing: IRefreshToken,
  sid: string,
  now: Date,
): Promise<RotationResult> => {
  const rotatedAt = existing.rotatedAt?.getTime() ?? 0;
  if (now.getTime() - rotatedAt > REFRESH_TOKEN.GRACE_MS) {
    return { outcome: REFRESH_OUTCOME.REUSE_DETECTED, presented: existing };
  }

  // Guaranteed by the write order in `_rotateActive`; an absent heir means a process died
  // mid-rotation, which is a retry rather than an accusation.
  if (!existing.replacedByTokenId) {
    return { outcome: REFRESH_OUTCOME.IN_FLIGHT, presented: existing };
  }

  const child = await RefreshTokenStore.findByIdForClassification(existing.replacedByTokenId);
  if (!child) return { outcome: REFRESH_OUTCOME.IN_FLIGHT, presented: existing };

  // The heir has itself been spent or killed, so the presented token is at least two
  // generations behind the leaf. Nothing legitimate goes backwards like that.
  if (child.status !== REFRESH_TOKEN_STATUS.ACTIVE) {
    return { outcome: REFRESH_OUTCOME.REUSE_DETECTED, presented: existing };
  }
  if (child.expiresAt <= now) {
    return { outcome: REFRESH_OUTCOME.EXPIRED, presented: existing };
  }

  const token = _reproduce(child, sid);
  if (!token) return { outcome: REFRESH_OUTCOME.IN_FLIGHT, presented: existing };

  return { outcome: REFRESH_OUTCOME.GRACE_REPLAY, token, record: child, presented: existing };
};

/**
 * Internal: the happy path — an apparently-live token, claimed atomically.
 *
 * The write order is the load-bearing part, and it is not the obvious one:
 *
 *  1. Insert the child, active, before touching the parent.
 *  2. Compare-and-set the parent to `rotated` **and** point `replacedByTokenId` at the
 *     child, in one atomic update, returning the pre-image.
 *  3. If that claim was lost, delete the child — nobody ever received it — and go
 *     classify what actually happened.
 *
 * Doing it the natural way round (claim, then insert) leaves a window in which the parent
 * reads as `rotated` with no heir yet, and every concurrent refresh landing in that
 * window — the common case, milliseconds apart — could only be answered with "retry".
 * Inserting first means the guarantee holds unconditionally: if a caller sees `rotated`,
 * the heir exists and is named, so the grace path can return it.
 *
 * The cost is an orphan row if the process dies between the two writes. It is inert: no
 * client ever saw its plaintext, its hash is unguessable, and it expires with the family.
 */
const _rotateActive = async (
  existing: IRefreshToken,
  sid: string,
  now: Date,
): Promise<RotationResult> => {
  if (existing.expiresAt <= now) {
    await RefreshTokenStore.revokeOne(existing._id, REVOKE_REASONS.TOKEN_EXPIRED);
    return { outcome: REFRESH_OUTCOME.EXPIRED, presented: existing };
  }

  const childId = RefreshTokenStore.newId();
  const issuedAt = new Date();
  const { token, tokenJti, tokenHash } = _mint({
    userId: existing.userId,
    sid,
    issuedAt,
    // Inherited unchanged: the family's window does not move.
    expiresAt: existing.expiresAt,
  });

  const child = await RefreshTokenStore.create({
    _id: childId,
    tokenHash,
    tokenJti,
    familyId: existing.familyId,
    sessionId: existing.sessionId,
    userId: existing.userId,
    parentTokenId: existing._id,
    issuedAt,
    expiresAt: existing.expiresAt,
  });

  const claimed = await RefreshTokenStore.claimForRotation(existing.tokenHash, childId, now);
  if (!claimed) {
    await RefreshTokenStore.deleteUnissued(childId);
    // Somebody else moved the parent between the read and the claim. Re-read it and let
    // the same classifier decide, so the racing caller and a genuine replay are judged by
    // identical rules.
    const current = await RefreshTokenStore.findByHashForClassification(existing.tokenHash);
    if (!current) return { outcome: REFRESH_OUTCOME.UNKNOWN };
    if (current.status === REFRESH_TOKEN_STATUS.REVOKED) {
      return { outcome: REFRESH_OUTCOME.REVOKED, presented: current };
    }
    if (current.status === REFRESH_TOKEN_STATUS.ROTATED) {
      return _classifyRotated(current, sid, now);
    }
    // Still active and unclaimed by anyone: the only way here is an expiry that elapsed
    // mid-flight. Retriable rather than fatal.
    return { outcome: REFRESH_OUTCOME.IN_FLIGHT, presented: current };
  }

  return { outcome: REFRESH_OUTCOME.ROTATED, token, record: child, presented: claimed };
};

export const RefreshTokenService = {
  /**
   * Open a new family: one login, one root token.
   *
   * The absolute window is the session's own `expiresAt`, so a refresh token can never
   * outlive the session it belongs to — an invariant rather than two settings that have
   * to be kept in agreement. Every child inherits it unchanged, which is what makes the
   * window absolute instead of sliding forward on every refresh.
   */
  async issueForSession(input: {
    userId: string;
    sid: string;
    sessionId: string;
    expiresAt: Date;
  }): Promise<IssuedRefreshToken> {
    const id = RefreshTokenStore.newId();
    const userId = new mongoose.Types.ObjectId(input.userId);
    // One family per login. A fresh id rather than the session handle: they are 1:1 today
    // and conflating them would quietly forbid ever changing that.
    const familyId = RefreshTokenStore.newId();
    const issuedAt = new Date();

    const { token, tokenJti, tokenHash } = _mint({
      userId,
      sid: input.sid,
      issuedAt,
      expiresAt: input.expiresAt,
    });

    const record = await RefreshTokenStore.create({
      _id: id,
      tokenHash,
      tokenJti,
      familyId,
      sessionId: input.sessionId,
      userId,
      parentTokenId: null,
      issuedAt,
      expiresAt: input.expiresAt,
    });

    return { token, record };
  },

  /**
   * Exchange a presented token for its successor, or classify why that cannot happen.
   *
   * Decides nothing about HTTP and revokes nothing: it reports an outcome, and
   * `auth.service.refresh` turns that into a response and — for `REUSE_DETECTED` — into
   * the revocation fan-out. Keeping the judgement and the consequence apart is what makes
   * the judgement testable on its own.
   */
  async rotate(presentedToken: string, sid: string): Promise<RotationResult> {
    const now = new Date();
    const tokenHash = RefreshTokenStore.hashOf(presentedToken);

    // Unfiltered on purpose: an expired or already-spent row is the evidence.
    const existing = await RefreshTokenStore.findByHashForClassification(tokenHash);
    if (!existing) return { outcome: REFRESH_OUTCOME.UNKNOWN };

    if (existing.status === REFRESH_TOKEN_STATUS.REVOKED) {
      return { outcome: REFRESH_OUTCOME.REVOKED, presented: existing };
    }
    if (existing.status === REFRESH_TOKEN_STATUS.ROTATED) {
      return _classifyRotated(existing, sid, now);
    }
    return _rotateActive(existing, sid, now);
  },
};
