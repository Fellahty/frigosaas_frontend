import { Router } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import { guardPathOrReject } from '../middleware/dataPathGuard.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  queryCollection,
  getDocument,
  createDocument,
  updateDocument,
  setDocument,
  deleteDocument,
  type WhereClause,
  type OrderClause,
} from '../services/data.service.js';

const router = Router();

const querySchema = z.object({
  path: z.array(z.string()).min(1),
  where: z
    .array(
      z.object({
        field: z.string(),
        op: z.enum(['==', '!=', '<', '<=', '>', '>=', 'in', 'array-contains']),
        value: z.unknown(),
      })
    )
    .optional(),
  orderBy: z
    .array(
      z.object({
        field: z.string(),
        direction: z.enum(['asc', 'desc']),
      })
    )
    .optional(),
  limit: z.number().optional(),
});

router.post('/query', async (req: AuthRequest, res, next) => {
  try {
    const body = querySchema.parse(req.body);
    if (!guardPathOrReject(req, res, body.path)) return;
    const data = await queryCollection(
      body.path,
      body.where as WhereClause[] | undefined,
      body.orderBy as OrderClause[] | undefined,
      body.limit
    );
    return sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

router.get('/*', async (req: AuthRequest, res, next) => {
  try {
    const path = req.params[0]?.split('/').filter(Boolean) || [];
    if (path.length === 0) return sendError(res, 'Path required', 400);
    if (!guardPathOrReject(req, res, path)) return;

    const data = await getDocument(path);
    if (!data) return sendSuccess(res, null);
    return sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

router.post('/*', async (req: AuthRequest, res, next) => {
  try {
    const path = req.params[0]?.split('/').filter(Boolean) || [];
    if (path.length === 0) return sendError(res, 'Path required', 400);
    if (!guardPathOrReject(req, res, path)) return;

    const data = await createDocument(path, req.body);
    return sendSuccess(res, data, 201);
  } catch (error) {
    next(error);
  }
});

router.patch('/*', async (req: AuthRequest, res, next) => {
  try {
    const path = req.params[0]?.split('/').filter(Boolean) || [];
    if (path.length === 0) return sendError(res, 'Path required', 400);
    if (!guardPathOrReject(req, res, path)) return;

    const data = await updateDocument(path, req.body);
    if (!data) return sendError(res, 'Document introuvable', 404);
    return sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

router.put('/*', async (req: AuthRequest, res, next) => {
  try {
    const path = req.params[0]?.split('/').filter(Boolean) || [];
    if (path.length === 0) return sendError(res, 'Path required', 400);
    if (!guardPathOrReject(req, res, path)) return;

    const merge = req.query.merge !== 'false';
    const data = await setDocument(path, req.body, merge);
    return sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

router.delete('/*', async (req: AuthRequest, res, next) => {
  try {
    const path = req.params[0]?.split('/').filter(Boolean) || [];
    if (path.length === 0) return sendError(res, 'Path required', 400);
    if (!guardPathOrReject(req, res, path)) return;

    await deleteDocument(path);
    return sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
