import { ApiError } from '../../common/utils/ApiError';
import { OIDC_SCOPES } from '../../common/constants/index.constants';
import Consent from './consent.model';
import { ClientPolicy } from './client-policy.service';
import { ScopeUtil } from './scope.util';
import type { IOAuthClient } from '../oauth-client/oauth-client.model';

/**
 * The authority on what a user has granted a client.
 *
 * Every scope decision in the OAuth flow reads through `grantedScopes`, so the answer
 * to "may this client have `profile`?" comes from one function rather than from
 * whichever `Consent.findOne` happens to be nearest. That is what makes the escalation
 * fix reviewable: there is exactly one place where a grant is read and one where it is
 * written, and both are here.
 */

export interface RecordConsentInput {
  userId: string;
  client: IOAuthClient;
  /** What the client asked for on this authorization request. */
  requested: string[];
  /** What the user ticked. Must not exceed `requested`. */
  approved: string[];
}

export const ConsentGrantService = {
  /**
   * The scopes this user has approved for this client.
   *
   * Consent rows written before M4 have no `grantedScopes` array, only the derived
   * `scope` string — which was the scope displayed on the consent screen the user
   * clicked through, so reading it as the grant is faithful rather than a guess. The
   * alternative, treating those rows as granting nothing, would re-prompt every
   * existing user of every existing client on their next sign-in.
   */
  async grantedScopes(userId: string, clientId: string): Promise<string[]> {
    const consent = await Consent.findOne({ userId, clientId }).lean();
    if (!consent) return [];
    const stored = ScopeUtil.parse(consent.grantedScopes ?? []);
    return stored.length > 0 ? stored : ScopeUtil.parse(consent.scope);
  },

  /**
   * Persist a consent decision and return the resulting grant.
   *
   * Three guards, each of which was a way to widen a grant without the user agreeing:
   *
   *  - the approved set may not exceed what was requested (a tampered consent form
   *    must not be able to grant more than the screen displayed);
   *  - it must still contain `openid`, or the resulting code could not satisfy an OIDC
   *    request at all;
   *  - it is re-checked against the client's allowlist, because the client's
   *    registration may have been tightened while the transaction sat parked.
   *
   * The stored grant is the **union** with any previous one: a user who approves
   * `profile` today has not withdrawn the `email` they approved last week.
   */
  async record(input: RecordConsentInput): Promise<string[]> {
    const approved = ScopeUtil.parse(input.approved);

    if (!ScopeUtil.covers(input.requested, approved)) {
      throw ApiError.badRequest('Granted scope exceeds the scope this client requested');
    }
    if (!approved.includes(OIDC_SCOPES.OPENID)) {
      throw ApiError.badRequest(`Granted scope must include ${OIDC_SCOPES.OPENID}`);
    }
    const disallowed = ClientPolicy.disallowedScopes(input.client, approved);
    if (disallowed.length > 0) {
      throw ApiError.badRequest(
        `This client is not registered for: ${disallowed.join(', ')}`,
      );
    }

    const previous = await this.grantedScopes(input.userId, input.client.clientId);
    const merged = ScopeUtil.union(previous, approved);

    await Consent.findOneAndUpdate(
      { userId: input.userId, clientId: input.client.clientId },
      {
        userId: input.userId,
        clientId: input.client.clientId,
        grantedScopes: merged,
        // Derived mirror, for the authorized-apps screen. Never read for a decision.
        scope: ScopeUtil.format(merged),
      },
      { upsert: true, new: true },
    );

    return merged;
  },
};
