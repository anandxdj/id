# id — Internal OIDC Provider

Self-hosted **OpenID Connect** provider for universal SSO across internal projects.
Authorization Code + PKCE, discovery, JWKS, RS256 ID tokens, userinfo, and a consent screen.

- **backend/** — TypeScript · Express · Mongoose (MongoDB) · ioredis (Redis) · node-jose
- **frontend/** — Next.js (App Router), feature-based · Tailwind v4 (login + consent surfaces)

## Architecture

```
Relying-party app ──GET /oauth/authorize──▶ id backend ──302──▶ id frontend /login (+ /consent)
        ▲                                       │
        └──────── code ──▶ POST /oauth/token ──▶ { access_token (opaque), id_token (RS256) }
                                                 └──▶ GET /oauth/userinfo (Bearer)
```

Auth codes, opaque access tokens, auth requests, and first-party sessions all live in **Redis**.
Users and OAuth clients are provisioned via seed scripts (internal-only — no public registration).

## Prerequisites

- Node 22, pnpm 10
- Docker (for MongoDB + Redis): `docker compose up -d` (from repo root)

## Backend

```bash
cd backend
cp .env.example .env            # set JWT secrets, SEED_ADMIN_*, OIDC_ISSUER
pnpm install
pnpm db:up                      # mongo + redis via ../docker-compose.yml
pnpm oidc:generate-keys         # RSA signing key → cert/private-key.pem (prod; dev uses an ephemeral key)
pnpm seed:admin                 # create the admin user from SEED_ADMIN_*
pnpm seed:clients               # register internal apps (edit scripts/seed-clients.ts)
pnpm dev                        # http://localhost:4000
```

Key endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /.well-known/openid-configuration` | OIDC discovery |
| `GET /oauth/jwks` | Public signing keys |
| `GET /oauth/authorize` | Start Authorization Code + PKCE flow |
| `POST /oauth/token` | Exchange code for tokens |
| `GET /oauth/userinfo` | Claims for a Bearer access token |
| `POST /api/auth/{register,login,logout,refresh-token}`, `GET /api/auth/me` | First-party session |
| `GET /api/oauth/consent/context`, `POST /api/oauth/consent` | Consent screen backend |

Tests: `pnpm test` (unit tests always run; integration tests require Mongo+Redis and self-skip otherwise).

## Frontend

```bash
cd frontend
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:4000
pnpm install
pnpm dev                        # http://localhost:3000
```

## Folder structure

- Backend: `src/app.ts`, `src/common/{config,middleware,utils}`, `src/modules/<feature>/{controller,service,model,routes,middleware,dto}`
- Frontend: `src/app/<route-group>` (thin pages), `src/features/<feature>/{components,hooks,services,context}`, `src/components/ui`, `src/lib`, `src/types`

See `docs/plans/` for the implementation plan.
