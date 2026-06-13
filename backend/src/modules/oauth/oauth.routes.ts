import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { tryAttachUser } from '../auth/auth.middleware';
import { authenticateOidcAccess } from './oauth-access.middleware';
import * as oidc from './oidc-discovery.controller';
import * as ctrl from './oauth.controller';

const router = Router();

router.get('/jwks', oidc.getJwks);
router.get('/authorize', tryAttachUser, asyncHandler(ctrl.authorize));
router.post('/token', asyncHandler(ctrl.token));
router.get('/userinfo', authenticateOidcAccess, asyncHandler(ctrl.userinfo));

export default router;
