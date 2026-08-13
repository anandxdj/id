# 003 — Port the reference IdP feature set onto our Mongo stack

**Status:** §3 signed off (see §8) — **M0, M1, M2 complete**; M3 next (M2 ∥ M3 per §5)
**Reference:** `github.com/imohit159/oidc-oauth-1o1` (read-only study copy)
**Scope:** backend + shared contracts only. Our UI stays ours; the reference frontend is not ported.

---

## 1. The headline: this is a re-implementation, not a copy

| | Reference | Ours |
|---|---|---|
| Database | PostgreSQL | MongoDB |
| Data layer | Drizzle ORM + 5 SQL migrations | Mongoose schemas |
| Repo shape | pnpm + turbo monorepo (`apps/*`, `packages/*`) | two sibling folders (`backend/`, `frontend/`) |
| Passwords | `argon2` (Argon2id, 64 MiB, t=3, p=4) | `bcryptjs` cost 12 |
| JOSE | `jose` | `node-jose` |
| Ephemeral state | Postgres rows + `expires_at` | Redis keys + `EX` → **becoming Mongo TTL collections** |
| Routes | `/api/v1/{resource}` | `/api/{resource}` (unversioned) |
| Email | Resend + HTML templates | stub (`common/config/email.ts`) |

**Zero files can be copied verbatim.** Every model is a `pgTable`, every query is a Drizzle builder, every multi-write is `db.transaction`. What we port is the *design*: the data model, the flow algorithms, the security invariants, and the module conventions — re-expressed in Mongoose.

Second headline: **the reference has zero Redis.** Confirmed — `ioredis` appears nowhere in `apps/api`; the only hits are two prose mentions in `docs/`. Login throttles, auth-action tokens, sessions, refresh tokens, authorization codes, and signing keys are all Postgres tables. So dropping Redis isn't a deviation from the thing we're copying; it *is* the thing we're copying.

---

## 2. What we gain, what we already do better, what we must not copy

### 2.1 Net new capability (we have none of this today)

| Capability | Reference source | Value |
|---|---|---|
| Email verification (issue / verify / resend) | `identity` + `auth_action_tokens` | **critical** — we ship a public register page and assert `email_verified: false` to every RP forever |
| Forgot / reset password | same | **critical** — users can currently create accounts they can never recover |
| Email delivery + templates | `notifications` (Resend) | required by the above |
| Login throttling per identity | `login_throttles` | closes distributed credential stuffing |
| Persistent, revocable refresh tokens with rotation + lineage | `refresh_tokens` | **highest-value port.** Ours is a bare JWT with no server row, no rotation, no revocation |
| Argon2id password hashing | `security/password.service` | OWASP-current; replaces bcryptjs |
| DB-backed signing keys | `oauth_signing_keys` | prerequisite for key rotation (design ours properly — theirs is broken, §2.3) |
| Audit log with actor/target/action/status semantics | `audit` | our `AuthEvent` has a closed type enum and no `status` |
| `ua-parser-js` device naming | `identity.controller` | "Chrome on Windows" instead of a raw UA string |
| `/api/v1` versioning | `app.ts` | our rule 15, currently violated everywhere |
| Frozen zod-validated env config, fail-fast at boot | `config/env.ts` | our rule 2, currently violated 30+ times |
| Postman collections | `postman/*.json` | our rule 3, currently no collection exists |
| CI/CD workflows + `tsup` build | `.github/workflows`, `tsup.config.ts` | we have no CI and run `tsx` in production |
| RP client SDK | `packages/auth-library` | the single biggest lever — every RP integration is currently hand-rolled OIDC |
| Coding-standards + business-rules docs | `docs/06`, `docs/04` | our house rules descend from these; adopt the parts we're missing |

### 2.2 What ours already does better — do not regress any of these

1. **Per-request session validation.** Our `auth.middleware.ts` checks the session whitelist, that the user exists, and that `user.disabled` is false. **The reference does none of it** — its `authenticate` never touches the DB, so a suspended, deleted, or demoted admin keeps full authority for the access token's remaining 15 minutes.
2. **Working social login.** Google + GitHub connectors with an adapter registry and a correct email-verified linking guard. The reference's `getSupportedAuthProviders` advertises `/api/v1/identity/google` — **a route that does not exist**. Its social login is decorative.
3. **A real admin surface.** User list with escaped-regex search, user detail, metrics, activity feed, and full OAuth-client management. The reference admin module has exactly four endpoints (suspend/unsuspend/delete/audit-list) and no user list at all.
4. **Rate limiting exists.** The reference has no rate-limit package anywhere — `/login`, `/register`, `/forgot-password`, and `/oauth/token` are all unbounded.
5. **`app.set('trust proxy')` + `req.ip`.** The reference reads raw `x-forwarded-for` with no trust-proxy config, so every logged IP is client-forgeable.
6. **Opaque, revocable OAuth access tokens** with RFC 6749-shaped errors and error *redirects*. The reference issues JWT access tokens it cannot revoke.
7. **S256-only PKCE.** The reference implements and advertises `plain`.
8. **TTL indexes already in production use** (`event.model.ts`) — the exact pattern the whole port depends on.
9. **`targetUserId` as a distinct field**, proper actor/target modelling. The reference overloads `entity_id`.
10. **Scope-gated claims**, `revokeAllSessions(userId, exceptSid)`, UA length capping, explicit 404 fallthrough.

### 2.3 Bugs in the reference we must fix, not inherit

Ranked by severity. Every one of these is in code we would otherwise have copied.

| # | Severity | The bug |
|---|---|---|
| 1 | **Critical** | **OAuth access tokens share the signing key with first-party session tokens and carry no `aud`/`iss`.** A third-party client's access token passes the reference's own `authenticate` middleware — so any RP can use a user's OAuth token to manage clients or revoke consents. Full privilege confusion. |
| 2 | **Critical** | **Permanent account lockout.** `failedAttempts` is only reset by a *successful* login, but the check throws whenever `failedAttempts >= 5` *before* credentials are examined — so a successful login is unreachable. **Five unauthenticated requests permanently brick any known email.** `lockedUntil` elapsing does not release it. |
| 3 | **Critical** | **Refresh-token reuse detection does not exist.** The lineage columns (`rotated_at`, `parent_refresh_token_id`, `replaced_by_refresh_token_id`, `token_jti`) are all written and **read by nothing**. The lookup filters `revoked_at IS NULL` only, so a rotated token stays valid for its full 30 days and re-rotates, forking the family. Strictly *worse* than not rotating — it advertises the protection while providing none. |
| 4 | **Critical** | **`iss` is hardcoded to `http://localhost:8000`** in the ID token while discovery advertises `APP_URL`. Every deployment that isn't localhost breaks every conformant RP. |
| 5 | **High** | **`kid` is the literal string `"default"`, and the key-sync routine no-ops once a row with that `kid` exists** — so the JWKS endpoint freezes permanently after the first request. Key rotation is structurally impossible. Access tokens carry no `kid` at all, so adding a second key throws `JWKSMultipleMatchingKeys` on every verification. *This is the feature we most wanted to copy, and it is the most broken thing in the repo.* |
| 6 | **High** | **Registration stores the raw-case email while every lookup normalizes it.** Sign up as `Foo@Bar.com` and you can never log in, never reset, never resend — and the duplicate check misses you, so a second account can exist on the same mailbox. |
| 7 | **High** | **No unique index on `user_identities.email`.** The only duplicate guard is read-then-insert. Concurrent registrations both succeed. |
| 8 | **High** | **Non-atomic single-use enforcement** on both verify-email and reset-password: `SELECT … consumed_at IS NULL` then a separate `UPDATE` with no guard. Concurrent redemptions both succeed and both mint sessions. |
| 9 | **High** | **Re-issue never revokes prior tokens.** N password-reset requests = N simultaneously valid reset tokens, each live a full hour. |
| 10 | **High** | **Lost-update race in the throttle counter** — read-then-write with no atomic increment, so a parallel burst of guesses counts as one failure. The 5-attempt limit is bypassable by concurrency. |
| 11 | **High** | **No account-state check on token redemption.** A suspended or soft-deleted user can redeem a pre-existing verification token and receive a fresh session. Full suspension bypass. |
| 12 | **High** | **Consent is an existence check, not a scope comparison** (same bug we already have) — a client approved for `openid` silently obtains `openid profile email`. |
| 13 | **Medium** | **User enumeration on four endpoints** with distinct status codes, plus an Argon2 timing oracle on the unknown-user login path, plus an `EMAIL_NOT_VERIFIED` 403 returned *after* a successful password check and *without* incrementing the throttle. |
| 14 | **Medium** | **Verification and reset tokens travel in URL query strings**, and the email service logs the entire HTML body — including the tokenised link — whenever Resend is unconfigured. |
| 15 | **Medium** | **Refresh tokens survive password reset, account deletion, and admin soft-delete** — only the session row is revoked. |
| 16 | **Medium** | **Soft delete permanently burns the email address** — the identity row survives un-revoked, so re-registration hits `EMAIL_EXISTS` forever. |
| 17 | **Medium** | **Admins are unprotected from admins.** No self-suspend guard, no admin-deletes-admin guard, no last-admin guard — one admin can delete every other admin including the last one. Their own business-rules doc mandates all three. |
| 18 | **Medium** | Every `logger.*(msg, { error })` call logs `{}`, because `JSON.stringify(Error)` returns `{}`. Boot and DB-connection failures are invisible. |
| 19 | **Medium** | **3 indexes across 13 tables.** Six FKs the design doc mandates were never emitted. `audit_logs` has none, yet the admin endpoint does `COUNT(*)` + `ORDER BY created_at DESC` + `OFFSET` on it. |
| 20 | **Medium** | The OAuth Postman collection points at `/authorize`, `/token`, `/userinfo` while the real routes are `/api/v1/oauth/*` — 3 of 6 requests 404. |
| 21 | **Medium** | **The SDK's documented usage pattern leaks tokens across users.** `OAuth2Error`'s credential bag is a public mutable instance field, and both the README and the example instantiate one module-scope client used inside Express handlers. Alice's callback overwrites Bob's tokens. |
| 22 | **Medium** | SDK access-token verification pins neither `iss` nor `aud`, so an ID token presented as a bearer token verifies as an access token. |

Reference things that *are* right and should be copied deliberately: SHA-256-hashed tokens at rest, type-discriminated action tokens (no verify/reset confusion), absolute (non-sliding) refresh windows, no stack traces to clients, pure-schema models, try-catch in every controller, S256 PKCE in the SDK, `alg` pinning on verification, and no `Math.random` anywhere.

---

## 3. Architecture decisions requiring sign-off

### D1 — ~~Remove Redis~~ → **Demote Redis to a cache-and-counter tier** (revised)

> **Revised after BOSS confirmed Redis is already running in production.** The original
> argument for removal was reference parity — the reference IdP has no Redis. That is an
> observation, not an architecture rationale, and it does not survive the new fact: if
> Redis is already provisioned, monitored, and paid for, the marginal operational cost of
> keeping it is zero, and *deleting* it would cost us the one thing it is genuinely best
> at.
>
> **The load-bearing reason to keep it: correct distributed rate limiting.**
> `express-rate-limit`'s default store is per-process memory. With N replicas each client
> gets N× its budget, and every deploy resets all counters. On an authentication API that
> is not a performance detail, it is the difference between brute-force protection and
> the appearance of it. A shared atomic counter is mandatory, and `INCR`/`EXPIRE` is
> exactly that: one round trip, no index maintenance, no oplog entry, O(1) expiry.
>
> **The rule that replaces "remove Redis":**
> *Redis holds nothing whose loss would be a correctness or safety failure.* Flush it at
> any moment and the system must degrade in latency and rate-limit accuracy only — never
> log a user out, never lose a refresh-token family, never forget that a code was already
> redeemed.
>
> | Concern | Home | Why |
> |---|---|---|
> | Users, identities, clients, consent grants | **Mongo** | Durable system of record |
> | Sessions / refresh-token families | **Mongo** | Reuse detection needs durable history; "list my sessions" and "revoke all" need real queries — today they run `KEYS`, which is O(keyspace) and a documented production hazard |
> | Authorization codes | **Mongo** | Single-use CAS with a pre-image is the replay signal that triggers family revocation |
> | Social-login `state` | **Mongo** | Cheap, low volume, and losing it mid-flow fails a login |
> | Rate-limit + login-throttle counters | **Redis** | Must be shared across replicas; worthless after the window; high churn |
> | Session-validation read cache | **Redis** | Optional, added only if profiling shows the Mongo lookup on every authenticated request actually hurts |
> | `lastSeenAt` write coalescing | **Redis** | Touching a session row on every request is oplog spam for a cosmetic field |
>
> **What this buys us that full removal would not:** a shared rate-limit store (the
> in-process one is a live weakness), no per-request session write amplification into the
> oplog now that we run a replica set, and a place to absorb read-heavy hot paths later
> without re-architecting.
>
> **Two landmines, because the instance already exists and is shared:**
> 1. **`maxmemory-policy` must not be an `allkeys-*` LRU** if anything session-shaped ever
>    lands there. Under memory pressure Redis would silently evict live credentials — a
>    random-logout bug that is near-impossible to reproduce. Our compose pins
>    `noeviction`. Verify the production instance does the same, or use a dedicated one.
> 2. **A shared instance means a shared keyspace.** Another app's `FLUSHDB`, or a key
>    collision, becomes our outage. Namespace every key (`id:rl:…`) and use a dedicated
>    logical DB at minimum; a separate instance is better. Persistence should be
>    `appendonly yes` so a restart does not gift every attacker a fresh rate-limit budget.
>
> **Net effect on M1:** unchanged in substance. Authoritative state still moves to Mongo
> TTL collections — that was always about durability, queryability, and reuse detection,
> not about evicting Redis. What changes: `ioredis` stays in `package.json`, `redis.ts`
> survives as a cache client rather than a store, and the rate-limit store swap moves
> from "replace with Mongo" to "point at Redis," which is both less work and more correct.

All six Redis keyspaces become TTL-indexed Mongo collections:

| Redis key | TTL | Becomes |
|---|---|---|
| `session:{userId}:{sid}` | 7d | `sessions` collection |
| `access_token:{hash}` | 15m | `oauthAccessTokens`, TTL on `expiresAt` |
| `user_client_tokens:{u}:{c}` | 15m | eliminated — an index `{userId, clientId}` on the above |
| `auth_req:{txn}:{userId}` | 15m | `oauthAuthRequests`, TTL |
| `auth_code:{hash}` | 5m | `oauthAuthCodes`, TTL + single-use CAS |
| `oauth_state:{state}` | short | `oauthStates`, TTL + single-use CAS |

**Wins:** one datastore, one backup story, atomic compare-and-swap primitives we do not have in Redis without Lua, queryable/auditable state, and the `SCAN`-based session listing (O(keyspace)) becomes a single indexed `find`.

**The cost, stated honestly:** session validation moves from an in-memory Redis `GET` (~0.1–0.3 ms) to a Mongo lookup on every authenticated request. **Mitigation that makes it net-zero:** denormalise `role` and `disabled` onto the session document and drop the separate `User.findById` from the middleware. We currently pay *two* round-trips per request (Redis + Mongo); after this we pay *one*. This is safe precisely because every mutation that invalidates the snapshot already revokes sessions — and it forces us to make role changes revoke sessions too, which fixes a latent hole.

Two non-negotiable rules that come with TTL indexes:
- **TTL is storage reclamation, not authorization.** The monitor runs on a ~60 s cycle and does not run on secondaries at all, so expired documents stay readable. Every query against an expiring collection keeps an explicit `expiresAt: { $gt: new Date() }` predicate. This goes in a comment in every model file.
- **Changing `expireAfterSeconds` later needs `collMod`.** Mongoose silently keeps the old index. Any config-driven retention gets a boot-time reconciliation step.

Also: `lastSeenAt` becomes a single conditional write (`updateOne` with a `lastSeenAt: { $lt: cutoff }` filter) rather than our current read-compare-write. No read, no race, and a non-matching filter emits **no oplog entry** — steady state drops to one write per minute per session.

### D2 — Replica set: ~~not required~~ → **adopted** (one member)

> **Signed off:** one-member replica set. The analysis below still governs *how we write
> code* — the CAS operations remain single-document and must not be rewritten as
> transactions just because transactions are now available. The replica set exists to
> make the `user` + `identity` register pair honest and to leave change streams open to
> us later. `withTransaction` is the exception, not the default.

Every multi-write in the port is either reducible to one atomic document operation or safe under fail-forward ordering where the authoritative gate is written first. The two places that *look* like they need a transaction don't:

- **Authorization-code redemption** → `findOneAndUpdate({ tokenHash, consumedAt: null, expiresAt: {$gt: now} }, { $set: { consumedAt: now } }, { returnDocument: 'before' })`. Use `findOneAndUpdate` with the pre-image, **not** `findOneAndDelete` — the pre-image is what lets us distinguish a replay from an unknown code, which is the signal that triggers family revocation.
- **Refresh-token rotation** → the same compare-and-set on `status: 'active' → 'rotated'`.

The one thing I'd genuinely like a replica set for is the register `user` + `identity` pair. Alternative that needs no replica set: insert `Identity` first (its unique partial index is the real guard), then `User`, and compensate by deleting the orphan identity in a `catch`. **Decision needed: single-node Mongo with compensating writes, or a single-node replica set (`--replSet rs0`, one member) to unlock `withTransaction`?** A one-member replica set is cheap and also gives us change streams later; the cost is that every dev machine and the compose file need the flag.

### D3 — `/api/v1` versioning: adopt, and shim

Our rule 15 says `/api/{version}/{resource}`; we currently violate it on every route. Porting new modules under `/api/v1` while leaving the old ones unversioned would be the worst of both. Proposal: mount everything under `/api/v1`, keep the unversioned paths as aliases for one release so the frontend keeps working, then delete them in M7. The version string comes from config, not a literal.

Note this also means splitting the reference's `/api/v1/identity/users/me` into `/api/v1/auth/*` (credential flows) and `/api/v1/users/me` (profile) — a two-level resource path under one router violates the rule.

### D4 — `bcryptjs` → `argon2id`: yes, and it fixes a house-rule violation

`bcryptjs` is the pure-JS build: several times slower than native for the same cost *and* fully blocking the event loop, which violates rule 5. Argon2id at 64 MiB / t=3 / p=4 is OWASP-current and its native binding releases the libuv thread pool. Two consequences: the Docker image needs a build toolchain (or use `@node-rs/argon2`, prebuilt), and `UV_THREADPOOL_SIZE` becomes a deliberate config value. Add `needsRehash`-on-login so raising the cost later actually upgrades stored hashes — the reference has no upgrade path.

Existing bcrypt hashes: keep `bcryptjs` as a verify-only fallback and rehash to Argon2 on next successful login. No forced reset.

### D5 — `audit` vs our existing `events`: merge, don't duplicate

The reference's `audit_logs` and our `AuthEvent` overlap ~80%. Three options: keep both (two activity stores — no), rename ours, or **extend ours** with `status`, `entityType`, `entityId`, `actorRole`, and `clientId`, and widen the `EVENT_TYPES` enum. Option three keeps one append-only store, reuses the TTL index and the genuinely fire-and-forget writer we already have, and our closed enum is *stricter* than their free-text `action` column. One additive migration, no data movement.

### D6 — The RP SDK: separate versioned package, rewritten not copied

The SDK is the highest-leverage thing in the reference *and* the least finished — nothing in that monorepo imports it, it has never been exercised end to end, and it ships the cross-user token leak in §2.3-21.

Its consumers are our *other repositories*, so a workspace package delivers zero value to them; only an installable artifact does. Recommendation: `sdk/` as its own package with its own NodeNext tsconfig emitting `dist/`, published as `@id/client` (GitHub Packages, or a `git+https://…#semver:^0.1.0` dependency needing no registry). This keeps `jose` out of the backend's tree (we use `node-jose`) and avoids introducing a build step into a backend that currently has none.

Keep its module decomposition — `discovery / pkce / jwks / oauth2 / token / verify / http / shared` is genuinely good and already matches our `index.<dirname>.ts` convention. Rewrite the implementation with: a stateless client (credentials passed per call, never an instance field), a `handleCallback()` that validates `state` + exchanges + verifies in one call, auto-generated and *required* `nonce`, `iss`+`aud`+`typ` pinning on access tokens, discovery hardening (TTL, `AbortSignal.timeout`, zod-parse, `issuer` self-consistency check, same-origin endpoint check, https enforcement), explicit jose JWKS options so the refetch cooldown is intentional rather than inherited, single-flight refresh, and a configurable `clockTolerance` (their zero-tolerance verification will produce flaky auth in production).

**This is the last milestone, not the first.** The provider must be correct before we hand anyone a client for it.

### D7 — Shared contracts: two folders, synced file, no monorepo (yet)

The reference's `packages/shared` is ~100 lines of which ~60 are useful, and the frontend — the entire justification for it — imports nothing from it. Converting us to a turborepo to avoid drift on 60 stable lines means introducing a build step, `transpilePackages`, a rewritten Dockerfile, and a reconciled lockfile. Not worth it today.

Instead: `backend/src/types/contracts/` as the source of truth, derived with `z.infer` from the zod DTOs we already have, copied to `frontend/src/types/api.ts` behind a `pnpm sync:contracts` script, with both `typecheck`s in CI. Revisit the monorepo the day a third app appears. Also strip `accessToken`/`refreshToken`/`sessionId` off the `User` type — an entity type carrying credentials is how tokens end up in JSON responses by accident.

---

## 4. Target data model

New and changed collections. All field names camelCase in Mongo; snake_case only at the JSON API boundary, via one explicit serialiser per resource (which is also what stops `passwordHash` leaking into a response).

### 4.1 Identity

**`users`** — extend existing. Add `givenName`/`familyName` alongside `name`, `suspendedAt`, `deletedAt`. Index `{ deletedAt: 1, suspendedAt: 1 }` partial on `{ deletedAt: null }`. `role` from a `USER_ROLES` constant (rule 8), sessions revoked on any role change.

**`identities`** — extend existing. `email` gets `lowercase: true`, which fixes reference bug §2.3-6 for free. Add:
- `{ provider: 1, email: 1 }` **unique partial** on `{ revokedAt: null }` — makes registration race-proof, fixing §2.3-7
- `{ provider: 1, providerSubject: 1 }` **unique partial** on `{ providerSubject: { $type: 'string' } }` — a plain unique index would collide on nulls
- `passwordHash` gets `select: false`

**`authActionTokens`** — new. `{ userId, identityId, type (enum EMAIL_VERIFICATION | PASSWORD_RESET), tokenHash (unique), expiresAt, consumedAt, metadata }`. Token = `randomBytes(32).toString('hex')`, stored SHA-256-hashed. TTL on `expiresAt`, `expireAfterSeconds: 0`. Compound `{ userId, type, consumedAt }` so "revoke all outstanding tokens of this type on re-issue" is one cheap `updateMany` — fixing §2.3-9. Redemption is a single atomic `findOneAndUpdate` claim, fixing §2.3-8.

**`loginThrottles`** — new, and **redesigned**, because the reference's version bricks accounts. `{ emailNormalized (unique), failedAttempts, lockedUntil, lastFailedAt, lastSuccessAt, windowExpiresAt }`. TTL on `windowExpiresAt` — this is what turns their never-decaying counter into a real sliding window *and* bounds the unbounded row growth from attacks on nonexistent emails. The lock is evaluated from `lockedUntil` only, never from a raw counter. Increment is a single aggregation-pipeline `findOneAndUpdate` so the increment and the threshold decision happen atomically server-side, fixing §2.3-10.

### 4.2 Sessions

**`sessions`** — replaces the Redis keyspace. `_id` *is* the `sid`. `{ userId, currentRefreshTokenId, deviceName, userAgent (max 400), ipAddress (max 45), lastSeenAt, revokedAt, revokedReason (enum), expiresAt, role, disabled }` — the last two denormalised per D1. Indexes: `{ userId: 1, revokedAt: 1, expiresAt: -1 }` and TTL on `expiresAt`.

**`refreshTokens`** — new, the crown jewel. `{ sessionId, userId, familyId, tokenHash (unique), tokenJti (unique), parentTokenId, replacedByTokenId, status (enum active|rotated|revoked), rotatedAt, revokedAt, revokedReason, expiresAt }`.

Two deliberate improvements on the reference: `userId` is denormalised (revoke/audit by user with no join, and their per-session `UPDATE` loop becomes one `updateMany`), and **`familyId` is a real field**. Their design requires walking `parentRefreshTokenId` recursively to find a family — which is precisely why they never implemented family revocation. With `familyId` it's one indexed `updateMany`.

Indexes: unique on `tokenHash` and `tokenJti`; `{ familyId, status }`, `{ sessionId, status }`, `{ userId, status }`; TTL on `expiresAt`. Explicitly **not** a partial unique index on `{sessionId, status:'active'}` — tempting as a one-live-leaf invariant, but it turns the benign double-refresh race into a hard `E11000` instead of the graceful path below.

**Rotation with reuse detection** — the algorithm, since this is the part worth getting exactly right:

1. Atomically claim: `findOneAndUpdate({ tokenHash, status: 'active', expiresAt: { $gt: now } }, { $set: { status: 'rotated', rotatedAt: now } }, { returnDocument: 'before' })`. Exactly one concurrent request can win; all others get `null`.
2. If `null`, disambiguate four cases: unknown token → 401; `status: 'rotated'` **within a ~10 s grace window** → a distinct retriable `REFRESH_IN_FLIGHT` error; `status: 'rotated'` **outside it** → **reuse detected**; `status: 'revoked'` → 401; active-but-expired → revoke and 401.
   - **The grace window is not optional.** Multi-tab SPAs and mobile clients routinely fire two refreshes milliseconds apart. Without it, every such client trips reuse detection and gets logged out of everything — a self-inflicted DoS. We can't hand the loser the winner's token (we only store hashes), so the client contract is "retry after backoff".
3. Validate session and user, still with an explicit `expiresAt: { $gt: now }`. Note the token is already `rotated` at this point, so a failure here burns it — deliberate: a token presented against a dead session must not remain replayable.
4. Insert the child inheriting `familyId` and `expiresAt` (absolute window preserved), then two independent updates for `replacedByTokenId` and the session pointer. A crash between them leaves a child the client never received, which simply expires. No transaction needed.
5. On reuse: revoke the **session first** (it's what everything gates on), then `updateMany({ familyId, status: { $ne: 'revoked' } })`, then an audit event. Blast radius is **family + its session, not all the user's sessions** — killing everything punishes a user whose other devices are fine and makes any false positive catastrophic. Make the stricter posture a config flag, not a hardcode.

### 4.3 OAuth

**`oauthAuthCodes`**, **`oauthAuthRequests`**, **`oauthStates`**, **`oauthAccessTokens`** — the four Redis keyspaces, all TTL-indexed, all single-use where applicable via the same CAS claim.

**`oauthClients`** — extend existing with the protocol metadata it structurally lacks: `scopes[]`, `grantTypes[]`, `responseTypes[]`, `tokenEndpointAuthMethod` (unlocks public clients / SPAs / native apps, which we currently lock out despite mandatory PKCE), `applicationType`, `clientType`, `postLogoutRedirectUris[]`.

`redirectUris` and `allowedOrigins` stay **embedded `[String]` arrays**, not separate collections. That single decision removes both SQL transactions and both `ON DELETE CASCADE` constraints from the clients port — after it, nothing in the OAuth scope needs a replica-set transaction. Validation stays exact-match, no wildcards.

**`oauthSigningKeys`** — new, and designed properly rather than ported:
- `kid` **derived from the JWK thumbprint (RFC 7638)**, never a literal
- private key **AES-256-GCM encrypted at rest**, KEK from frozen config
- `status` state machine: `ACTIVE` (signs) / `NEXT` (published, not yet signing) / `RETIRED` (published until `notAfter`)
- a `notAfter` **overlap window** so previously-issued tokens keep verifying through a rotation
- `kid` in the header of **both** ID tokens and access tokens — the reference omits it on access tokens, which means adding a second key breaks every verification
- JWKS publishes ACTIVE + NEXT + un-expired RETIRED, and the endpoint is **read-only** (the reference triggers a write-path key-sync on every unauthenticated JWKS request)

**Access tokens get `iss`, `aud`, `kid`, and `typ: "at+jwt"`** — fixing §2.3-1, the reference's worst bug. First-party session tokens and OAuth access tokens must not be interchangeable.

### 4.4 Audit

Extend `AuthEvent` per D5. Add the indexes the reference lacks entirely: `{ createdAt: -1 }`, `{ actorUserId, createdAt: -1 }`, `{ targetUserId, createdAt: -1 }`, `{ action, createdAt: -1 }`, `{ status, createdAt: -1 }`, plus the existing TTL. Keyset pagination on `{createdAt, _id}`, not `OFFSET`.

---

## 5. Milestones

Each milestone ends green: typecheck + lint + tests pass, and nothing regresses §2.2.

**M0 — Foundation.** Frozen zod config (`common/config/config.ts`) with fail-fast boot validation; delete all 30+ direct `process.env` reads; `constants.ts` + `messages.ts` (error codes, success messages, Redis-key-prefix replacements, TTLs, revoke reasons, roles, scopes, cookie names); structured logger with levels, request IDs, and PII redaction — and an `Error` serialiser, since the reference's logs `{}` for every error; error handler mapping `CastError`, `E11000`, `ZodError`, and JWT expiry with a `headersSent` guard; graceful shutdown (SIGTERM/SIGINT, `server.close`, `mongoose.disconnect`, keepalive timeouts); real `/health` + `/ready`; `unhandledRejection`/`uncaughtException` handlers; CORS pinned to an allowlist that **fails closed** (kill the `|| true`); `ioredis` removed from `package.json`; rate-limit store swapped off the in-memory default.

**M1 — Persistence.** All six Redis keyspaces → TTL collections; `syncIndexes()` script + boot-time index reconciliation; `autoIndex: false` in production; `migrate-mongo` only if a data backfill actually needs it; seed scripts updated.

**M2 — Identity.** Argon2id with bcrypt fallback + rehash-on-login; email verification (issue/verify/resend) with atomic single-use redemption and prior-token revocation; forgot/reset password; windowed login throttle with atomic increment; account-state checks on every redemption path; unified enumeration-resistant responses + dummy-hash timing defence; email service (Resend) + templates, dispatched through a background path so a Resend outage can't lose the only verification token a user will get; `ua-parser-js` device names; soft delete that revokes identities and frees the email.

**M3 — Sessions.** Persistent refresh tokens; CAS rotation with family reuse detection and the grace window; session list/revoke/revoke-all; `role`+`disabled` denormalised onto the session and the second round-trip dropped; conditional-write `lastSeenAt`; refresh tokens revoked on password reset, deletion, suspension, and role change.

**M4 — OIDC hardening.** Signing-key rotation with thumbprint `kid`, encrypted private keys, and an overlap window; `iss`/`aud`/`typ`/`kid` on access tokens; **consent scope comparison** (fixes the escalation bug in both codebases); atomic code redemption; per-client scope allowlist + grant/response-type/auth-method enforcement; public clients; `prompt` (none/login/consent), `max_age` + `auth_time`; RFC 7009 revocation; RFC 7662 introspection; `end_session_endpoint`; redirect-based authorize errors; `Cache-Control: no-store` on token responses; a discovery document that stops lying (`grant_types_supported` in particular — its absence currently advertises implicit).

**M5 — Audit + admin.** Merge audit semantics into the events store; instrument the ~10 uninstrumented chokepoints (refresh success/failure, **reuse detection**, session creation, every OAuth and client endpoint); admin self-protection, admin-protects-admin, and last-admin guards; DTO validation on every path param; keyset pagination.

**M6 — Ops.** `/api/v1` everywhere with aliases; Postman collections (real endpoints only, filters as `?filters` on the canonical path, no token logging) run under `newman` in CI; CI with **Mongo as a service container** so the integration tests actually run instead of self-skipping green; multi-stage Dockerfile, non-root, frozen lockfile, `.dockerignore`, `HEALTHCHECK`; a real build step (`tsup`) replacing `tsx` in production.

**M7 — Frontend (our UI).** Wire the new flows into our brutalist design system: verify-email, forgot/reset password, change password, session list with device names, **a real account deletion** replacing the mock that currently lies to users; `error.tsx`/`not-found.tsx`/`loading.tsx`; OAuth error code → human copy; consent screen renders `logo_url` and `client_suspended`; clear `AuthContext.user` on failed refresh; drop the unversioned route aliases.

**M8 — RP SDK.** Per D6.

**Dependency order:** M0 → M1 → (M2 ∥ M3) → M4 → M5 → M6 → M7 → M8. M2 and M3 can run in parallel once M1 lands.

---

## 6. Conventions the port must follow

Ours, plus what the reference does better. Adopt from `docs/06-coding-standards.md` and `.gemini/AGENTS.md`:

- Import order enforced by lint: builtins → external → aliases → relative.
- **Controllers may never import a model.** Enforce with an ESLint `no-restricted-imports` rule — turns a prose rule into CI.
- No default exports. Our `app.ts` currently imports five default-exported route modules; convert them.
- **No `any`; narrow with a guard, not a non-null assertion.** The reference has 8 `req.user!.id` sites; we won't add more.
- Source-of-truth precedence: Database Design → Business Rules → API Contracts → Coding Standards. And: **do not invent database fields, do not invent endpoints.** Their entire drift catalogue — 4 dead Postman URLs, 3 indexes out of 30, a deleted `email_normalized`, an undocumented table — is what ignoring those two rules produces.
- One `ApiResponse.paginated` path for every list endpoint.
- The audited-action catalogue lives in constants, so "what gets audited" is a reviewable list rather than a scattering of call sites.

Their `.gemini/AGENTS.md:47` says *"no transaction, instead use try-catch… sends immediate response and it will process in background"* — which directly contradicts their own coding standard mandating `db.transaction`. The instinct (don't block the response on non-critical work) is right, the conclusion is wrong. The synthesis, which also satisfies our rule 5: **atomic write for the critical set, background queue for everything after the response.** Register = atomic create → respond 201 → enqueue verification email and audit write.

Mechanical conversions across the port: ~19 `class X { static }` → wrapped object literals (`ApiError` stays a class — `instanceof` is load-bearing), ~40 hardcoded literals → constants, consistent `index.<dirname>.ts` aggregators, and try-catch inside `asyncHandler` bodies (rule 12 wants both).

---

## 7. Decisions taken

1. **D2** — one-member replica set (`--replSet rs0`). Compose file initiates `rs0` via an idempotent healthcheck; `MONGO_URI` must carry `?replicaSet=rs0`.
2. **D3** — everything under `/api/v1`, unversioned aliases retained for one release, deleted in M7.
3. **Email provider** — Resend, same as the reference, so the templates port directly.
4. **Owner identity** — issuer domain `id.anands.dev`; `SEED_ADMIN_EMAIL=darkjargon739@gmail.com`. The stale `bilal@tabbio.com` default is gone from `.env.example`.
5. **M8 scope** — after the provider is conformant, as recommended.

---

## 8. Progress log

### M0 — Foundation ✅

**Configuration.** `common/config/env.ts` is now the only place `process.env` is read (tests
and seed scripts aside). A zod schema parses once, memoises, and reports *every* problem in
one throw rather than failing on the first. `common/config/config.ts` layers a deep-frozen,
lazily-built object over it, so no consumer can mutate shared config and no import has a
side effect at module-load time. `Config.validate()` runs before anything external is
touched in `index.ts`.

Production-only `superRefine` gates, each of which was a real hole:

| Gate | What it prevents |
|---|---|
| JWT secrets required, ≥32 chars, must differ | A shared access/refresh secret lets a refresh token be replayed as an access token |
| `CORS_ORIGINS` or `FRONTEND_URL` required | `origin: FRONTEND_URL \|\| true` with `credentials: true` reflected any caller's Origin — every site on the internet had cookie-authenticated access to the identity API |
| `OIDC_ISSUER` required | `iss` is baked into every token; a wrong default silently invalidates all of them |
| A signing key required | Otherwise each replica generates an ephemeral key, so tokens signed by one fail verification on another |
| `COOKIE_SECURE` must be true | The refresh cookie is a session credential |
| `MONGO_URI` must not be the dev default | Prevents pointing production at localhost |

Dev/test get named sentinels instead, so `pnpm test` boots with no `.env` while production
still hard-fails. `booleanish()` parses the literal string because `z.coerce.boolean()`
turns `"false"` into `true`.

**Constants.** `common/constants/` holds API prefixes, route segments, roles, scopes, grant
types, TTLs, cookie names, rate-limit windows, field limits, body limits, and header names.
`messages.constants.ts` pairs machine-readable `ERROR_CODES` with human messages so
responses can't drift.

**Logging.** `common/logger/` serialises `Error` properly (the reference logs `{}` for every
error — its single worst operational bug), redacts by key pattern (password, token, secret,
cookie, `code_verifier`, …), and correlates via `AsyncLocalStorage` seeded by
`requestContext` middleware from a validated `x-request-id` or a fresh UUID. Echoed back on
every response.

**Errors.** `ApiError` carries a `code` and optional field `details`. The handler normalises
`ZodError`, Mongoose `ValidationError`/`CastError`, `E11000` duplicates, and JWT
expiry/malformed into consistent shapes, guards `headersSent`, and logs 5xx at error with a
stack while 4xx log at warn with a one-line reason — a rejected request is an expected
outcome, not an incident.

**Lifecycle.** Graceful shutdown on SIGTERM/SIGINT/`unhandledRejection`/`uncaughtException`:
stop accepting connections, drain in flight, close Mongo and Redis, with a hard timeout so a
stuck socket can't hang the deploy. `keepAliveTimeout`/`headersTimeout`/`requestTimeout` set
so a slow client can't hold a socket open indefinitely. `/health` is pure liveness (no
downstream checks — a DB blip must not get a healthy pod killed); `/ready` checks Mongo and
returns 503 so a broken instance leaves the load-balancer rotation instead of serving 500s.

**Index reconciliation.** `IndexSync` runs `syncIndexes()` at boot and reconciles TTL
`expireAfterSeconds` via `collMod`, because Mongoose silently ignores a changed TTL on an
existing index — so `EVENT_RETENTION_DAYS` was previously a no-op after first deploy.

**Rate limiting.** Tiered from constants: a backstop on `/api`, tighter on auth, tightest on
`/oauth/token` (previously unthrottled — an offline PKCE/secret brute-force target). Mounted
once at `/api` so `/api/v1` requests aren't double-counted.

**Test integrity.** Seven integration suites self-skip without datastores, and a skip is
indistinguishable from a pass in the summary — a CI run whose service container never came
up would report green with 28 of 54 tests unexecuted. `IntegrationGate` turns that into a
hard failure when `REQUIRE_INTEGRATION=1`, which CI will set.

**Not done in M0, deliberately.** `ioredis` stays. Six live keyspaces (sessions,
authorization codes, pending authorization requests, OIDC access tokens, social-login state,
token index sets) span five modules; removing the dependency before the TTL collections
exist would mean shipping a broken auth path. It is `redis.ts` + `REDIS_URL` + the compose
service, all three tagged for deletion, and the M1 boundary is exactly that migration. The
rate-limit store is also still in-process memory — correct to fix once, in M1, alongside it.

**Verification:** `pnpm typecheck` clean; 54 tests, 26 pass, 0 fail, 28 skipped pending a
running Mongo (Docker daemon was down locally).

### M1 — Persistence ✅

All six Redis keyspaces are now TTL-indexed Mongo collections, and Redis is a
cache-and-counter tier holding exactly one thing: shared rate-limit counters. Flushing it
costs latency and rate-limit accuracy; it cannot log anyone out, lose a session, or forget
that a code was redeemed.

| Was | Now |
|---|---|
| `session:{userId}:{sid}` | `sessions`, `_id` = `sha256(sid)` |
| `access_token:{hash}` | `oauthAccessTokens`, unique `tokenHash` |
| `user_client_tokens:{u}:{c}` | **gone** — a `{ userId, clientId }` index on the above |
| `auth_req:{txn}:{userId}` | `oauthAuthRequests`, unique `transactionId`, CAS claim |
| `auth_code:{hash}` | `oauthAuthCodes`, unique `codeHash`, CAS claim with pre-image |
| `oauth_state:{state}` | `oauthStates`, unique `stateHash`, CAS claim |

**TTL is garbage collection, never a security boundary.** The monitor runs on a ~60 s
cycle, so every read path carries its own `expiresAt: { $gt: now }` predicate and each
model file says so at the top. Three regression tests set `expiresAt` in the past and
assert the read path refuses the document while it is demonstrably still present —
sessions, authorization codes, and social-login state.

**One store module per collection** owns every query against it (`session.store.ts`,
`oauth-state.store.ts`, `auth-request.store.ts`, `auth-code.store.ts`,
`access-token.store.ts`), which is what makes "every read filters on expiry" reviewable
rather than aspirational.

**Redemption keeps the pre-image.** `findOneAndUpdate(… consumedAt: null …, { returnDocument: 'before' })`
on one document, no transactions anywhere. The pre-image is the point: a replay of a
genuine code is answered with the same `invalid_grant` as an unknown code, but internally
it revokes the access token that redemption issued and records an `oauth.code.replayed`
event. `findOneAndDelete` would have collapsed both cases into "not found" and thrown the
attack signal away. Authorization codes are therefore retained past expiry
(`expireAfterSeconds` on `expiresAt`, not 0) so a late replay is still detectable.

Redemption is claimed *before* the binding and PKCE checks: presenting a code spends it
whatever the outcome, so a stolen code is good for one attempt and the legitimate client's
redemption then fails loudly instead of succeeding alongside the attacker's.

**The `SCAN` is gone.** `listSessions`/`revokeAll` were O(entire keyspace); they are now
one indexed `find`/`updateMany` on `{ userId, revokedAt, expiresAt }`. Revocation is a
soft `revokedAt` + `revokedReason` write rather than a delete, so "when and why was I
signed out" is answerable. `lastSeenAt` is a single conditional write — no read, no race,
and no oplog entry when the filter does not match.

**Only hashes at rest.** Session ids, authorization codes, access tokens and social-login
state are stored SHA-256-hashed. The session API publishes the *handle* (`sha256(sid)`)
rather than the sid, which stays inside the token it was minted into; clients treat it as
an opaque string either way, so the contract is unchanged. Consent transaction ids are
deliberately stored in the clear — not bearer credentials (redemption is scoped to the
owning user's session) and worth keeping greppable for support.

**Rate limiting moved to Redis** (`rate-limit-redis`, pinned to v4 for
`express-rate-limit` 7 compatibility), keyed under `id:rl:{tier}:` because the instance may
be shared. It **fails open**: a store failure logs loudly and lets the request through,
because a cache being down must not lock every user out of signing in. The cache client
refuses to queue commands while disconnected and races the rest against a deadline, so a
dead Redis costs no request latency rather than stalling every login.

**Verification:** `pnpm typecheck` clean; 63 tests, 63 pass, 0 fail, 0 skipped against a
live one-member replica set and Redis.

### M2 — Identity ✅

Passwords are Argon2id, the two mailbox-authenticated flows exist, failed logins are
throttled without being lockable, four endpoints stopped answering questions about which
accounts exist, and closing an account now does something.

**Argon2id, via `@node-rs/argon2`.** Chosen over `argon2` because it ships prebuilt
binaries, so the production image needs no node-gyp toolchain — and over `bcryptjs`
because that is the pure-JS build: slower than native for equivalent work *and* fully
synchronous, so every login blocked the event loop for the whole KDF (rule 5). Parameters
are OWASP-current (64 MiB, t=3, p=4) and are **configuration**, bounded on both sides:
a mistyped `ARGON2_MEMORY_KIB=64` would still hash and verify every password at roughly a
thousandth of the intended cost. Measured 34 ms per hash at the defaults.

`bcryptjs` remains as a **verify-only** fallback. `needsRehash` compares a stored digest
against the configured cost and the login path rewrites it in place, so the legacy estate
upgrades organically and raising the cost later actually upgrades stored hashes rather than
applying only to accounts created after the deploy. No forced reset, no batch job, no
`algorithm` column — an Argon2 PHC string carries its own parameters, so the digest is
self-describing and cannot disagree with a field claiming to describe it.

`UV_THREADPOOL_SIZE` is now a deliberate config value, because the binding dispatches onto
libuv's pool, which defaults to **four** threads and is shared with `dns.lookup`, `fs`,
`zlib`, and `crypto.pbkdf2`. Measured: with the default pool a `readFile` that takes 0 ms
idle takes **182 ms** while eight hashes are in flight; at 16 threads it returns in 0 ms.
Mongo and Redis reconnects need `dns.lookup`, so an undersized pool lets a login burst
delay the reconnect that would end an outage. libuv fixes the size before any application
code runs, so `PasswordService.warmup()` reports it at boot rather than setting it.

**The user model is pure schema** (rule 6). Its `pre('save')` hashing hook is gone: a hook
makes "is this field plaintext or a digest?" depend on which write path you arrived
through, which is precisely the ambiguity that would double-hash a rehash-on-login write.

| New collection | Indexes |
|---|---|
| `authActionTokens` | unique `tokenHash`; `{ userId, type, consumedAt, revokedAt }` for revoke-on-reissue; TTL on `expiresAt` |
| `loginThrottles` | `_id` = `sha256(email)`; TTL on `windowExpiresAt` |

Both are registered in `indexSync.ts`, and each has exactly one store module owning every
query against it, so "every read filters on expiry" stays reviewable.

**Action tokens.** Hashed at rest, discriminated by `type` *inside the claim filter* so a
verification link cannot be spent as a password reset, and claimed by a single-document
`findOneAndUpdate` returning the pre-image — no transactions. `consumedAt` and `revokedAt`
are separate fields, because "you already used this link" and "you clicked an older link"
are different answers to a support question. Re-issue revokes every prior outstanding token
of that type. `ActionTokenRedemption` holds the guard sequence once — atomic claim, live
account, usable account, address still bound — because two copies of it is exactly how
§2.3-11 happens.

A completed reset revokes every session and every OIDC access token. Refresh tokens are
covered transitively: today's is a bare JWT gated on its session existing, so killing the
session kills it — M3 gives them their own fan-out in `revokeAllCredentials`.

**The login throttle is in Mongo, deliberately, and it is the one counter that is.** The
general limiters live in Redis and fail open, because a cache blip must not become an auth
outage; failing open *here* would mean unlimited password guessing for the duration of that
blip, and this counter writes only on failed logins, so durability costs nothing. It is a
window, never a lockout: the lock is read from `lockedUntil` alone and the document
self-expires, so the state decays to "no record" with nothing having to run. One
aggregation-pipeline `findOneAndUpdate` performs the increment, the window decision, and
the threshold decision server-side, so a parallel burst counts as a burst. Locking extends
the window past `lockedUntil`, or the reaper would delete the document mid-lock and hand
the attacker their attempts straight back.

**Enumeration.** Register, forgot-password, and resend-verification are byte-identical
across branches; register returns no user object, because a varying shape is the same
oracle in a different coat; and losing the concurrent insert race folds into the
"already exists" branch rather than surfacing `E11000` as a 409, since an oracle that needs
a race is still an oracle. Login runs a dummy Argon2id verification at the configured cost
when the address does not exist, and increments the throttle for unknown addresses too so
the counter cannot separate the cases either. Verified by measurement, not assertion:
medians over repeated samples, compared as a ratio.

**Email.** Real Resend delivery, as one timed `fetch` rather than the SDK — the surface we
need is a single authenticated POST, and owning the timeout matters more here than
ergonomics. The token is persisted **before** delivery is attempted and delivery is never
awaited, so a provider outage cannot lose the only verification link a user will get;
resend is the recovery path, and no queue or worker was built. No body, token, or link ever
reaches a log sink — the logger redacts by key pattern, which is no defence against a token
interpolated into a message string, so the discipline lives where bodies exist. Unconfigured
locally, messages go to a bounded in-memory outbox behind `GET /api/v1/auth/dev/outbox`,
which 404s the moment a provider is configured and always in production. Links carry the
token in the URL **fragment**, never the query string.

**Account closure.** `deletedAt` is stamped, the digest dropped, sessions and access tokens
revoked, outstanding action tokens revoked, consents dropped, identities deleted — and the
address moved to `deletedEmail` with `email` replaced by a reserved `.invalid` tombstone.
That frees the live unique index without rebuilding it; making the index partial on
`{ deletedAt: null }` is prettier data but means dropping and recreating a unique index on
a live collection and leaning on `partialFilterExpression`'s null semantics. Identities are
deleted rather than flagged for the same reason — a soft flag leaves the unique
`{ provider, providerAccountId }` key occupied, so the same Google account could never be
linked again.

**Deliberately not done.** Login is *not* gated on `email_verified`: every existing account
has `isVerified: false`, so gating it would lock the current user base out, and it is a
product decision rather than a security one. A successful reset does not set `isVerified`
either, though the argument for it is decent. `ua-parser-js` device names slipped to M3,
where the session surface is already being reworked. `identities` keeps
`providerAccountId` and gains no `passwordHash`; moving credentials onto identity rows is a
data migration, not an M2 change.

**Found, out of scope.** `oauth-client.service.ts` still hashes and verifies client secrets
with blocking `bcryptjs` on the token endpoint's hot path — and a 32-byte random secret
needs a fast digest, not a password KDF, so the cost is pure waste (M4). The admin user
list does not filter `deletedAt`, so a closed account appears as its tombstone (M5).
`event.service.ts` reports its own write failures through `console.warn`, bypassing the
logger (rule 9), and records the submitted email in `login.fail` metadata.

**Verification:** `pnpm typecheck` clean; 99 tests, 99 pass, 0 fail, 0 skipped against a
live one-member replica set and Redis (63 before M2).
