import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/apiResponse.js';

import { env } from '../config/env.js';
import { TenantAccessError } from '../platform/services/tenantGate.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof TenantAccessError) {
    return sendError(res, err.message, err.statusCode);
  }

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => e.message).join(', ');
    return sendError(res, message, 400);
  }

  if (err instanceof Error) {
    console.error('API Error:', err);
    const message = env.isProduction ? 'Erreur interne du serveur' : err.message;
    return sendError(res, message, 500);
  }

  return sendError(res, 'Erreur interne du serveur', 500);
}

export function notFoundHandler(_req: Request, res: Response) {
  return sendError(res, 'Route introuvable', 404);
}
