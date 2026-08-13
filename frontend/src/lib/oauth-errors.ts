import { OAUTH_ERROR_COPY } from './constants';

/** Map an OAuth `error` query value to human copy. Unknown codes do not echo the raw token. */
export const OAuthErrors = {
  messageFor(code: string | null | undefined): string | null {
    if (!code) return null;
    return OAUTH_ERROR_COPY[code] ?? 'Sign-in failed. Please try again.';
  },
};
