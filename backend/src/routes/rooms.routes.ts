import { Router } from 'express';
import { z } from 'zod';
import { getTenantRoomModel } from '../tenant/modelFactory.js';
import { requireRoles, resolveTenantId, AuthRequest } from '../middleware/auth.js';
import { sendSuccess, sendError, toId } from '../utils/apiResponse.js';
import { resolveOrganization } from '../middleware/tenantDb.js';
import { assertWithinPlanLimit } from '../platform/services/planLimits.js';

const router = Router({ mergeParams: true });

const roomSchema = z.object({
  room: z.string().min(1),
  capacity: z.number().min(0),
  capacityCrates: z.number().min(0).optional(),
  capacityPallets: z.number().min(0).optional(),
  sensorId: z.string().min(1),
  active: z.boolean().default(true),
  capteurInstalled: z.boolean().default(false),
  athGroupNumber: z.number().optional(),
  boitieSensorId: z.string().optional(),
  polygon: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const filter: Record<string, unknown> = { tenantId };

    if (req.query.active === 'true') {
      filter.active = true;
    }

    const rooms = await getTenantRoomModel().find(filter).sort({ room: 1 });
    return sendSuccess(res, rooms.map(toId));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const room = await getTenantRoomModel().findOne({ _id: req.params.id, tenantId });

    if (!room) {
      return sendError(res, 'Chambre introuvable', 404);
    }

    return sendSuccess(res, toId(room));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRoles('admin', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const body = roomSchema.parse(req.body);
    const org = await resolveOrganization(tenantId);
    if (org) await assertWithinPlanLimit(org, 'rooms');

    const room = await getTenantRoomModel().create({ ...body, tenantId });
    return sendSuccess(res, toId(room), 201);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRoles('admin', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const body = roomSchema.partial().parse(req.body);

    const room = await getTenantRoomModel().findOneAndUpdate(
      { _id: req.params.id, tenantId },
      body,
      { new: true }
    );

    if (!room) {
      return sendError(res, 'Chambre introuvable', 404);
    }

    return sendSuccess(res, toId(room));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRoles('admin'), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const room = await getTenantRoomModel().findOneAndDelete({ _id: req.params.id, tenantId });

    if (!room) {
      return sendError(res, 'Chambre introuvable', 404);
    }

    return sendSuccess(res, { id: req.params.id });
  } catch (error) {
    next(error);
  }
});

export default router;
