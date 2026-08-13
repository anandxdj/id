import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { validate } from '../../common/middleware/validate.middleware';
import { authenticate } from '../auth/auth.middleware';
import { profileSchema } from './dto/profile.schema';
import * as controller from './account.controller';

const router = Router();

// Every account route is first-party authenticated.
router.use(authenticate);

router.get('/apps', asyncHandler(controller.listApps));
router.delete('/apps/:clientId', asyncHandler(controller.revokeApp));

router.get('/sessions', asyncHandler(controller.listSessions));
router.post('/sessions/revoke-all', asyncHandler(controller.revokeAllSessions));
router.delete('/sessions/:sid', asyncHandler(controller.revokeSession));

router.get('/profile', asyncHandler(controller.getProfile));
router.patch('/profile', validate(profileSchema), asyncHandler(controller.updateProfile));

// Close the caller's own account. `DELETE /api/v1/me` — the resource *is* the caller, so
// there is no path parameter and therefore no way to aim it at somebody else.
router.delete('/', asyncHandler(controller.deleteAccount));

export default router;
