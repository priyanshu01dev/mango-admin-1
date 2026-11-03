import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'ERROR', public details?: unknown) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, 'BAD_REQUEST', details);
export const unauthorized = (msg = 'Login required') => new HttpError(401, msg, 'UNAUTHORIZED');
export const forbidden = (msg = 'You do not have permission for this action') => new HttpError(403, msg, 'FORBIDDEN');
export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`, 'NOT_FOUND');
export const conflict = (msg: string) => new HttpError(409, msg, 'CONFLICT');
export const planLimit = (msg: string) => new HttpError(402, msg, 'PLAN_LIMIT');

/** Lets async route handlers throw instead of calling next(err). */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: 'Invalid input', details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }
    });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { code: 'BAD_ID', message: `Invalid ${err.path}` } });
  }
  if (typeof err === 'object' && err && (err as { code?: number }).code === 11000) {
    const key = Object.keys((err as { keyValue?: object }).keyValue ?? {}).join(', ');
    return res.status(409).json({ error: { code: 'DUPLICATE', message: `Already exists (${key})` } });
  }
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
}
