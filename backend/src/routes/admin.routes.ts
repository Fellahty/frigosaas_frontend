import { Router } from 'express';
import { z } from 'zod';
import {
  platformAuthMiddleware,
  requirePlatformRoles,
  type PlatformAuthRequest,
} from '../middleware/platformAuth.js';
import { OrganizationModel } from '../platform/models/Organization.js';
import { SubscriptionModel } from '../platform/models/Subscription.js';
import { provisionTenant } from '../platform/services/tenantProvisioner.js';
import { collectTenantUsage, collectAllTenantsUsage, getUsageHistory, getPlatformUsageTrend } from '../platform/services/usage.service.js';
import { invalidateOrgCache } from '../platform/services/orgCache.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { getTenantConnectionStats } from '../config/tenantDatabase.js';
import { getOrgCacheStats } from '../platform/services/orgCache.js';
import {
  listTenantAccess,
  updateTenantUser,
  updateTenantClient,
} from '../platform/services/tenantAccessAdmin.service.js';
import { computePlatformAlerts } from '../platform/services/alerts.service.js';
import { logAdminAction, listAuditLogs } from '../platform/services/auditLog.service.js';
import { listLoginLogs, listInteractionLogs } from '../platform/services/tenantActivity.service.js';
import type { AuditAction } from '../platform/models/AuditLog.js';

const router = Router();

const accessPatchSchema = z.object({
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

async function audit(
  req: PlatformAuthRequest,
  action: AuditAction,
  meta: {
    organizationId?: string;
    organizationName?: string;
    targetType?: string;
    targetId?: string;
    targetLabel?: string;
    details?: Record<string, unknown>;
  }
) {
  if (!req.platformUser) return;
  await logAdminAction({ actor: req.platformUser, action, ...meta });
}

router.use(platformAuthMiddleware);
router.use(requirePlatformRoles('super_admin', 'support', 'billing'));

router.get('/dashboard', async (_req, res, next) => {
  try {
    const Org = OrganizationModel();
    const Sub = SubscriptionModel();
    const [orgs, usage, subs] = await Promise.all([
      Org.find().sort({ createdAt: -1 }),
      collectAllTenantsUsage(),
      Sub.find({ status: { $in: ['active', 'trialing'] } }),
    ]);

    const active = orgs.filter((o) => o.status === 'active').length;
    const trial = orgs.filter((o) => o.status === 'trial').length;
    const suspended = orgs.filter((o) => o.status === 'suspended').length;
    const mrr = subs.reduce((sum, s) => sum + (s.priceMonthly || 0), 0);
    const alerts = await computePlatformAlerts(usage);
    const trend = await getPlatformUsageTrend(30);

    return sendSuccess(res, {
      stats: {
        totalFrigos: orgs.length,
        active,
        trial,
        suspended,
        totalClients: usage.reduce((s, u) => s + u.clientsCount, 0),
        totalRooms: usage.reduce((s, u) => s + u.roomsCount, 0),
        mrr,
        alertsCount: alerts.length,
        criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
      },
      usage,
      alerts,
      trend,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/alerts', async (_req, res, next) => {
  try {
    const usage = await collectAllTenantsUsage();
    const alerts = await computePlatformAlerts(usage);
    return sendSuccess(res, alerts);
  } catch (error) {
    next(error);
  }
});

router.get('/audit-logs', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const skip = parseInt(String(req.query.skip || '0'), 10);
    const organizationId = req.query.organizationId as string | undefined;
    const result = await listAuditLogs({ limit, skip, organizationId });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

router.get('/login-logs', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const skip = parseInt(String(req.query.skip || '0'), 10);
    const organizationId = req.query.organizationId as string | undefined;
    const scope = req.query.scope as 'tenant' | 'platform' | undefined;
    const result = await listLoginLogs({ limit, skip, organizationId, scope });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

router.get('/interactions', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10), 300);
    const skip = parseInt(String(req.query.skip || '0'), 10);
    const organizationId = req.query.organizationId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const result = await listInteractionLogs({ limit, skip, organizationId, userId });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

router.get('/organizations/:id/login-logs', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const skip = parseInt(String(req.query.skip || '0'), 10);
    const result = await listLoginLogs({
      organizationId: req.params.id,
      scope: 'tenant',
      limit,
      skip,
    });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

router.get('/organizations/:id/interactions', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10), 300);
    const skip = parseInt(String(req.query.skip || '0'), 10);
    const result = await listInteractionLogs({
      organizationId: req.params.id,
      limit,
      skip,
    });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

router.get('/usage/trend', async (req, res, next) => {
  try {
    const days = Math.min(parseInt(String(req.query.days || '30'), 10), 90);
    const trend = await getPlatformUsageTrend(days);
    return sendSuccess(res, trend);
  } catch (error) {
    next(error);
  }
});

router.get('/organizations', async (_req, res, next) => {
  try {
    const Org = OrganizationModel();
    const orgs = await Org.find().sort({ createdAt: -1 });
    return sendSuccess(res, orgs);
  } catch (error) {
    next(error);
  }
});

router.get('/organizations/:id', async (req, res, next) => {
  try {
    const Org = OrganizationModel();
    const org = await Org.findById(req.params.id);
    if (!org) return sendError(res, 'Frigo introuvable', 404);

    const Sub = SubscriptionModel();
    const subscription = await Sub.findOne({ organizationId: org._id.toString() }).sort({
      createdAt: -1,
    });
    const usage = await collectTenantUsage(org._id.toString());

    return sendSuccess(res, { organization: org, subscription, usage });
  } catch (error) {
    next(error);
  }
});

const createOrgSchema = z.object({
  slug: z.string().min(2).max(32),
  name: z.string().min(2),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  plan: z.enum(['starter', 'pro', 'enterprise']).optional(),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
  adminName: z.string().optional(),
});

router.post('/organizations', requirePlatformRoles('super_admin'), async (req: PlatformAuthRequest, res, next) => {
  try {
    const body = createOrgSchema.parse(req.body);
    const org = await provisionTenant(body);
    await audit(req, 'org.create', {
      organizationId: org._id.toString(),
      organizationName: org.name,
      details: { slug: org.slug, plan: org.plan },
    });
    return sendSuccess(res, org, 201);
  } catch (error) {
    next(error);
  }
});

const updateOrgSchema = z.object({
  name: z.string().min(2).optional(),
  status: z.enum(['active', 'suspended', 'trial', 'cancelled']).optional(),
  plan: z.enum(['starter', 'pro', 'enterprise']).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  maxRooms: z.number().optional(),
  maxUsers: z.number().optional(),
  maxClients: z.number().optional(),
  facilityGroups: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        subtitle: z.string().optional(),
        chFrom: z.number().int().min(0),
        chTo: z.number().int().min(0),
        couloirNumbers: z.array(z.number().int()).default([]),
      })
    )
    .min(1)
    .max(4)
    .optional(),
});

router.patch('/organizations/:id', requirePlatformRoles('super_admin'), async (req: PlatformAuthRequest, res, next) => {
  try {
    const body = updateOrgSchema.parse(req.body);
    const Org = OrganizationModel();
    const org = await Org.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!org) return sendError(res, 'Frigo introuvable', 404);
    invalidateOrgCache(org.legacyId);

    let action: AuditAction = 'org.update';
    if (body.status === 'suspended') action = 'org.suspend';
    else if (body.status === 'active') action = 'org.activate';

    await audit(req, action, {
      organizationId: org._id.toString(),
      organizationName: org.name,
      details: body as Record<string, unknown>,
    });

    return sendSuccess(res, org);
  } catch (error) {
    next(error);
  }
});

router.get('/organizations/:id/usage', async (req, res, next) => {
  try {
    const usage = await collectTenantUsage(req.params.id);
    if (!usage) return sendError(res, 'Frigo introuvable', 404);
    return sendSuccess(res, usage);
  } catch (error) {
    next(error);
  }
});

router.get('/organizations/:id/usage/history', async (req, res, next) => {
  try {
    const Org = OrganizationModel();
    const org = await Org.findById(req.params.id);
    if (!org) return sendError(res, 'Frigo introuvable', 404);
    const days = Math.min(parseInt(String(req.query.days || '30'), 10), 90);
    const history = await getUsageHistory(req.params.id, days);
    return sendSuccess(res, { organizationId: req.params.id, days, history });
  } catch (error) {
    next(error);
  }
});

router.get('/organizations/:id/access', async (req, res, next) => {
  try {
    const access = await listTenantAccess(req.params.id);
    if (!access) return sendError(res, 'Frigo introuvable', 404);
    return sendSuccess(res, access);
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/organizations/:id/access/users/:userId',
  requirePlatformRoles('super_admin', 'support'),
  async (req: PlatformAuthRequest, res, next) => {
    try {
      const body = accessPatchSchema.parse(req.body);
      if (body.isActive === undefined && !body.password) {
        return sendError(res, 'Aucune modification fournie', 400);
      }
      const Org = OrganizationModel();
      const org = await Org.findById(req.params.id);
      const result = await updateTenantUser(req.params.id, req.params.userId, body);
      if (result === null) return sendError(res, 'Frigo introuvable', 404);
      if (result === undefined) return sendError(res, 'Utilisateur introuvable', 404);

      if (body.isActive !== undefined) {
        await audit(req, body.isActive ? 'access.user.unblock' : 'access.user.block', {
          organizationId: req.params.id,
          organizationName: org?.name,
          targetType: 'user',
          targetId: req.params.userId,
          targetLabel: result.name,
        });
      }
      if (body.password) {
        await audit(req, 'access.user.password', {
          organizationId: req.params.id,
          organizationName: org?.name,
          targetType: 'user',
          targetId: req.params.userId,
          targetLabel: result.name,
        });
      }

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/organizations/:id/access/clients/:clientId',
  requirePlatformRoles('super_admin', 'support'),
  async (req: PlatformAuthRequest, res, next) => {
    try {
      const body = accessPatchSchema.parse(req.body);
      if (body.isActive === undefined && !body.password) {
        return sendError(res, 'Aucune modification fournie', 400);
      }
      const Org = OrganizationModel();
      const org = await Org.findById(req.params.id);
      const result = await updateTenantClient(req.params.id, req.params.clientId, body);
      if (result === null) return sendError(res, 'Frigo introuvable', 404);
      if (result === undefined) return sendError(res, 'Client introuvable', 404);

      if (body.isActive !== undefined) {
        await audit(req, body.isActive ? 'access.client.unblock' : 'access.client.block', {
          organizationId: req.params.id,
          organizationName: org?.name,
          targetType: 'client',
          targetId: req.params.clientId,
          targetLabel: result.name,
        });
      }
      if (body.password) {
        await audit(req, 'access.client.password', {
          organizationId: req.params.id,
          organizationName: org?.name,
          targetType: 'client',
          targetId: req.params.clientId,
          targetLabel: result.name,
        });
      }

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/subscriptions', async (_req, res, next) => {
  try {
    const Sub = SubscriptionModel();
    const subs = await Sub.find().sort({ createdAt: -1 });
    return sendSuccess(res, subs);
  } catch (error) {
    next(error);
  }
});

const subSchema = z.object({
  organizationId: z.string(),
  plan: z.enum(['starter', 'pro', 'enterprise']),
  status: z.enum(['active', 'past_due', 'cancelled', 'trialing']).optional(),
  priceMonthly: z.number().optional(),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

router.post('/subscriptions', requirePlatformRoles('super_admin', 'billing'), async (req: PlatformAuthRequest, res, next) => {
  try {
    const body = subSchema.parse(req.body);
    const Sub = SubscriptionModel();
    const sub = await Sub.create({
      ...body,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });
    const Org = OrganizationModel();
    const org = await Org.findById(body.organizationId);
    await audit(req, 'subscription.create', {
      organizationId: body.organizationId,
      organizationName: org?.name,
      targetType: 'subscription',
      targetId: sub._id.toString(),
      details: { plan: body.plan, status: body.status },
    });
    return sendSuccess(res, sub, 201);
  } catch (error) {
    next(error);
  }
});

router.get('/system', requirePlatformRoles('super_admin'), async (_req, res) => {
  return sendSuccess(res, {
    tenantConnections: getTenantConnectionStats(),
    orgCache: getOrgCacheStats(),
  });
});

router.patch('/subscriptions/:id', requirePlatformRoles('super_admin', 'billing'), async (req: PlatformAuthRequest, res, next) => {
  try {
    const body = subSchema.partial().parse(req.body);
    const Sub = SubscriptionModel();
    const sub = await Sub.findByIdAndUpdate(
      req.params.id,
      { ...body, endDate: body.endDate ? new Date(body.endDate) : undefined },
      { new: true }
    );
    if (!sub) return sendError(res, 'Abonnement introuvable', 404);
    const Org = OrganizationModel();
    const org = await Org.findById(sub.organizationId);
    await audit(req, 'subscription.update', {
      organizationId: sub.organizationId,
      organizationName: org?.name,
      targetType: 'subscription',
      targetId: sub._id.toString(),
      details: body as Record<string, unknown>,
    });
    return sendSuccess(res, sub);
  } catch (error) {
    next(error);
  }
});

export default router;
