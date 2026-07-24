import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Prevents cross-tenant access: a YAZAMI user cannot read/write another client's data.
 */
export function enforceTenantAccess(req: AuthRequest, res: Response, next: NextFunction) {
  const paramTenant = req.params.tenantId?.toUpperCase();
  const userTenant = req.user?.tenantId?.toUpperCase();

  if (paramTenant && userTenant && paramTenant !== userTenant) {
    return sendError(res, 'Accès refusé — vous ne pouvez accéder qu\'à votre propre frigo', 403);
  }

  next();
}
