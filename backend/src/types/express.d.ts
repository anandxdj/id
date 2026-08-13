import 'express';

/**
 * Authenticated first-party principal attached by the auth middleware.
 *
 * Since M3 this is built from the session document alone, so `name` and `email` are gone:
 * carrying them meant a `User.findById` on every authenticated request purely to populate
 * two fields nothing read. A handler that genuinely needs profile data reads it
 * explicitly — see `auth.service.getMe` — which makes the cost visible at the call site
 * instead of charging it to every request in the system.
 *
 * `sessionId` is the session *handle*, which is also what the sessions API publishes.
 */
export interface AuthUser {
  id: string;
  sessionId: string | null;
  role: string;
}

/** OIDC access-token context attached by authenticateOidcAccess. */
export interface OAuthContext {
  userId: string;
  clientId: string;
  scope: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      oauth?: OAuthContext;
    }
  }
}
