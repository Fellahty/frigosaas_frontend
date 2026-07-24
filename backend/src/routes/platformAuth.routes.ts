import { Router } from 'express';
import { z } from 'zod';
import { authenticatePlatformUser } from '../platform/services/platformAuth.service.js';
import {
  signPlatformToken,
  platformAuthMiddleware,
  requirePlatformRoles,
  type PlatformAuthRequest,
} from '../middleware/platformAuth.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { recordPlatformLogin } from '../platform/services/tenantActivity.service.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await authenticatePlatformUser(body.email, body.password);

    if (!user) {
      return sendError(res, 'Identifiants invalides', 401);
    }

    const token = signPlatformToken(user);
    await recordPlatformLogin(req, user);
    return sendSuccess(res, { token, user });
  } catch (error) {
    next(error);
  }
});

router.get('/me', platformAuthMiddleware, (req: PlatformAuthRequest, res) => {
  return sendSuccess(res, { user: req.platformUser });
});

export default router;
