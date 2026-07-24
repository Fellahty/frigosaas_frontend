import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Express, RequestHandler } from 'express';
import { env } from '../config/env.js';

const isTest = env.nodeEnv === 'test' || process.env.VITEST === 'true';
const noop: RequestHandler = (_req, _res, next) => next();

export function applySecurityMiddleware(app: Express): void {
  if (isTest) return;

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: env.nodeEnv === 'production' ? undefined : false,
    })
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: env.nodeEnv === 'production' ? 300 : 2000,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Trop de requêtes, réessayez plus tard' },
    })
  );
}

export const authRateLimiter =
  isTest || env.nodeEnv !== 'production'
    ? noop
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: 'Trop de tentatives de connexion' },
      });

export const adminRateLimiter =
  isTest || env.nodeEnv !== 'production'
    ? noop
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 60,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: 'Trop de requêtes admin' },
      });
