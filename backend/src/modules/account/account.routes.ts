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

export default router;
