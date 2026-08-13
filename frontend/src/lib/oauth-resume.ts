import { AppConfig } from '@/lib/config';

/**
 * Validate a `return_to` value before redirecting the browser to it. Only the
 * provider's own /oauth/authorize endpoint is allowed — this blocks the login page
 * from being abused as an open redirect.
 */
export function safeReturnTo(returnTo: string | null | undefined): string | null {
  if (!returnTo) return null;
  try {
    const target = new URL(returnTo);
    const api = new URL(AppConfig.apiBase);
    const sameOrigin = target.origin === api.origin;
    const isAuthorize = target.pathname === '/oauth/authorize';
    return sameOrigin && isAuthorize ? target.toString() : null;
  } catch {
    return null;
  }
}

/** Navigate the browser to a validated return_to, or fall back. Returns true if it redirected. */
export function resumeOAuth(returnTo: string | null | undefined): boolean {
  const safe = safeReturnTo(returnTo);
  if (safe) {
    window.location.href = safe;
    return true;
  }
  return false;
}
