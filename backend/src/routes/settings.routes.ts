import { Router } from 'express';
import { z } from 'zod';
import { getTenantSettingsModel } from '../tenant/modelFactory.js';
import { requireRoles, resolveTenantId, AuthRequest } from '../middleware/auth.js';
import { sendSuccess, toId } from '../utils/apiResponse.js';

const router = Router({ mergeParams: true });

const settingsSchema = z.object({
  name: z.string().min(1).optional(),
  currency: z.string().optional(),
  locale: z.enum(['fr', 'ar']).optional(),
  season: z.object({ from: z.string(), to: z.string() }).optional(),
  capacity_unit: z.enum(['caisses', 'palettes']).optional(),
  ratio_caisses_par_palette: z.number().optional(),
  baseUrl: z.string().optional(),
  initial_cash_balance: z.number().min(0).optional(),
  pool_vides_total: z.number().min(0).optional(),
  tarif_caisse_saison: z.number().min(0).optional(),
  caution_par_caisse: z.number().min(0).optional(),
  paymentTerms: z
    .union([
      z.object({ mode: z.literal('due_on_exit') }),
      z.object({ mode: z.literal('net_days'), days: z.number().min(1) }),
    ])
    .optional(),
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const settings = await getTenantSettingsModel().findOne({ tenantId });
    return sendSuccess(res, settings ? toId(settings) : null);
  } catch (error) {
    next(error);
  }
});

router.put('/', requireRoles('admin', 'manager'), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = resolveTenantId(req, req.params.tenantId);
    const body = settingsSchema.parse(req.body);

    const settings = await getTenantSettingsModel().findOneAndUpdate(
      { tenantId },
      { $set: body, $setOnInsert: { tenantId, name: body.name || 'Mon Frigo' } },
      { new: true, upsert: true }
    );

    return sendSuccess(res, toId(settings!));
  } catch (error) {
    next(error);
  }
});

export default router;
