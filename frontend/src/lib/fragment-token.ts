/**
 * Tokens in emailed links travel in the URL fragment so they never hit a server log.
 * Read once, then strip the fragment so the back button does not keep a live credential.
 */
export const FragmentToken = {
  read(param = 'token'): string | null {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const value = new URLSearchParams(hash).get(param);
    return value && value.length > 0 ? value : null;
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  },
};
