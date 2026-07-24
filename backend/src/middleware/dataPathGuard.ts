import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Ensures Firestore-style paths cannot access another tenant's data.
 * e.g. tenants/YAZAMI/... only if JWT tenantId === YAZAMI
 */
export function assertTenantPathAccess(req: AuthRequest, path: string[]): boolean {
  if (path[0] !== 'tenants' || !path[1]) return true;

  const pathTenant = path[1].toUpperCase();
  const userTenant = req.user?.tenantId?.toUpperCase();

  if (userTenant && pathTenant !== userTenant) {
    return false;
  }

  return true;
}

export function dataPathGuard(path: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!assertTenantPathAccess(req, path)) {
      return sendError(res, 'Accès refusé — chemin hors de votre client', 403);
    }
    next();
  };
}

export function guardPathOrReject(req: AuthRequest, res: Response, path: string[]): boolean {
  if (!assertTenantPathAccess(req, path)) {
    sendError(res, 'Accès refusé — chemin hors de votre client', 403);
    return false;
  }
  return true;
}
