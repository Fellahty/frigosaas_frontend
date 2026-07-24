import { Router } from 'express';
import { z } from 'zod';
import { getTenantClientModel } from '../tenant/modelFactory.js';
import { requireRoles, resolveTenantId, AuthRequest } from '../middleware/auth.js';
import { sendSuccess, sendError, toId } from '../utils/apiResponse.js';
import { hashPassword } from '../utils/password.js';
import { resolveOrganization } from '../middleware/tenantDb.js';
import { assertWithinPlanLimit } from '../platform/services/planLimits.js';

const router = Router({ mergeParams: true });

const createClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  password: z.string().min(6).optional(),
});

const updateClientSchema = createClientSchema.partial();

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const clients = await getTenantClientModel().find({ tenantId }).sort({ createdAt: -1 });
    return sendSuccess(res, clients.map(toId));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const client = await getTenantClientModel().findOne({ _id: req.params.id, tenantId });

    if (!client) {
      return sendError(res, 'Client introuvable', 404);
    }

    return sendSuccess(res, toId(client));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRoles('admin', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const body = createClientSchema.parse(req.body);
    const org = await resolveOrganization(tenantId);
    if (org) await assertWithinPlanLimit(org, 'clients');

    const client = await getTenantClientModel().create({
      ...body,
      tenantId,
      password: body.password ? await hashPassword(body.password) : undefined,
      createdBy: req.user?.name,
    });

    return sendSuccess(res, toId(client), 201);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRoles('admin', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const body = updateClientSchema.parse(req.body);

    const update: Record<string, unknown> = {
      ...body,
      lastModifiedBy: req.user?.name,
      lastModifiedAt: new Date(),
    };

    if (body.password) {
      update.password = await hashPassword(body.password);
    }

    const client = await getTenantClientModel().findOneAndUpdate(
      { _id: req.params.id, tenantId },
      update,
      { new: true }
    );

    if (!client) {
      return sendError(res, 'Client introuvable', 404);
    }

    return sendSuccess(res, toId(client));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRoles('admin', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const client = await getTenantClientModel().findOneAndDelete({ _id: req.params.id, tenantId });

    if (!client) {
      return sendError(res, 'Client introuvable', 404);
    }

    return sendSuccess(res, { id: req.params.id });
  } catch (error) {
    next(error);
  }
});

export default router;
