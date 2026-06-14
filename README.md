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
OAuth clients (the relying-party apps) are provisioned via seed scripts. End users sign in with
**email/password or any enabled social connector** (Google, GitHub, …) — all landing in one user DB.

## Social login connectors (adapter pattern)

`id` is the central identity store for all your projects. Login methods are pluggable connectors
(`backend/src/modules/auth/connectors/`) implementing one `OAuthConnector` interface. A connector
is **enabled automatically when its credentials are present**; `AUTH_CONNECTORS` optionally narrows
to a subset. This is the per-deployment toggle — no code change to turn a provider on/off.

| Connector | Enable by setting |
|-----------|-------------------|
| Google | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` |
| GitHub | `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` |
| Email/password | always on (`credentials`) |

Redirect/callback URLs to register with the provider:
- Google: `http://localhost:4000/api/auth/oauth/google/callback`
- GitHub: `http://localhost:4000/api/auth/oauth/github/callback`

**User model:** one canonical `User` (email-unique) with many linked `Identity` records
(`provider` + `providerAccountId`). A social login links to an existing user **only when the
provider asserts the email is verified** — otherwise it's a new account (account-takeover guard).
Add a new provider by dropping a `*.connector.ts` into `connectors/` and registering it.

Connector endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/auth/connectors` | List enabled providers (UI renders a button per entry) |
| `GET /api/auth/oauth/:provider` | Start social login (→ provider consent) |
| `GET /api/auth/oauth/:provider/callback` | Finish → find/create user → session → bridge to frontend |

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
| `GET/DELETE /api/me/apps[/:clientId]`, `GET/DELETE /api/me/sessions[/:sid]`, `GET/PATCH /api/me/profile` | User self-service (dashboard) |
| `GET /api/admin/{users,metrics,activity,clients}`, `POST /api/admin/clients` (+ rotate/suspend) | Admin panel (role-gated) |

## Dashboards (v2)

Two surfaces sit on top of the OIDC engine, fed by an append-only **activity event
store** (Mongo, TTL-bounded via `EVENT_RETENTION_DAYS`) written at every auth chokepoint:

- **User dashboard** (`/account`) — Google-style: connected apps (revoke kills the
  app's live tokens), active sessions (revoke / sign-out-everywhere), and profile editing.
- **Admin panel** (`/admin`, admin role only) — usage metrics + activity feed, user
  search/detail with disable/reinstate, and OAuth-client management: create (secret shown
  **once**), rotate secret, suspend. Creating an app also emits a **stack-aware LLM
  config-prompt** (Next.js / Express / Python) — paste it into a coding agent in the
  relying-party repo to wire the OIDC client automatically. The prompt carries a
  `{{CLIENT_SECRET}}` placeholder only; the real secret is revealed separately.

See `docs/plans/2026-06-14-002-*` for the v2 implementation plan.

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
