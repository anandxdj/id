import type { Request, Response } from 'express';
import {
  COOKIE_NAMES,
  NO_STORE_HEADERS,
  OAUTH_ERRORS,
  REVOKE_REASONS,
  TOKEN_TYP,
} from '../../common/constants/index.constants';
import { Logger } from '../../common/logger/index.logger';
import * as clientService from '../oauth-client/oauth-client.service';
import * as events from '../events/event.service';
import { revokeSession } from '../auth/auth.service';
import { AccessTokenStore } from './access-token.store';
import { ClientPolicy } from './client-policy.service';
import { SigningKeyService } from './signing-key.service';

/**
 * OpenID Connect RP-Initiated Logout 1.0 — the `end_session_endpoint`.
 *
 * The dangerous parameter here is `post_logout_redirect_uri`. It is attacker-supplied,
 * it is followed by a browser, and the request that carries it is by definition
 * arriving in a half-authenticated state — which is the exact shape of an open
 * redirector. §2 requires it to be validated against values registered for the client,
 * and this implementation will render an error rather than redirect anywhere it cannot
 * verify. There is deliberately no "trust it if it matches a redirect_uri" shortcut:
 * login callbacks and logout landing pages are different registrations.
 *
 * The client is identified from `id_token_hint` (whose signature is checked against the
 * keyring) or from an explicit `client_id`. An `id_token_hint` is normally expired by
 * the time a user logs out, so expiry is not treated as a failure — the hint's job is
 * identification, not authorisation.
 */

interface EndSessionParams {
  idTokenHint?: string;
  clientId?: string;
  postLogoutRedirectUri?: string;
  state?: string;
}

const _param = (req: Request, name: string): string | undefined => {
  const fromQuery = req.query?.[name];
  const fromBody = (req.body as Record<string, unknown> | undefined)?.[name];
  const value = fromQuery ?? fromBody;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const _params = (req: Request): EndSessionParams => ({
  idTokenHint: _param(req, 'id_token_hint'),
  clientId: _param(req, 'client_id'),
  postLogoutRedirectUri: _param(req, 'post_logout_redirect_uri'),
  state: _param(req, 'state'),
});

/**
 * Internal: which client is asking. The `id_token_hint` is signature-checked so a
 * caller cannot name a client it does not hold a token for, but an expired hint is
 * still accepted — refusing one would make the endpoint unusable in practice.
 */
const _resolveClientId = async (params: EndSessionParams): Promise<string | undefined> => {
  if (params.idTokenHint) {
    const verified = await SigningKeyService.verify(params.idTokenHint, {
      typ: TOKEN_TYP.ID_TOKEN,
    });
    const aud = verified?.claims.aud;
    if (typeof aud === 'string') return aud;
  }
  return params.clientId;
};

export const EndSessionService = {
  async endSession(req: Request, res: Response): Promise<void> {
    res.set(NO_STORE_HEADERS);

    const params = _params(req);
    const clientId = await _resolveClientId(params);
    const client = clientId ? await clientService.findByClientId(clientId) : null;

    // Validate the redirect target *before* touching any session state, so a request
    // that is going to be refused never has a side effect.
    if (params.postLogoutRedirectUri) {
      if (!client || !ClientPolicy.allowsPostLogoutRedirectUri(client, params.postLogoutRedirectUri)) {
        Logger.warn('Rejected an unregistered post_logout_redirect_uri', {
          clientId: clientId ?? null,
        });
        res.status(400).json({
          error: OAUTH_ERRORS.INVALID_REQUEST,
          error_description:
            'post_logout_redirect_uri is not registered for this client',
        });
        return;
      }
    }

    const userId = req.user?.id;
    let sessionEnded = false;
    let tokensRevoked = 0;

    if (userId) {
      if (req.user?.sessionId) {
        // `req.user.sessionId` is already the handle; hashing it again would revoke
        // nothing and leave the OP session live after a successful logout.
        sessionEnded = await revokeSession(
          userId,
          req.user.sessionId,
          events.reqContext(req),
          REVOKE_REASONS.RP_INITIATED_LOGOUT,
        );
      }
      // Ending the OP session while leaving the RP holding a live access token would
      // make "log out" mean nothing to the application the user is actually logging
      // out of, so the initiating client's tokens go too.
      if (clientId) {
        tokensRevoked = await AccessTokenStore.revokeForUserClient(
          userId,
          clientId,
          REVOKE_REASONS.RP_INITIATED_LOGOUT,
        );
      }
      events.record('oauth.logout', {
        actorUserId: userId,
        clientId: clientId ?? null,
        ...events.reqContext(req),
        meta: { sessionEnded, revokedCount: tokensRevoked },
      });
    }

    res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, { path: '/' });
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: '/' });

    if (params.postLogoutRedirectUri) {
      const target = new URL(params.postLogoutRedirectUri);
      // §2: `state` is echoed verbatim if and only if the client supplied one.
      if (params.state) target.searchParams.set('state', params.state);
      res.redirect(302, target.toString());
      return;
    }

    res.status(200).json({ logged_out: true, session_ended: sessionEnded });
  },
};
