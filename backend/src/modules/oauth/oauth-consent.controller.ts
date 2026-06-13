import type { Request, Response } from 'express';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ApiError } from '../../common/utils/ApiError';
import * as oauthService from './oauth.service';

export const getConsentContext = async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Not authenticated');
  const q = req.query.transaction_id;
  const transactionId = Array.isArray(q) ? (q[0] as string) : (q as string | undefined);
  const data = await oauthService.loadConsentContext(req.user.id, transactionId);
  ApiResponse.ok(res, 'Consent context', data);
};

export const postConsent = async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Not authenticated');
  const data = await oauthService.completeConsent(
    req.user.id,
    req.body?.transaction_id,
    req.body?.decision,
  );
  ApiResponse.ok(res, data.message, { redirect_url: data.redirect_url });
};
