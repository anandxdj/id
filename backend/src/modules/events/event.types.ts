/**
 * Activity event taxonomy. Every auth-significant action records one of these.
 * Append-only — events are never updated or deleted (TTL retention only).
 */
export const EVENT_TYPES = [
  // first-party auth
  'login.success',
  'login.fail',
  'logout',
  'session.created',
  'session.revoked',
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
  // admin mutations (audited)
  'admin.user.suspended',
  'admin.user.unsuspended',
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
