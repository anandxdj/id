/**
 * Frozen frontend config. Next inlines `NEXT_PUBLIC_*` at build time, so the env
 * read has to stay a direct member access — wrapping it behind a getter would
 * silently bake `undefined` into the client bundle.
 */
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const AppConfig = Object.freeze({
  apiBase,
  apiPrefix: '/api/v1',
});
