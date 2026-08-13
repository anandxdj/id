import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { validate } from '../../common/middleware/validate.middleware';
import { authenticate, authorize } from '../auth/auth.middleware';
import { createClientSchema } from './dto/create-client.schema';
import { updateClientSchema } from './dto/update-client.schema';
import { suspendUserSchema } from './dto/suspend-user.schema';
import { changeRoleSchema } from './dto/change-role.schema';
import * as controller from './admin.controller';

const router = Router();

// Owner-only: authenticated AND an admin role. Server-side gate (not just the UI).
router.use(authenticate, authorize('admin', 'superadmin'));

// Users
router.get('/users', asyncHandler(controller.listUsers));
router.get('/users/:id', asyncHandler(controller.getUser));
router.post('/users/:id/suspend', validate(suspendUserSchema), asyncHandler(controller.suspendUser));
router.post('/users/:id/unsuspend', asyncHandler(controller.unsuspendUser));
// M3: a role change revokes every session the target holds, which is the precondition for
// `auth.middleware` trusting the role denormalised onto the session document.
router.patch('/users/:id/role', validate(changeRoleSchema), asyncHandler(controller.changeUserRole));

// Monitoring
router.get('/metrics', asyncHandler(controller.metrics));
router.get('/activity', asyncHandler(controller.activity));

// OAuth clients
router.get('/clients', asyncHandler(controller.listClients));
router.post('/clients', validate(createClientSchema), asyncHandler(controller.createClient));
router.patch('/clients/:clientId', validate(updateClientSchema), asyncHandler(controller.updateClient));
router.post('/clients/:clientId/rotate-secret', asyncHandler(controller.rotateSecret));
router.post('/clients/:clientId/suspend', validate(suspendUserSchema), asyncHandler(controller.suspendClient));
router.post('/clients/:clientId/unsuspend', asyncHandler(controller.unsuspendClient));
router.get('/clients/:clientId/config-prompt', asyncHandler(controller.configPrompt));

export default router;
