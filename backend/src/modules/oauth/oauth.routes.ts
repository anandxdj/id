import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { tokenLimiter } from '../../common/middleware/rateLimit';
import { tryAttachUser } from '../auth/auth.middleware';
import { authenticateOidcAccess } from './oauth-access.middleware';
import * as oidc from './oidc-discovery.controller';
import * as ctrl from './oauth.controller';

const router = Router();

router.get('/jwks', oidc.getJwks);
router.get('/authorize', tryAttachUser, asyncHandler(ctrl.authorize));
// The token endpoint is both a client-secret oracle and an authorization-code oracle,
// so it gets a tighter budget than the rest of the OIDC surface.
router.post('/token', tokenLimiter, asyncHandler(ctrl.token));
router.get('/userinfo', authenticateOidcAccess, asyncHandler(ctrl.userinfo));

export default router;
