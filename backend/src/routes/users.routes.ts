import { Router } from 'express';
import { z } from 'zod';
import { getTenantUserModel } from '../tenant/modelFactory.js';
import { requireRoles, resolveTenantId, AuthRequest } from '../middleware/auth.js';
import { sendSuccess, sendError, toId } from '../utils/apiResponse.js';
import { hashPassword } from '../utils/password.js';
import { resolveOrganization } from '../middleware/tenantDb.js';
import { assertWithinPlanLimit } from '../platform/services/planLimits.js';

const router = Router({ mergeParams: true });

router.use(requireRoles('admin', 'manager'));

const createUserSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  username: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6),
  role: z.enum(['admin', 'manager', 'viewer']).default('viewer'),
  isActive: z.boolean().default(true),
});

const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  password: z.string().min(6).optional(),
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const users = await getTenantUserModel().find({ tenantId }).sort({ createdAt: -1 });
    return sendSuccess(res, users.map(toId));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRoles('admin'), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const body = createUserSchema.parse(req.body);
    const org = await resolveOrganization(tenantId);
    if (org) await assertWithinPlanLimit(org, 'users');

    const user = await getTenantUserModel().create({
      ...body,
      tenantId,
      password: await hashPassword(body.password),
    });

    return sendSuccess(res, toId(user), 201);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRoles('admin'), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const body = updateUserSchema.parse(req.body);

    const update: Record<string, unknown> = { ...body };
    if (body.password) {
      update.password = await hashPassword(body.password);
    }

    const user = await getTenantUserModel().findOneAndUpdate(
      { _id: req.params.id, tenantId },
      update,
      { new: true }
    );

    if (!user) {
      return sendError(res, 'Utilisateur introuvable', 404);
    }

    return sendSuccess(res, toId(user));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRoles('admin'), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const user = await getTenantUserModel().findOneAndDelete({ _id: req.params.id, tenantId });

    if (!user) {
      return sendError(res, 'Utilisateur introuvable', 404);
    }

    return sendSuccess(res, { id: req.params.id });
  } catch (error) {
    next(error);
  }
});

export default router;
