import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { Validate, validate } from '../../common/middleware/validate.middleware';
import { authenticate, authorize } from '../auth/auth.middleware';
import { createClientSchema } from './dto/create-client.schema';
import { updateClientSchema } from './dto/update-client.schema';
import { suspendUserSchema } from './dto/suspend-user.schema';
import { changeRoleSchema } from './dto/change-role.schema';
import { userIdParamSchema, clientIdParamSchema } from './dto/path-params.schema';
import { listUsersQuerySchema, activityQuerySchema } from './dto/list-users-query.schema';
import * as controller from './admin.controller';

const router = Router();

// Owner-only: authenticated AND an admin role. Server-side gate (not just the UI).
router.use(authenticate, authorize('admin', 'superadmin'));

const userId = Validate.params(userIdParamSchema);
const clientId = Validate.params(clientIdParamSchema);

// Users
router.get('/users', Validate.query(listUsersQuerySchema), asyncHandler(controller.listUsers));
router.get('/users/:id', userId, asyncHandler(controller.getUser));
router.post('/users/:id/suspend', userId, validate(suspendUserSchema), asyncHandler(controller.suspendUser));
router.post('/users/:id/unsuspend', userId, asyncHandler(controller.unsuspendUser));
router.patch('/users/:id/role', userId, validate(changeRoleSchema), asyncHandler(controller.changeUserRole));

// Monitoring
router.get('/metrics', asyncHandler(controller.metrics));
router.get('/activity', Validate.query(activityQuerySchema), asyncHandler(controller.activity));

// OAuth clients
router.get('/clients', asyncHandler(controller.listClients));
router.post('/clients', validate(createClientSchema), asyncHandler(controller.createClient));
router.patch('/clients/:clientId', clientId, validate(updateClientSchema), asyncHandler(controller.updateClient));
router.post('/clients/:clientId/rotate-secret', clientId, asyncHandler(controller.rotateSecret));
router.post('/clients/:clientId/suspend', clientId, validate(suspendUserSchema), asyncHandler(controller.suspendClient));
router.post('/clients/:clientId/unsuspend', clientId, asyncHandler(controller.unsuspendClient));
router.get('/clients/:clientId/config-prompt', clientId, asyncHandler(controller.configPrompt));

export default router;
