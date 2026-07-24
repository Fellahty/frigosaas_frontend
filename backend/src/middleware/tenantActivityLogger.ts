import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { recordTenantInteraction } from '../platform/services/tenantActivity.service.js';

/**
 * Persists tenant user interactions (POST/PATCH/PUT/DELETE) to platform InteractionLog.
 * Non-blocking — failures are logged but never break the request.
 */
export function tenantActivityMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return next();

  res.on('finish', () => {
    if (!req.user) return;
    void recordTenantInteraction(req, req.user, res.statusCode).catch((err) => {
      console.error('Interaction log failed:', err);
    });
  });

  next();
}
