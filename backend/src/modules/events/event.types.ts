/**
 * Activity event taxonomy. Every auth-significant action records one of these.
 * Append-only — events are never updated or deleted (TTL retention only).
 */
export const EVENT_TYPES = [
  // first-party auth
  'login.success',
  'login.fail',
  /**
   * A login was refused by the windowed throttle before credentials were examined. A
   * distinct type from `login.fail` on purpose: a burst of these is an attack in progress,
   * whereas `login.fail` is mostly people mistyping.
   */
  'login.throttled',
  'logout',
  'session.created',
  'session.revoked',
  /**
   * An already-rotated refresh token was presented outside the grace window — theft, or a
   * cloned client. The whole family and its session are revoked, and this is the only
   * place the difference between that and an ordinary expired token is visible: the
   * client is told the same thing either way. (M3)
   */
  'refresh.reuse_detected',
  /** A refresh token rotated successfully. Distinct from reuse so a dashboard can chart healthy vs hostile traffic. */
  'refresh.success',
  /** A refresh was refused (missing, invalid, expired, session gone). Not recorded for in-flight races. */
  'refresh.fail',
  // identity lifecycle (M2)
  'register',
  'email.verification.sent',
  'email.verified',
  'password.reset.requested',
  'password.reset.completed',
  /**
   * An action token was presented and refused. `meta.outcome` distinguishes a replay of a
   * genuine token from a superseded link or pure noise — the client is told the same thing
   * in every case, so this event is the only place the difference is visible.
   */
  'action_token.rejected',
  'account.deleted',
  // OIDC flow
  'token.issued',
  'userinfo.access',
  'consent.granted',
  'consent.revoked',
  /**
   * A genuine authorization code was presented twice. The pre-image kept by the
   * single-use CAS is what makes this distinguishable from an unknown code, and it is
   * the signal that revokes what the first redemption issued (RFC 6749 §4.1.2).
   */
  'oauth.code.replayed',
  /** RFC 7009 revocation, including whatever the grant cascade caught with it. */
  'oauth.token.revoked',
  /** RP-initiated logout terminated the OP session (OIDC RP-Initiated Logout 1.0). */
  'oauth.logout',
  /** The signing key was rotated; the previous key entered its overlap window. */
  'oauth.key.rotated',
  // admin mutations (audited)
  'admin.user.suspended',
  'admin.user.unsuspended',
  /** A role was reassigned, which revokes every session the target holds. (M3) */
  'admin.user.role_changed',
  'admin.client.created',
  'admin.client.updated',
  'admin.client.secret_rotated',
  'admin.client.suspended',
  'admin.client.unsuspended',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** Context carried with each recorded event. All fields optional — fill what's known. */
export interface EventContext {
  /** The user who performed the action (the authenticated subject). */
  actorUserId?: string | null;
  actorRole?: string | null;
  /** The OAuth client involved, when the action is app-scoped. */
  clientId?: string | null;
  /** The user acted upon (admin actions target another user). */
  targetUserId?: string | null;
  ip?: string | null;
  ua?: string | null;
  /** Small, non-sensitive extras (provider, scope, reason). Never tokens/secrets. */
  meta?: Record<string, unknown>;
}
