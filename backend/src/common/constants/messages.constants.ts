/**
 * Machine-readable error codes and the human strings that pair with them.
 *
 * `ERROR_CODES` is the stable contract clients switch on; `ERROR_MESSAGES` is the
 * copy that may change freely. Keep the two maps in lockstep — the reference
 * project let them drift (it had an `ACCOUNT_LOCKED` code with no message), which
 * is how you end up with `undefined` in a 429 body.
 */

export const ERROR_CODES = {
  // Generic
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Identity
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_UNAVAILABLE: 'ACCOUNT_UNAVAILABLE',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  IDENTITY_NOT_FOUND: 'IDENTITY_NOT_FOUND',
  INVALID_ACTION_TOKEN: 'INVALID_ACTION_TOKEN',
  ACTION_TOKEN_EXPIRED: 'ACTION_TOKEN_EXPIRED',

  // Sessions
  MISSING_TOKEN: 'MISSING_TOKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_INVALID: 'SESSION_INVALID',
  REFRESH_TOKEN_MISSING: 'REFRESH_TOKEN_MISSING',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  REFRESH_TOKEN_REVOKED: 'REFRESH_TOKEN_REVOKED',
  /** An already-rotated token was replayed outside the grace window — token theft. */
  REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
  /** Benign concurrent refresh: the client lost the race and should retry. */
  REFRESH_IN_FLIGHT: 'REFRESH_IN_FLIGHT',

  // Admin
  CANNOT_TARGET_SELF: 'CANNOT_TARGET_SELF',
  CANNOT_TARGET_ADMIN: 'CANNOT_TARGET_ADMIN',
  LAST_ADMIN_PROTECTED: 'LAST_ADMIN_PROTECTED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.BAD_REQUEST]: 'Bad request',
  [ERROR_CODES.UNAUTHORIZED]: 'Unauthorized',
  [ERROR_CODES.FORBIDDEN]: 'You do not have permission to perform this action',
  [ERROR_CODES.NOT_FOUND]: 'Not found',
  [ERROR_CODES.CONFLICT]: 'Conflict',
  [ERROR_CODES.VALIDATION_ERROR]: 'The request payload is invalid',
  [ERROR_CODES.TOO_MANY_REQUESTS]: 'Too many attempts, try again later',
  [ERROR_CODES.INTERNAL_ERROR]: 'Internal Server Error',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',

  // Deliberately identical for unknown-email and wrong-password: a distinct
  // message on either branch is a user-enumeration oracle.
  [ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid email or password',
  [ERROR_CODES.ACCOUNT_UNAVAILABLE]: 'This account is not available',
  [ERROR_CODES.ACCOUNT_LOCKED]: 'Too many failed attempts. Try again later',
  [ERROR_CODES.EMAIL_NOT_VERIFIED]: 'Please verify your email address before signing in',
  [ERROR_CODES.EMAIL_EXISTS]: 'An account with this email already exists',
  [ERROR_CODES.USER_NOT_FOUND]: 'User not found',
  [ERROR_CODES.IDENTITY_NOT_FOUND]: 'No sign-in method found for this account',
  [ERROR_CODES.INVALID_ACTION_TOKEN]: 'This link is invalid or has already been used',
  [ERROR_CODES.ACTION_TOKEN_EXPIRED]: 'This link has expired — request a new one',

  [ERROR_CODES.MISSING_TOKEN]: 'Authentication required',
  [ERROR_CODES.INVALID_TOKEN]: 'Invalid or expired token',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Token expired',
  [ERROR_CODES.SESSION_NOT_FOUND]: 'Session not found',
  [ERROR_CODES.SESSION_INVALID]: 'Your session is no longer valid — please sign in again',
  [ERROR_CODES.REFRESH_TOKEN_MISSING]: 'No refresh token supplied',
  [ERROR_CODES.REFRESH_TOKEN_INVALID]: 'Invalid refresh token',
  [ERROR_CODES.REFRESH_TOKEN_EXPIRED]: 'Refresh token expired',
  [ERROR_CODES.REFRESH_TOKEN_REVOKED]: 'Refresh token has been revoked',
  [ERROR_CODES.REFRESH_TOKEN_REUSED]:
    'This session has been terminated for security reasons — please sign in again',
  [ERROR_CODES.REFRESH_IN_FLIGHT]: 'A refresh is already in progress — retry shortly',

  [ERROR_CODES.CANNOT_TARGET_SELF]: 'You cannot perform this action on your own account',
  [ERROR_CODES.CANNOT_TARGET_ADMIN]: 'Demote this administrator before performing this action',
  [ERROR_CODES.LAST_ADMIN_PROTECTED]: 'At least one active administrator must remain',
};

export const SUCCESS_MESSAGES = {
  REGISTERED: 'Registration successful — check your email to verify your account',
  LOGGED_IN: 'Signed in successfully',
  LOGGED_OUT: 'Signed out successfully',
  LOGGED_OUT_ALL: 'Signed out of all other devices',
  TOKEN_REFRESHED: 'Access token refreshed',
  EMAIL_VERIFIED: 'Email verified successfully',
  // Deliberately non-committal — do not confirm whether the address exists.
  VERIFICATION_SENT: 'If that address needs verification, a new link is on its way',
  PASSWORD_RESET_SENT: 'If an account exists for that address, a reset link is on its way',
  PASSWORD_RESET: 'Password updated — sign in with your new password',
  PROFILE_UPDATED: 'Profile updated',
  PROFILE_RETRIEVED: 'Profile retrieved',
  SESSIONS_RETRIEVED: 'Sessions retrieved',
  SESSION_REVOKED: 'Session revoked',
  APPS_RETRIEVED: 'Authorized applications retrieved',
  APP_REVOKED: 'Application access revoked',
  ACCOUNT_DELETED: 'Account closed',
  CLIENT_CREATED: 'Application registered',
  CLIENT_UPDATED: 'Application updated',
  CLIENT_SECRET_ROTATED: 'Client secret rotated — the previous secret is now invalid',
  USER_SUSPENDED: 'User suspended',
  USER_REINSTATED: 'User reinstated',
  METRICS_RETRIEVED: 'Metrics retrieved',
  ACTIVITY_RETRIEVED: 'Activity retrieved',
  CONSENT_RECORDED: 'Consent recorded',
} as const;

/** Reasons written to `revokedReason` on sessions and refresh tokens. */
export const REVOKE_REASONS = {
  USER_LOGOUT: 'user_logout',
  USER_LOGOUT_ALL: 'user_logout_all',
  USER_REVOKED_SESSION: 'user_revoked_session',
  /** The user withdrew an OAuth client's access from the authorized-apps screen. */
  USER_REVOKED_APP: 'user_revoked_app',
  TOKEN_EXPIRED: 'token_expired',
  TOKEN_REUSE_DETECTED: 'token_reuse_detected',
  PASSWORD_RESET: 'password_reset',
  PASSWORD_CHANGED: 'password_changed',
  ROLE_CHANGED: 'role_changed',
  USER_SUSPENDED: 'user_suspended',
  USER_DELETED: 'user_deleted',
  ADMIN_REVOKED: 'admin_revoked',
} as const;

export type RevokeReason = (typeof REVOKE_REASONS)[keyof typeof REVOKE_REASONS];
