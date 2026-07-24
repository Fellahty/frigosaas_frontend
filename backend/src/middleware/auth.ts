import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';
import type { UserRole } from '../models/User.js';

export interface AuthUser {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  username?: string;
  role: UserRole;
  userType: 'manager' | 'client';
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

interface JwtPayload {
  sub: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  username?: string;
  role: UserRole;
  userType: 'manager' | 'client';
  scope?: 'tenant';
}

export function signToken(user: AuthUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    username: user.username,
    role: user.role,
    userType: user.userType,
    scope: 'tenant',
  };

  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return sendError(res, 'Token manquant', 401);
  }

  const token = header.slice(7);

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;

    if (decoded.scope === 'platform') {
      return sendError(res, 'Token non valide pour cette API', 401);
    }

    if (!decoded.tenantId || !decoded.sub) {
      return sendError(res, 'Token invalide', 401);
    }

    req.user = {
      id: decoded.sub,
      tenantId: decoded.tenantId,
      name: decoded.name,
      email: decoded.email,
      phone: decoded.phone,
      username: decoded.username,
      role: decoded.role,
      userType: decoded.userType,
    };
    next();
  } catch {
    return sendError(res, 'Token invalide ou expiré', 401);
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Non authentifié', 401);
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Accès refusé', 403);
    }

    next();
  };
}

export function resolveTenantId(req: AuthRequest, paramTenantId?: string): string {
  return paramTenantId || req.user?.tenantId || env.defaultTenantId;
}
