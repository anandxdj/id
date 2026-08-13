import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { tokenLimiter } from '../../common/middleware/rateLimit';
import { OIDC_ENDPOINT_PATHS } from '../../common/constants/index.constants';
import { tryAttachUser } from '../auth/auth.middleware';
import { authenticateOidcAccess } from './oauth-access.middleware';
import * as oidc from './oidc-discovery.controller';
import * as ctrl from './oauth.controller';

const router = Router();

router.get(OIDC_ENDPOINT_PATHS.JWKS, oidc.getJwks);
router.get(OIDC_ENDPOINT_PATHS.AUTHORIZE, tryAttachUser, asyncHandler(ctrl.authorize));
// The token endpoint is both a client-secret oracle and an authorization-code oracle,
// so it gets a tighter budget than the rest of the OIDC surface.
router.post(OIDC_ENDPOINT_PATHS.TOKEN, tokenLimiter, asyncHandler(ctrl.token));
router.get(OIDC_ENDPOINT_PATHS.USERINFO, authenticateOidcAccess, asyncHandler(ctrl.userinfo));

// Same reasoning as /token: both of these take a client credential and a token, so both
// are brute-forceable and both share the tighter tier.
router.post(OIDC_ENDPOINT_PATHS.REVOKE, tokenLimiter, asyncHandler(ctrl.revoke));
router.post(OIDC_ENDPOINT_PATHS.INTROSPECT, tokenLimiter, asyncHandler(ctrl.introspect));

// RP-initiated logout is a top-level browser navigation, so it must accept GET; the
// POST form exists for clients that would rather not put an id_token_hint in a URL.
// `tryAttachUser` rather than `authenticate`: logging out with no live session is a
// success, not a 401.
router.get(OIDC_ENDPOINT_PATHS.END_SESSION, tryAttachUser, asyncHandler(ctrl.endSession));
router.post(OIDC_ENDPOINT_PATHS.END_SESSION, tryAttachUser, asyncHandler(ctrl.endSession));

export default router;
