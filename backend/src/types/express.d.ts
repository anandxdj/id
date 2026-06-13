import 'express';

/** Authenticated first-party user attached by the auth middleware. */
export interface AuthUser {
  id: string;
  sessionId: string | null;
  role: string;
  name: string;
  email: string;
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
