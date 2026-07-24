import { Router } from 'express';
import { resolveOrganization } from '../middleware/tenantDb.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

const router = Router();

/** Public branding info for tenant login pages (no auth). */
router.get('/tenants/:slugOrId', async (req, res, next) => {
  try {
    const org = await resolveOrganization(req.params.slugOrId);
    if (!org) {
      return sendError(res, 'Client introuvable', 404);
    }

    if (org.status === 'suspended' || org.status === 'cancelled') {
      return sendError(res, 'Ce frigo est suspendu. Contactez FrigoSmart.', 403);
    }

    return sendSuccess(res, {
      legacyId: org.legacyId,
      slug: org.slug,
      name: org.name,
      status: org.status,
      facilityGroups: org.facilityGroups?.length ? org.facilityGroups : undefined,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
