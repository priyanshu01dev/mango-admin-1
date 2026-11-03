import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { OtpCode, RefreshToken, User } from '../models/core';
import { HttpError, badRequest, unauthorized } from '../lib/errors';
import { sendOtpSms } from './sms';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export interface AccessClaims {
  sub: string;
  role: string | null; // platform role
}

export function signAccessToken(user: { _id: unknown; platformRole?: string | null }) {
  const claims: AccessClaims = { sub: String(user._id), role: user.platformRole ?? null };
  return jwt.sign(claims, config.JWT_ACCESS_SECRET, {
    expiresIn: config.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
    issuer: 'mango-invoice'
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    return jwt.verify(token, config.JWT_ACCESS_SECRET, { issuer: 'mango-invoice' }) as AccessClaims;
  } catch {
    throw unauthorized('Session expired, please log in again');
  }
}

/** Opaque refresh token; only its hash is stored so a database leak can't be replayed. */
export async function issueRefreshToken(userId: unknown, userAgent?: string) {
  const token = crypto.randomBytes(48).toString('base64url');
  await RefreshToken.create({
    userId,
    tokenHash: sha256(token),
    userAgent,
    expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_DAYS * 86400000)
  });
  return token;
}

/** Rotates a refresh token. Re-use of an already-rotated token revokes every session of that user. */
export async function rotateRefreshToken(token: string, userAgent?: string) {
  const row = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (!row || row.expiresAt < new Date()) throw unauthorized('Session expired, please log in again');
  if (row.revokedAt) {
    await RefreshToken.updateMany({ userId: row.userId, revokedAt: null }, { revokedAt: new Date() });
    throw unauthorized('Session was revoked, please log in again');
  }
  row.revokedAt = new Date();
  await row.save();
  const user = await User.findById(row.userId);
  if (!user || user.status !== 'ACTIVE') throw unauthorized();
  return { user, accessToken: signAccessToken(user), refreshToken: await issueRefreshToken(user._id, userAgent) };
}

export async function revokeRefreshToken(token: string) {
  await RefreshToken.updateOne({ tokenHash: sha256(token) }, { revokedAt: new Date() });
}

export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) throw badRequest('Enter a valid 10-digit Indian mobile number');
  return '+91' + local;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_MS = 30 * 1000;

export async function requestOtp(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  const recent = await OtpCode.findOne({ phone, createdAt: { $gt: new Date(Date.now() - OTP_RESEND_MS) } });
  if (recent) throw new HttpError(429, 'Please wait 30 seconds before requesting another OTP', 'RATE_LIMIT');
  const code = String(crypto.randomInt(100000, 1000000));
  await OtpCode.deleteMany({ phone });
  await OtpCode.create({ phone, codeHash: sha256(phone + ':' + code), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  await sendOtpSms(phone, code);
  // the code is only echoed back for local development with the console SMS provider
  const echo = config.SMS_PROVIDER === 'console' && config.NODE_ENV !== 'production';
  return { phone, devCode: echo ? code : undefined };
}

export async function verifyOtp(rawPhone: string, code: string) {
  const phone = normalizePhone(rawPhone);
  const row = await OtpCode.findOne({ phone });
  if (!row || row.expiresAt < new Date()) throw badRequest('OTP expired, please request a new one');
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await row.deleteOne();
    throw new HttpError(429, 'Too many wrong attempts, please request a new OTP', 'RATE_LIMIT');
  }
  const expected = Buffer.from(row.codeHash);
  const given = Buffer.from(sha256(phone + ':' + code.trim()));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    row.attempts += 1;
    await row.save();
    throw badRequest('Wrong OTP');
  }
  await row.deleteOne();
  return phone;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
