import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { verifyAccessToken } from '../services/auth';
import { Business, BusinessRole, Membership, User, UserDoc, BusinessDoc } from '../models/core';
import { ah, forbidden, notFound, unauthorized } from '../lib/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
      business?: BusinessDoc;
      role?: BusinessRole;
    }
  }
}

/** Requires "Authorization: Bearer <access token>". */
export const requireAuth = ah(async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw unauthorized();
  const claims = verifyAccessToken(token);
  const user = await User.findById(claims.sub).lean<UserDoc>();
  if (!user || user.status !== 'ACTIVE') throw unauthorized('Account is not active');
  req.user = user;
  next();
});

export const requirePlatformRole =
  (...roles: ('SUPER_ADMIN' | 'SUPPORT')[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const role = req.user?.platformRole as 'SUPER_ADMIN' | 'SUPPORT' | null | undefined;
    if (!role || !roles.includes(role)) return next(forbidden('Platform admin access required'));
    next();
  };

/**
 * Resolves the tenant from the "X-Business-Id" header and checks the caller's membership.
 * Every business-scoped query must then filter by req.business._id.
 */
export const requireBusiness = ah(async (req, _res, next) => {
  const id = String(req.headers['x-business-id'] ?? '');
  if (!Types.ObjectId.isValid(id)) throw forbidden('Select a business (X-Business-Id header)');
  const business = await Business.findById(id).lean<BusinessDoc>();
  if (!business) throw notFound('Business');
  const membership = await Membership.findOne({ userId: req.user!._id, businessId: business._id, status: 'ACTIVE' }).lean();
  if (!membership) throw forbidden('You are not a member of this business');
  if (business.status === 'SUSPENDED') {
    throw forbidden(`This business is suspended${business.suspendReason ? ': ' + business.suspendReason : ''}. Contact support.`);
  }
  req.business = business;
  req.role = membership.role as BusinessRole;
  Business.updateOne({ _id: business._id }, { lastActiveAt: new Date() }).catch(() => undefined);
  next();
});

/**
 * Role matrix (spec §8.11):
 *  OWNER / ADMIN: everything · SALESMAN: sales documents, payments in, view masters ·
 *  ACCOUNTANT (CA): read-only plus reports
 */
export const allow =
  (...roles: BusinessRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.role || !roles.includes(req.role)) return next(forbidden(`Your role (${req.role ?? 'none'}) cannot do this`));
    next();
  };

export const MANAGE: BusinessRole[] = ['OWNER', 'ADMIN'];
export const SELL: BusinessRole[] = ['OWNER', 'ADMIN', 'SALESMAN'];
export const READ: BusinessRole[] = ['OWNER', 'ADMIN', 'SALESMAN', 'ACCOUNTANT'];
export const BOOKS: BusinessRole[] = ['OWNER', 'ADMIN', 'ACCOUNTANT'];

/** Inline role check for routes where the required role depends on the request body. */
export function assertRole(req: Request, roles: BusinessRole[]) {
  if (!req.role || !roles.includes(req.role)) throw forbidden(`Your role (${req.role ?? 'none'}) cannot do this`);
}
