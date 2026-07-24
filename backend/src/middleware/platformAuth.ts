import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';
import type { PlatformRole } from '../platform/models/PlatformUser.js';
import type { Request } from 'express';

export interface PlatformAuthUser {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  scope: 'platform';
}

export interface PlatformAuthRequest extends Request {
  platformUser?: PlatformAuthUser;
}

interface PlatformJwtPayload {
  sub: string;
  name: string;
  email: string;
  role: PlatformRole;
  scope: 'platform';
}

export function signPlatformToken(user: PlatformAuthUser): string {
  const payload: PlatformJwtPayload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    scope: 'platform',
  };
  return jwt.sign(payload, env.platformJwtSecret, {
    expiresIn: env.platformJwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function platformAuthMiddleware(req: PlatformAuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return sendError(res, 'Token manquant', 401);
  }

  try {
    const decoded = jwt.verify(header.slice(7), env.platformJwtSecret) as PlatformJwtPayload;
    if (decoded.scope !== 'platform') {
      return sendError(res, 'Token invalide pour le panel admin', 401);
    }
    req.platformUser = {
      id: decoded.sub,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
      scope: 'platform',
    };
    next();
  } catch {
    return sendError(res, 'Token invalide ou expiré', 401);
  }
}

export function requirePlatformRoles(...roles: PlatformRole[]) {
  return (req: PlatformAuthRequest, res: Response, next: NextFunction) => {
    if (!req.platformUser) {
      return sendError(res, 'Non authentifié', 401);
    }
    if (!roles.includes(req.platformUser.role)) {
      return sendError(res, 'Accès refusé', 403);
    }
    next();
  };
}
