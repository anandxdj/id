import { randomBase64Url } from '../../common/utils/crypto.utils';
import { getOidcIssuer } from '../../common/utils/keys.utils';
import {
  CRYPTO,
  OIDC_SCOPES,
  SIGNING_KEY,
  TOKEN_TYP,
  TTL_SECONDS,
} from '../../common/constants/index.constants';
import { SigningKeyService } from './signing-key.service';
import { AccessTokenStore } from './access-token.store';
import { ScopeUtil } from './scope.util';
import type { IOAuthAccessToken } from './oauth-access-token.model';

/**
 * Minting and validation of the two signed artefacts this server issues.
 *
 * The single most important thing in this file is that an OIDC access token and an
 * ID token are **not interchangeable**, and neither is interchangeable with a
 * first-party session token. That is the reference's worst bug (plan §2.3-1): its OAuth
 * access tokens are signed with the same key as its own session tokens and carry no
 * `aud` or `iss`, so any relying party can drive the admin API with a user's OAuth
 * token. Three independent discriminators are applied on every verification:
 *
 * | | OIDC access token | ID token | First-party session token |
 * |---|---|---|---|
 * | `typ` | `at+jwt` | `JWT` | *(none)* |
 * | `alg` | RS256, JWKS | RS256, JWKS | HS256, server-only secret |
 * | `aud` | the issuer (resource server) | the client | *(none)* |
 *
 * A session token fails at `alg` before anything else is read; an ID token presented
 * as an access token fails at `typ` and again at `aud`.
 *
 * Access tokens stay **revocable**: the JWT is a carrier for the claims, but a
 * server-side record is still consulted on every use, so revocation is immediate
 * rather than "whenever it expires". The reference issues JWT access tokens it cannot
 * revoke at all; we keep both properties.
 */

export interface IssueAccessTokenInput {
  userId: string;
  clientId: string;
  /** The granted scope — never the requested one. See `ScopeUtil` and consent. */
  scope: string;
  /** Ties every token from one authorization code together, for RFC 7009 cascade. */
  grantId: string;
  /** When the end user actually authenticated, for `auth_time`. */
  authTime: Date;
}

export interface IssuedAccessToken {
  token: string;
  tokenHash: string;
  jti: string;
  expiresIn: number;
}

export interface VerifiedAccessToken {
  claims: Record<string, unknown>;
  record: IOAuthAccessToken;
}

export interface IssueIdTokenInput {
  userId: string;
  clientId: string;
  scope: string;
  authTime: Date;
  nonce?: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
}

const _epoch = (date: Date): number => Math.floor(date.getTime() / 1000);

export const OidcTokenService = {
  /**
   * Mint an RFC 9068 access token and its revocation record.
   *
   * `aud` is the *issuer*, not the client: an access token is presented to a resource
   * server, and ours is this deployment's `/oauth/userinfo`. Audiencing it at the
   * client would make it indistinguishable from an ID token, which is precisely the
   * confusion RFC 9068 §4 exists to prevent.
   */
  async issueAccessToken(input: IssueAccessTokenInput): Promise<IssuedAccessToken> {
    const issuer = getOidcIssuer();
    const jti = randomBase64Url(CRYPTO.TOKEN_BYTES.JTI);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + TTL_SECONDS.ACCESS_TOKEN * 1_000);

    const token = SigningKeyService.sign(
      {
        iss: issuer,
        aud: issuer,
        sub: input.userId,
        client_id: input.clientId,
        scope: input.scope,
        jti,
        iat: _epoch(issuedAt),
        exp: _epoch(expiresAt),
        auth_time: _epoch(input.authTime),
      },
      { typ: TOKEN_TYP.OIDC_ACCESS },
    );

    // Calls out to the access-token store — `{ userId, clientId }` and `grantId` are
    // indexed there, which is what makes both "revoke this app" and the RFC 7009
    // cascade single indexed updates.
    const { tokenHash } = await AccessTokenStore.create({
      token,
      jti,
      userId: input.userId,
      clientId: input.clientId,
      scope: input.scope,
      grantId: input.grantId,
      authTime: input.authTime,
      expiresAt,
    });

    return { token, tokenHash, jti, expiresIn: TTL_SECONDS.ACCESS_TOKEN };
  },

  /**
   * Resolve a bearer credential into its claims and its live record, or `null`.
   *
   * Both halves are load-bearing. The signature proves the token is ours and was not
   * edited; the record is what makes it revocable and is the authority on scope — a
   * client that somehow acquired a signing oracle still could not widen its own scope,
   * because issuance wrote the granted set to the database and that is what is read
   * back here.
   */
  async verifyAccessToken(raw: string): Promise<VerifiedAccessToken | null> {
    const verified = await SigningKeyService.verify(raw, { typ: TOKEN_TYP.OIDC_ACCESS });
    if (!verified) return null;

    const issuer = getOidcIssuer();
    const { claims } = verified;
    if (claims.iss !== issuer) return null;
    if (claims.aud !== issuer) return null;

    const now = Math.floor(Date.now() / 1000);
    const exp = typeof claims.exp === 'number' ? claims.exp : 0;
    if (exp + SIGNING_KEY.CLOCK_SKEW_SECONDS <= now) return null;

    // The explicit `revokedAt`/`expiresAt` predicates live in the store: the TTL index
    // reaps on a ~60 s cycle and can never be what enforces expiry.
    const record = await AccessTokenStore.findLive(raw);
    if (!record) return null;
    if (typeof claims.jti === 'string' && record.jti && record.jti !== claims.jti) return null;

    return { claims, record };
  },

  /**
   * Mint an ID token. `aud` is the client, `typ` is a plain `JWT`, and the claim set is
   * gated on the **granted** scope rather than whatever the client asked for.
   */
  issueIdToken(input: IssueIdTokenInput): string {
    const issuer = getOidcIssuer();
    const now = new Date();
    const claims: Record<string, unknown> = {
      iss: issuer,
      sub: input.userId,
      aud: input.clientId,
      iat: _epoch(now),
      exp: _epoch(new Date(now.getTime() + TTL_SECONDS.ACCESS_TOKEN * 1_000)),
      /**
       * OIDC Core §2: when the request carried `max_age`, `auth_time` is REQUIRED and
       * must be the moment the end user authenticated — not the moment the token was
       * minted. It is always emitted here so a relying party can enforce its own
       * freshness policy without having asked for it up front.
       */
      auth_time: _epoch(input.authTime),
    };

    if (input.nonce) claims.nonce = input.nonce;
    if (ScopeUtil.has(input.scope, OIDC_SCOPES.EMAIL)) {
      if (input.email) claims.email = input.email;
      claims.email_verified = input.emailVerified === true;
    }
    if (ScopeUtil.has(input.scope, OIDC_SCOPES.PROFILE) && input.name) {
      claims.name = input.name;
    }

    return SigningKeyService.sign(claims, { typ: TOKEN_TYP.ID_TOKEN });
  },
};
