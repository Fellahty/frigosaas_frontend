import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function sendError(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export function toId(doc: { _id: unknown; toObject?: () => Record<string, unknown> }) {
  const obj = doc.toObject ? doc.toObject() : (doc as Record<string, unknown>);
  return {
    ...obj,
    id: String(obj._id),
    _id: undefined,
    __v: undefined,
    password: undefined,
  };
}
