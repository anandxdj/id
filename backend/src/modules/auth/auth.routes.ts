import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { validate } from '../../common/middleware/validate.middleware';
import { authLimiter } from '../../common/middleware/rateLimit';
import { authenticate } from './auth.middleware';
import { registerSchema } from './dto/register.schema';
import { loginSchema } from './dto/login.schema';
import * as controller from './auth.controller';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(controller.register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(controller.login));
router.post('/refresh-token', asyncHandler(controller.refreshToken));
router.post('/logout', authenticate, asyncHandler(controller.logout));
router.get('/me', authenticate, asyncHandler(controller.getMe));

export default router;
