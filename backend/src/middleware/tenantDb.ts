import { Request, Response, NextFunction } from 'express';
import { OrganizationModel } from '../platform/models/Organization.js';
import { getTenantConnection } from '../config/tenantDatabase.js';
import { runWithTenantContext, runWithTenantContextAsync } from './tenantContext.js';
import { sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import type { AuthRequest } from './auth.js';
import { getCachedOrganization, setCachedOrganization } from '../platform/services/orgCache.js';
import { isAllowedTenantDbName } from '../config/mongoOptions.js';

export async function resolveOrganization(tenantIdOrSlug: string) {
  const cached = getCachedOrganization(tenantIdOrSlug);
  if (cached) return cached;

  const Org = OrganizationModel();
  const normalized = tenantIdOrSlug.trim();
  const org = await Org.findOne({
    $or: [
      { legacyId: normalized.toUpperCase() },
      { slug: normalized.toLowerCase() },
    ],
  });

  if (org) {
    setCachedOrganization(tenantIdOrSlug, org);
  }

  return org;
}

export function resolveTenantIdFromRequest(req: AuthRequest, paramTenantId?: string): string {
  return paramTenantId || req.user?.tenantId || env.defaultTenantId;
}

export async function tenantDbMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = resolveTenantIdFromRequest(req, req.params.tenantId);

    // Enforce JWT tenant matches resolved tenant for authenticated routes
    if (req.user?.tenantId) {
      const userTenant = req.user.tenantId.toUpperCase();
      const resolved = tenantId.toUpperCase();
      if (userTenant !== resolved) {
        return sendError(res, 'Accès refusé — isolation client', 403);
      }
    }

    const org = await resolveOrganization(tenantId);

    if (!org) {
      if (env.requireTenantRegistry) {
        return sendError(res, 'Client non enregistré sur la plateforme', 403);
      }
      return next();
    }

    if (org.status === 'suspended' || org.status === 'cancelled') {
      return sendError(res, 'Ce frigo est suspendu. Contactez FrigoSmart.', 403);
    }

    if (!isAllowedTenantDbName(org.dbName)) {
      return sendError(res, 'Configuration base de données invalide', 500);
    }

    const connection = await getTenantConnection(org.dbName);

    runWithTenantContext(
      {
        connection,
        dbName: org.dbName,
        legacyId: org.legacyId,
        organizationId: org._id.toString(),
      },
      () => next()
    );
  } catch (error) {
    next(error);
  }
}

export async function withTenantDb<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  const org = await resolveOrganization(tenantId);
  if (!org) {
    if (env.requireTenantRegistry) {
      throw new Error('Client non enregistré');
    }
    return fn();
  }

  if (!isAllowedTenantDbName(org.dbName)) {
    throw new Error('Configuration base de données invalide');
  }

  const connection = await getTenantConnection(org.dbName);
  return runWithTenantContextAsync(
    {
      connection,
      dbName: org.dbName,
      legacyId: org.legacyId,
      organizationId: org._id.toString(),
    },
    fn
  );
}
