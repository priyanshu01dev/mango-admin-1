import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ah, unauthorized } from '../lib/errors';
import { Membership, User } from '../models/core';
import { requireAuth } from '../middleware/auth';
import { checkPassword, issueRefreshToken, requestOtp, revokeRefreshToken, rotateRefreshToken, signAccessToken, verifyOtp } from '../services/auth';
import { audit } from '../services/common';
import { config } from '../config';

export const authRouter = Router();

// brute-force protection on login endpoints
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.NODE_ENV === 'test' ? 1000 : 20, standardHeaders: 'draft-7', legacyHeaders: false });

async function session(user: { _id: unknown; platformRole?: string | null }, userAgent?: string) {
  return { accessToken: signAccessToken(user), refreshToken: await issueRefreshToken(user._id, userAgent) };
}

async function profile(userId: unknown) {
  const user = await User.findById(userId).lean();
  const memberships = await Membership.find({ userId, status: 'ACTIVE' }).populate('businessId', 'name tradeName gstin stateCode planId status').lean();
  return {
    user: { id: user!._id, name: user!.name, phone: user!.phone, email: user!.email, platformRole: user!.platformRole, language: user!.language },
    businesses: memberships.filter(m => m.businessId).map(m => ({ role: m.role, business: m.businessId }))
  };
}

/** Step 1 of mobile login: send OTP. */
authRouter.post(
  '/otp/request',
  limiter,
  ah(async (req, res) => {
    const { phone } = z.object({ phone: z.string().min(10) }).parse(req.body);
    const out = await requestOtp(phone);
    res.json({ sent: true, phone: out.phone, ...(out.devCode ? { devCode: out.devCode } : {}) });
  })
);

/** Step 2: verify OTP → creates the account on first login. */
authRouter.post(
  '/otp/verify',
  limiter,
  ah(async (req, res) => {
    const body = z.object({ phone: z.string(), code: z.string().regex(/^\d{6}$/), name: z.string().max(80).optional() }).parse(req.body);
    const phone = await verifyOtp(body.phone, body.code);
    let user = await User.findOne({ phone });
    const isNew = !user;
    if (!user) user = await User.create({ phone, name: body.name ?? '' });
    if (user.status !== 'ACTIVE') throw unauthorized('Account is blocked');
    user.lastLoginAt = new Date();
    await user.save();
    await audit(req, isNew ? 'SIGNUP' : 'LOGIN', `OTP login ${phone}`, 'SUCCESS', null);
    res.json({ isNew, ...(await session(user, req.headers['user-agent'])), ...(await profile(user._id)) });
  })
);

/** Email + password login (web dashboard and platform admins). */
authRouter.post(
  '/login',
  limiter,
  ah(async (req, res) => {
    const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    // same error for unknown email and wrong password
    if (!user?.passwordHash || !(await checkPassword(password, user.passwordHash))) {
      await audit(req, 'LOGIN_FAILED', `Email login ${email}`, 'FAILED', null);
      throw unauthorized('Wrong email or password');
    }
    if (user.status !== 'ACTIVE') throw unauthorized('Account is blocked');
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ ...(await session(user, req.headers['user-agent'])), ...(await profile(user._id)) });
  })
);

authRouter.post(
  '/refresh',
  ah(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
    const out = await rotateRefreshToken(refreshToken, req.headers['user-agent']);
    res.json({ accessToken: out.accessToken, refreshToken: out.refreshToken });
  })
);

authRouter.post(
  '/logout',
  ah(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    await revokeRefreshToken(refreshToken);
    res.json({ ok: true });
  })
);

authRouter.get('/me', requireAuth, ah(async (req, res) => res.json(await profile(req.user!._id))));

authRouter.patch(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const body = z.object({ name: z.string().max(80).optional(), language: z.enum(['en', 'hi']).optional() }).parse(req.body);
    await User.updateOne({ _id: req.user!._id }, body);
    res.json(await profile(req.user!._id));
  })
);
