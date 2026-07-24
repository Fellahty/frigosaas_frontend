import { Router } from 'express';
import authRoutes from './auth.routes.js';
import platformAuthRoutes from './platformAuth.routes.js';
import adminRoutes from './admin.routes.js';
import usersRoutes from './users.routes.js';
import clientsRoutes from './clients.routes.js';
import roomsRoutes from './rooms.routes.js';
import settingsRoutes from './settings.routes.js';
import dataRoutes from './data.routes.js';
import uploadsRoutes from './uploads.routes.js';
import publicRoutes from './public.routes.js';
import { tenantDbMiddleware } from '../middleware/tenantDb.js';
import { enforceTenantAccess } from '../middleware/tenantAccess.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantActivityMiddleware } from '../middleware/tenantActivityLogger.js';
import { authRateLimiter, adminRateLimiter } from '../middleware/security.js';

const router = Router();

const tenantPipeline = [
  authMiddleware,
  enforceTenantAccess,
  tenantActivityMiddleware,
  tenantDbMiddleware,
];
const protectedPipeline = [authMiddleware, tenantActivityMiddleware, tenantDbMiddleware];

router.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/public', publicRoutes);

router.use('/platform/auth', authRateLimiter, platformAuthRoutes);
router.use('/admin', adminRateLimiter, adminRoutes);

router.use('/auth', authRateLimiter, authRoutes);
router.use('/data', ...protectedPipeline, dataRoutes);
router.use('/uploads', ...protectedPipeline, uploadsRoutes);
router.use('/tenants/:tenantId/users', ...tenantPipeline, usersRoutes);
router.use('/tenants/:tenantId/clients', ...tenantPipeline, clientsRoutes);
router.use('/tenants/:tenantId/rooms', ...tenantPipeline, roomsRoutes);
router.use('/tenants/:tenantId/settings', ...tenantPipeline, settingsRoutes);

// Legacy-compatible paths (mirrors api-server.js)
router.use('/settings/rooms', ...protectedPipeline, roomsRoutes);

export default router;
