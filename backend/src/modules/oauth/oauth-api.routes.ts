import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { authenticate } from '../auth/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { consentDecisionSchema } from './dto/consent-decision.schema';
import * as consentCtrl from './oauth-consent.controller';

const router = Router();

router.get('/consent/context', authenticate, asyncHandler(consentCtrl.getConsentContext));
router.post('/consent', authenticate, validate(consentDecisionSchema), asyncHandler(consentCtrl.postConsent));

export default router;
