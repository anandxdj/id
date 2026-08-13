import type { Request, Response } from 'express';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ApiError } from '../../common/utils/ApiError';
import * as oauthService from './oauth.service';
import * as events from '../events/event.service';

export const getConsentContext = async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Not authenticated');
  const q = req.query.transaction_id;
  const transactionId = Array.isArray(q) ? (q[0] as string) : (q as string | undefined);
  const data = await oauthService.loadConsentContext(req.user.id, transactionId);
  ApiResponse.ok(res, 'Consent context', data);
};

export const postConsent = async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Not authenticated');
  const data = await oauthService.completeConsent({
    userId: req.user.id,
    // Carried through so the issued code can record a truthful `auth_time`.
    sessionId: req.user.sessionId,
    transactionId: req.body?.transaction_id,
    decision: req.body?.decision,
    scope: req.body?.scope,
  });
  if (data.granted) {
    events.record('consent.granted', {
      actorUserId: req.user.id,
      actorRole: req.user.role,
      clientId: data.client_id,
      ...events.reqContext(req),
      // The granted scope, not the requested one — this is the audit record that makes
      // a later "which permissions did they actually approve?" answerable.
      meta: { scope: data.scope },
    });
  }
  ApiResponse.ok(res, data.message, { redirect_url: data.redirect_url, scope: data.scope });
};
