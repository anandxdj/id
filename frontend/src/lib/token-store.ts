let _token: string | null = null;

/** In-memory access token. Lives only for the tab session; refreshed via the httpOnly cookie. */
export const tokenStore = {
  get: () => _token,
  set: (token: string | null) => {
    _token = token;
  },
};
