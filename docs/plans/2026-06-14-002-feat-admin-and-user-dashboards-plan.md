---
title: "feat: Admin panel + user dashboard + activity monitoring (v2)"
type: feat
status: completed
created: 2026-06-14
depth: deep
supersedes-deferral-in: 2026-06-14-001-feat-internal-oidc-provider-plan.md
---

# feat: Admin panel + user dashboard + activity monitoring (v2)

## Summary

v1 shipped the OIDC engine (authorize/consent/token/userinfo/discovery/JWKS), first-party
sessions, seed-provisioned clients, and pluggable social connectors. v1 **deferred** the admin
dashboard, OAuth-client CRUD UI, and any usage analytics.

v2 builds the **two management surfaces** on top of that engine:

1. **User dashboard** (Google-account-like) — a signed-in user reviews and revokes the apps they've
   authorized, sees and terminates active sessions across devices, and edits their profile.
2. **Admin panel** (owner-only, role-gated) — the owner monitors users and their activity ("what
   they're doing and not"), suspends/disables accounts, and **creates OAuth clients from the UI**,
   receiving `client_id` + `client_secret` once plus an **injectable LLM config-prompt** that an
   agent pastes into a relying-party repo to wire up the OIDC client automatically.

The enabling foundation is a new **append-only activity event store** in Mongo — Redis (auth
codes/tokens/sessions) is ephemeral and can't answer "who logged in last week" or "which app is
dormant." Events are written at the auth chokepoints and read by both dashboards.

**Stack:** unchanged — TypeScript · Express · Mongoose · ioredis · node-jose · Zod · Next.js
(App Router) · React · Tailwind v4.

---

## Problem Frame

The owner runs `id` as the single identity service for all internal projects. Today, the only way
to provision a client is a seed script, there is no view into who is using `id` or how, and users
have no self-service control over their own sessions and app grants. v2 closes both gaps with one
shared substrate (the event store) feeding a user-facing dashboard and an owner-facing admin panel.

### Locked decisions (from brainstorm)

- **Monitoring depth:** event log + admin activity feed. Append-only `AuthEvent` store; per-user
  feed, last-active, dormant-app detection, basic counts. **No charts/analytics** in v2 (deferred).
- **Admin model:** single owner, all-access. Any `admin`/`superadmin` sees and manages everything.
  No app ownership, no per-admin scoping. Admin actions are themselves audited.
- **Config-prompt secrets:** the generated LLM prompt uses a `{{CLIENT_SECRET}}` **placeholder**;
  the real secret is shown **once, separately**, for the owner to paste into a secret manager. The
  secret never sits inside the prompt text.

---

## Scope Boundaries

### In scope (v2)
- `AuthEvent` append-only store (TTL-indexed) + emit at login/token/userinfo/consent/session/admin
  chokepoints.
- Session enrichment: store `{ua, ip, createdAt, lastSeenAt}` with each whitelisted session; list +
  revoke-one + revoke-all ("sign out everywhere").
- User self-service API + UI: connected apps (list + revoke), sessions (list + revoke), profile edit.
- Admin API + UI (role-gated): user list/search/detail, suspend/disable user, per-user activity feed,
  basic aggregate counts (total users, active in last N days, dormant apps).
- OAuth-client management from admin UI: create (secret shown once), rotate secret, edit redirect
  URIs / name / description / logo, suspend/unsuspend.
- LLM config-prompt generator: stack-aware template (Next.js / Express / Python) returned on app
  create, secret as placeholder.

### Deferred to follow-up
- Charts / time-series analytics dashboard (active-user trends, per-app usage over time, retention).
- Real-time activity stream (websocket/SSE).
- Email verification + password-reset wiring (still stubbed from v1).
- Public self-service user signup; bulk user import.
- Multi-admin RBAC scoping / per-app ownership (single-owner only in v2).
- Webhooks / outbound notifications on events.

### Outside this product's identity
- Acting as a SIEM / long-term cold-storage audit archive (events are TTL-bounded, not permanent).
- Per-app billing or quota enforcement.

---

## Requirements

| ID | Requirement |
|----|-------------|
| R9  | Auth-significant actions (login ok/fail, token issued, userinfo accessed, consent granted/revoked, session created/revoked, admin mutations) are recorded as immutable, queryable events with actor, client, ip, ua, timestamp. |
| R10 | A signed-in user can list the apps they've authorized, see when each was last used, and revoke an app — revocation deletes the consent and invalidates that app's outstanding access tokens. |
| R11 | A signed-in user can list active sessions (device/UA/ip/last-seen), revoke any one, and "sign out everywhere"; the current session is marked. |
| R12 | A signed-in user can view and edit their own profile (name, picture, bio, jobTitle, company, country) but not their role. |
| R13 | An admin can list/search users and open a user detail showing that user's sessions, authorized apps, and activity feed. |
| R14 | An admin can suspend/disable a user — a disabled user cannot log in or complete authorize, and existing sessions are revoked. |
| R15 | An admin can create an OAuth client from the UI and receive `client_id` + `client_secret` exactly once, plus a copy-paste LLM config-prompt with the secret as a placeholder. |
| R16 | An admin can rotate a client secret, edit a client's redirect URIs/name/description/logo, and suspend/unsuspend a client; a suspended client is rejected at authorize/token. |
| R17 | All admin-only API routes and the admin UI route group reject non-admin users (403 / redirect). |
| R18 | Backend additions follow the v1 modules layout; frontend additions follow the v1 feature-based layout. |

---

## High-Level Technical Design

*Directional guidance for review, not implementation spec.*

```
                         ┌─────────────────────────────────────────────┐
   login / token /       │           id backend (:4000)                │
   userinfo / consent ──▶│  chokepoints ──emit──▶ events.service       │
                         │                          │                  │
                         │                          ▼                  │
                         │                    Mongo: AuthEvent (TTL)    │
                         │                          ▲                  │
   /api/me/*  (user) ────┼──── account.service ─────┤                  │
   /api/admin/* (admin)──┼──── admin.service ───────┘                  │
                         └─────────────────────────────────────────────┘
        ▲                                   ▲
        │ (auth)                            │ authorize('admin')
   FE (account) group                  FE (admin) group
   Security · Apps · Profile           Users · Activity · Apps(+create wizard)
```

**Event model.** `AuthEvent { actorUserId?, actorRole?, type, clientId?, targetUserId?, ip, ua,
meta, createdAt }`. `type` is an enum (`login.success`, `login.fail`, `token.issued`,
`userinfo.access`, `consent.granted`, `consent.revoked`, `session.created`, `session.revoked`,
`admin.user.suspended`, `admin.client.created`, `admin.client.secret_rotated`, …). TTL index on
`createdAt` (retention via `EVENT_RETENTION_DAYS`, default 90). Append-only — no update/delete API.

**Emit, don't couple.** A single `events.record(type, ctx)` helper called from the existing
controllers/services. It must **never throw into the request path** — failures are logged and
swallowed (monitoring must not break auth). Fire-and-forget write.

**Session enrichment.** Today `session:<userId>:<sid>` is a whitelist marker. Change the stored
value to a small JSON blob `{ ua, ip, createdAt, lastSeenAt }` (same key, same TTL). `authenticate`
refreshes `lastSeenAt` opportunistically. Listing a user's sessions = `SCAN session:<userId>:*`.

**Revoke semantics.** Revoking an app deletes the `Consent` row and deletes that user's
`access_token:*` entries scoped to that `clientId` (access tokens already store `{userId, clientId,
scope}` in Redis — filter on resolve or maintain a `user_tokens:<userId>` index set). Revoking a
session deletes the `session:<userId>:<sid>` key. Disabling a user revokes all their sessions.

**Config-prompt.** `buildClientConfigPrompt(client, { stack })` returns a markdown string embedding
issuer, discovery URL, `client_id`, redirect URIs, scopes, endpoint list, PKCE/S256 instructions,
and `{{CLIENT_SECRET}}` placeholder + the env var name to store it under. Stack switch tailors the
"now wire it up" instructions (Next.js App Router / Express / Python).

---

## Output Structure (additions only)

```
backend/src/modules/
├── events/
│   ├── event.model.ts            # AuthEvent schema, TTL index, type enum
│   ├── event.service.ts          # record(type, ctx) [non-throwing], query helpers
│   └── event.types.ts            # EventType union + ctx shape
├── account/                      # user self-service ("/api/me")
│   ├── account.controller.ts
│   ├── account.service.ts        # listApps, revokeApp, listSessions, revokeSession, revokeAll, updateProfile
│   ├── account.routes.ts         # all behind `authenticate`
│   └── dto/profile.schema.ts
├── admin/                        # owner-only ("/api/admin")
│   ├── admin.controller.ts
│   ├── admin.service.ts          # listUsers, getUser, suspendUser, userActivity, metrics
│   ├── admin.routes.ts           # all behind `authenticate` + `authorize('admin')`
│   ├── client-prompt.util.ts     # buildClientConfigPrompt(client, {stack})
│   └── dto/{create-client.schema.ts,update-client.schema.ts,suspend-user.schema.ts}
└── oauth-client/
    └── oauth-client.service.ts   # EXTEND: create/list/getById/update/rotateSecret/suspend

backend/src/modules/auth/auth.service.ts   # session value → {ua,ip,createdAt,lastSeenAt}; helpers
backend/src/app.ts                          # mount /api/me, /api/admin

frontend/src/app/
├── (account)/account/
│   ├── page.tsx                  # overview (existing → expand to hub)
│   ├── security/page.tsx         # sessions list + sign-out-everywhere
│   ├── apps/page.tsx             # connected apps + revoke
│   └── profile/page.tsx          # edit profile
└── (admin)/
    ├── layout.tsx                # role gate (redirect non-admin)
    ├── admin/page.tsx            # dashboard: counts + recent activity
    ├── admin/users/page.tsx      # users table + search
    ├── admin/users/[id]/page.tsx # user detail: sessions/apps/activity
    └── admin/apps/
        ├── page.tsx              # clients list
        └── new/page.tsx          # create wizard → secret-once + config-prompt

frontend/src/features/
├── account/{services/accountApi.ts, components/{SessionList,AppList,ProfileForm}.tsx}
└── admin/{services/adminApi.ts, components/{UsersTable,UserDetail,ActivityFeed,CreateClientWizard,ConfigPromptBlock,ClientsTable}.tsx}
```

Per-unit `**Files:**` are authoritative.

---

## Key Technical Decisions

- **Event store is the substrate, not a side-feature.** Build it first (M1); both dashboards read
  from it. Append-only + TTL-indexed; recording is fire-and-forget and must never fail a request.
- **Reuse existing auth primitives.** `authenticate`, `tryAttachUser`, `authorize('admin')`, the
  Redis session whitelist, and the `Consent`/`OAuthClient` models already exist — v2 adds services
  and surfaces over them, not new auth machinery.
- **Single-owner, no tenancy.** No `ownerId` on clients, no per-admin scoping. Admins see all.
  Revisit only if multi-admin is ever needed.
- **Secret hygiene.** Client secret is returned exactly once (create + rotate); never stored in
  plaintext, never embedded in the config-prompt. UI shows it once with a copy button and a warning.
- **Disable = hard stop.** A `disabled` (or reuse `suspended`-style) flag on User blocks login and
  authorize and revokes sessions — enforced in `authenticate`/`tryAttachUser` and the login path.
- **No new infra.** Mongo + Redis only. Events live in Mongo; everything else as in v1.

---

## Implementation Units

### M1. Activity event store + instrumentation

**Goal:** Append-only `AuthEvent` collection, a non-throwing `record()` emitter, and emit calls at
every auth chokepoint. This is the foundation both dashboards read.

**Requirements:** R9.

**Dependencies:** v1 (auth, oauth, consent).

**Files:**
- `backend/src/modules/events/{event.model.ts,event.service.ts,event.types.ts}`
- emit calls added to: `auth.service.ts` (login ok/fail, session created/revoked),
  `oauth.service.ts` (token issued, consent granted), `oauth-access.middleware.ts` (userinfo access),
  consent revoke path (M3), admin mutations (M4)
- `.env.example`: `EVENT_RETENTION_DAYS=90`

**Approach:** `AuthEvent` schema with `createdAt` TTL index (`expireAfterSeconds` from retention).
`record(type, ctx)` resolves actor/ip/ua from a passed request-context object and writes
fire-and-forget inside a `try/catch` that only logs on failure. Provide `query({actorUserId, type,
clientId, from, to, limit, cursor})` for the read side. Extract ip/ua via a small `reqContext(req)`
helper (honor `X-Forwarded-For` when `trust proxy`).

**Test scenarios:**
- `record('login.success', ctx)` persists one document with actor, ip, ua, type, `createdAt`.
- `record()` with a forced DB failure does **not** throw and logs a warning (auth path unaffected).
- TTL index exists on `createdAt` with the configured `expireAfterSeconds`.
- `query({type})` filters by type and respects `limit`; results are newest-first.
- No update/delete is exposed on the model surface.

**Verification:** Drive a login + token + userinfo flow; confirm the expected event sequence is
recorded with correct `clientId`/`actorUserId`.

---

### M2. Session enrichment + revocation primitives

**Goal:** Store device metadata with each session and expose list / revoke-one / revoke-all
building blocks (consumed by M3 user API and M4 admin API).

**Requirements:** R11 (advances R14).

**Dependencies:** M1.

**Files:**
- `backend/src/modules/auth/auth.service.ts` — session value becomes `{ua,ip,createdAt,lastSeenAt}`;
  add `listSessions(userId)`, `revokeSession(userId, sid)`, `revokeAllSessions(userId, exceptSid?)`
- `backend/src/modules/auth/auth.middleware.ts` — refresh `lastSeenAt` on `authenticate`

**Approach:** On login, write the JSON blob under the existing `session:<userId>:<sid>` key (same
TTL). `listSessions` does `SCAN MATCH session:<userId>:*`. Revoke deletes the key(s) and emits
`session.revoked`. `revokeAllSessions(except)` keeps the caller's current session when asked. Keep
the value backward-compatible (tolerate a legacy marker value).

**Test scenarios:**
- Login stores a session blob with `ua`, `ip`, `createdAt`; `lastSeenAt` updates on next authenticated request.
- `listSessions` returns all of a user's sessions and flags none/one as current depending on caller sid.
- `revokeSession` deletes exactly that sid; the revoked session is then rejected by `authenticate`.
- `revokeAllSessions(except=current)` kills every other session but preserves the caller's.
- Each revoke emits a `session.revoked` event.

**Verification:** Two simultaneous logins (two sids); revoke one → the other still works, revoked one 401s.

---

### M3. User self-service API + (account) routes

**Goal:** `/api/me/*` endpoints powering connected-apps, sessions, and profile — all behind
`authenticate`.

**Requirements:** R10, R11, R12.

**Dependencies:** M1, M2.

**Files:**
- `backend/src/modules/account/{account.controller.ts,account.service.ts,account.routes.ts}`
- `backend/src/modules/account/dto/profile.schema.ts`
- `backend/src/modules/oauth-client/oauth-client.service.ts` — `getByClientId` for app display
- mount `/api/me` in `app.ts`

**Approach:** `listApps` joins the user's `Consent` rows with client display fields and a
`lastUsedAt` derived from the latest `token.issued`/`userinfo.access` event per `clientId`.
`revokeApp(userId, clientId)` deletes the consent, deletes that user's access tokens for that
client, emits `consent.revoked`. Sessions endpoints delegate to M2. `updateProfile` whitelists
editable fields (Zod) and **forbids** `role`/`email`/`isVerified`.

**Endpoints:** `GET /api/me/apps`, `DELETE /api/me/apps/:clientId`, `GET /api/me/sessions`,
`DELETE /api/me/sessions/:sid`, `POST /api/me/sessions/revoke-all`, `GET /api/me/profile`,
`PATCH /api/me/profile`.

**Test scenarios:**
- `GET /api/me/apps` returns only the caller's consents with client name + `lastUsedAt`.
- `DELETE /api/me/apps/:clientId` removes the consent and the client's access tokens; a subsequent userinfo with an old token 401s; emits `consent.revoked`.
- `PATCH /api/me/profile` updates allowed fields; attempting to set `role` is ignored/rejected.
- All `/api/me/*` routes 401 without a valid session.
- Revoking an app the user never authorized → 404, no event.

**Verification:** Authorize an app, use it, then revoke from the API → tokens dead, consent gone,
event recorded.

---

### M4. Admin API: users, activity, client management + config-prompt

**Goal:** Owner-only `/api/admin/*` — user monitoring/management, OAuth-client CRUD with
secret-once + rotation, and the LLM config-prompt generator.

**Requirements:** R13, R14, R15, R16, R17, R9 (admin actions audited).

**Dependencies:** M1, M2, M3 (revoke primitives), v1 oauth-client model.

**Files:**
- `backend/src/modules/admin/{admin.controller.ts,admin.service.ts,admin.routes.ts}`
- `backend/src/modules/admin/client-prompt.util.ts`
- `backend/src/modules/admin/dto/{create-client.schema.ts,update-client.schema.ts,suspend-user.schema.ts}`
- `backend/src/modules/auth/auth.model.ts` — add `disabled: { type: Boolean, default: false }`
- `backend/src/modules/auth/{auth.middleware.ts,auth.service.ts}` — reject `disabled` users at
  login + `authenticate`/`tryAttachUser`
- `backend/src/modules/oauth-client/oauth-client.service.ts` — `create`, `list`, `update`,
  `rotateSecret`, `setSuspended`
- `backend/src/modules/oauth/oauth.service.ts` — already rejects `suspended` clients at
  authorize/token (verify/keep)
- mount `/api/admin` (behind `authenticate` + `authorize('admin')`) in `app.ts`

**Approach:** Reuse `authorize('admin')`. `listUsers` paginates + text-search on name/email.
`getUser` aggregates sessions (M2), apps (M3), and recent activity (M1 `query`). `suspendUser` sets
`disabled`, revokes all sessions, emits `admin.user.suspended`. Client CRUD wraps the extended
oauth-client service; `create`/`rotateSecret` return the raw secret once and emit events.
`buildClientConfigPrompt` produces the stack-aware markdown with `{{CLIENT_SECRET}}` placeholder.
Every admin mutation emits an `admin.*` event (admin actions are audited).

**Endpoints:** `GET /api/admin/users`, `GET /api/admin/users/:id`, `POST /api/admin/users/:id/suspend`,
`POST /api/admin/users/:id/unsuspend`, `GET /api/admin/metrics`, `GET /api/admin/activity`,
`GET /api/admin/clients`, `POST /api/admin/clients`, `PATCH /api/admin/clients/:clientId`,
`POST /api/admin/clients/:clientId/rotate-secret`, `POST /api/admin/clients/:clientId/suspend`,
`GET /api/admin/clients/:clientId/config-prompt?stack=nextjs`.

**Test scenarios:**
- A `user`-role token gets 403 on every `/api/admin/*` route; an `admin` token succeeds.
- `POST /api/admin/clients` returns `client_id` + a one-time `client_secret`; re-fetching the client never returns the secret again; emits `admin.client.created`.
- `rotate-secret` returns a new secret once, invalidates the old (old secret fails at `/oauth/token`), emits an event.
- `suspend` a user → `disabled:true`, their sessions revoked, they can no longer log in or authorize; emits `admin.user.suspended`.
- A suspended **client** is rejected at `/oauth/authorize` and `/oauth/token`.
- `config-prompt` contains the issuer, discovery URL, real `client_id`, redirect URIs, scopes, and a `{{CLIENT_SECRET}}` placeholder — and does **not** contain the real secret.
- `getUser` returns the target's sessions + apps + recent events.

**Verification:** As admin: create a client via API, copy the config-prompt, complete a real
authorize→token flow with the new client; suspend a test user and confirm they're locked out.

---

### M5. User dashboard UI ((account) route group)

**Goal:** Google-account-style surfaces: overview hub, Security (sessions), Connected apps, Profile.

**Requirements:** R10, R11, R12, R18.

**Dependencies:** M3.

**Files:**
- `frontend/src/app/(account)/account/{page.tsx,security/page.tsx,apps/page.tsx,profile/page.tsx}`
- `frontend/src/features/account/services/accountApi.ts`
- `frontend/src/features/account/components/{SessionList,AppList,ProfileForm,AccountNav}.tsx`

**Approach:** Thin pages render feature components; `accountApi` wraps `/api/me/*` via the existing
`api-client` (silent-refresh aware). `SessionList` marks the current session and offers per-row
revoke + a "Sign out everywhere" action. `AppList` shows name/logo/scopes/last-used with a revoke
confirm. `ProfileForm` edits whitelisted fields. Reuse existing `ui/` primitives.

**Test scenarios:**
- Apps page lists authorized apps; revoke removes the row and calls `DELETE /api/me/apps/:clientId`.
- Security page lists sessions, current one badged; "sign out everywhere" calls revoke-all and keeps the session valid.
- Profile edit submits a `PATCH` and reflects saved values; role is not shown as editable.
- Logged-out visit to any `(account)` page redirects to `/login`.

**Verification:** Manual: authorize an app, see it on the dashboard, revoke it, confirm it's gone
and the app must re-consent next time.

---

### M6. Admin panel UI ((admin) route group) + create-client wizard

**Goal:** Role-gated admin surfaces — dashboard, users table + detail, activity feed, clients list,
and a **create-client wizard** that reveals `client_id`/`client_secret` once plus the config-prompt.

**Requirements:** R13, R14, R15, R16, R17, R18.

**Dependencies:** M4, M5.

**Files:**
- `frontend/src/app/(admin)/layout.tsx` (redirect non-admin), `admin/page.tsx`,
  `admin/users/{page.tsx,[id]/page.tsx}`, `admin/apps/{page.tsx,new/page.tsx}`
- `frontend/src/features/admin/services/adminApi.ts`
- `frontend/src/features/admin/components/{UsersTable,UserDetail,ActivityFeed,ClientsTable,CreateClientWizard,ConfigPromptBlock,SecretRevealOnce}.tsx`

**Approach:** `(admin)/layout.tsx` reads `useAuth().user.role` and redirects non-admins (server
data still enforces; UI gate is convenience). Dashboard shows metric cards + recent activity feed.
Users table paginates/searches; detail drills into sessions/apps/activity with suspend/unsuspend.
`CreateClientWizard` posts to create, then renders `SecretRevealOnce` (copy + "you won't see this
again" warning) and `ConfigPromptBlock` with a stack selector (Next.js/Express/Python) + copy
button. Clients table offers rotate-secret/edit/suspend.

**Test scenarios:**
- Non-admin navigating to `/admin/*` is redirected; admin sees the panel.
- Create-client wizard shows the secret exactly once and a config-prompt containing the placeholder, not the secret.
- Switching the stack selector re-renders the config-prompt for that stack.
- Suspend in user detail flips status and (per backend) locks the user out.
- Rotate-secret reveals a new secret once and warns the old one is now invalid.

**Verification:** Full manual E2E as owner: create an app in the UI → paste config-prompt into a
relying-party repo's agent → app integrates → complete a real login through `id`; then monitor that
login in the admin activity feed.

---

## System-Wide Impact

| Surface | Impact |
|---------|--------|
| Mongo | New `AuthEvent` collection, write-heavy (one+ doc per auth action). TTL-bounded; index on `createdAt` + common query fields. |
| Auth hot paths | login/token/userinfo now emit events — must stay fire-and-forget and non-blocking. |
| Redis session value | Shape changes from marker → JSON blob; needs backward-compat read during rollout. |
| User model | New `disabled` flag gates login + authorize. |
| Frontend | Two new route groups; admin group must be role-gated server-side too (don't trust client). |
| Access-token revocation | Requires resolving tokens by `(userId, clientId)` — confirm the Redis token record carries `clientId` (it does per v1) or add a `user_tokens:<userId>` index set. |

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Event write fails and breaks an auth request | Med | High | `record()` is try/catch + fire-and-forget; never awaited in a way that can reject the request. Unit-test the forced-failure path. |
| Event collection unbounded growth | Med | Med | TTL index (`EVENT_RETENTION_DAYS`); document retention; consider a capped collection if volume spikes. |
| Admin route exposed to non-admin (privilege escalation) | Low | High | Server-side `authorize('admin')` on every route; UI gate is cosmetic only. Test 403 on each route. |
| Client secret leaks via config-prompt / chat history | Low | High | Placeholder-only in prompt; secret shown once in a dedicated reveal block with a copy + warning; never re-fetchable. |
| Session-blob migration breaks live sessions | Low | Med | Read path tolerates the legacy marker value; new shape written on next login. |
| Revoke-app misses some access tokens | Med | Med | Maintain `user_tokens:<userId>` set or filter token records by `clientId` on resolve; test that a revoked app's old token 401s. |
| PII in events (ip/ua) | Med | Med | TTL retention bounds exposure; document what's stored; keep `meta` minimal — no secrets/tokens in event payloads. |

---

## Dependencies / Prerequisites

- v1 merged (or this work branches from `feat/oidc-provider`).
- Mongo + Redis (unchanged).
- Decide `EVENT_RETENTION_DAYS` (default 90) and whether `X-Forwarded-For` is trusted (set Express
  `trust proxy` accordingly behind a real proxy).

---

## Deferred Implementation Notes (resolve during execution)

- Whether to reuse the existing `suspended`-style pattern or add a distinct `disabled` field on User
  (decide at M4; `disabled` is clearer than overloading verification fields).
- Exact `lastUsedAt` derivation for apps (latest `token.issued` vs `userinfo.access` — pick the
  broader signal; index events by `(actorUserId, clientId, createdAt)`).
- Pagination strategy for users/activity (cursor vs skip/limit — cursor preferred for the feed).
- Final list of config-prompt target stacks beyond Next.js/Express/Python.
- Whether admin metrics need any caching (v2: compute on read; revisit if slow).
```
