import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../services/auth.service.js';
import { signToken, authMiddleware, AuthRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import { assertTenantCanLogin } from '../platform/services/tenantGate.js';
import { recordTenantLogin } from '../platform/services/tenantActivity.service.js';

const router = Router();

const loginSchema = z.object({
  loginField: z.string().min(1),
  password: z.string().min(1),
  tenantId: z.string().default(env.defaultTenantId),
  userType: z.enum(['manager', 'client']).default('manager'),
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    await assertTenantCanLogin(body.tenantId);
    const user = await authenticate(body.loginField, body.password, body.tenantId, body.userType);

    if (!user) {
      return sendError(res, 'Identifiants invalides', 401);
    }

    await recordTenantLogin(req, body.tenantId, user, body.userType);

    const token = signToken(user);

    return sendSuccess(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        username: user.username,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        userType: user.userType,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  return sendSuccess(res, { user: req.user });
});

export default router;
