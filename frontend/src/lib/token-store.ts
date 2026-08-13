type TokenListener = (token: string | null) => void;

let _token: string | null = null;
const listeners = new Set<TokenListener>();

/** In-memory access token. Lives only for the tab session; refreshed via the httpOnly cookie. */
export const tokenStore = {
  get: () => _token,
  set: (token: string | null) => {
    _token = token;
    for (const listener of listeners) listener(token);
  },
  subscribe(listener: TokenListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
