import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { ah, badRequest, conflict, notFound } from '../lib/errors';
import { Business, Membership, User, BUSINESS_ROLES } from '../models/core';
import { FeatureFlag } from '../models/platform';
import { allow, MANAGE, READ, requireBusiness } from '../middleware/auth';
import { assertLimit, audit, effectivePlan, peekNumber, usage } from '../services/common';
import { AuditLog } from '../models/core';
import { Party, Product, Invoice, TradeDocument, Payment, Expense, StockMovement } from '../models/billing';
import { isValidDocNumber, isValidGstin, isValidPan, GST_STATES } from '../../../shared/gst';
import { normalizePhone } from '../services/auth';
import { todayIST } from '../lib/dates';
import { config } from '../config';

export const businessRouter = Router();

const profileSchema = z.object({
  name: z.string().min(2).max(120),
  tradeName: z.string().max(120).optional(),
  gstin: z.string().max(15).optional(),
  pan: z.string().max(10).optional(),
  gstType: z.enum(['REGULAR', 'COMPOSITION', 'UNREGISTERED']).optional(),
  aatoBand: z.enum(['UPTO_5CR', '5_TO_10CR', 'ABOVE_10CR']).optional(),
  industry: z.string().max(60).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(60).optional(),
  stateCode: z.string().regex(/^\d{2}$/),
  pincode: z.string().regex(/^\d{6}$/).or(z.literal('')).optional(),
  bank: z.object({ name: z.string(), accountNumber: z.string(), ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).or(z.literal('')), branch: z.string() }).partial().optional(),
  upiId: z.string().regex(/^[\w.-]{2,}@[a-zA-Z]{2,}$/).or(z.literal('')).optional(),
  signatureText: z.string().max(120).optional(),
  lutNumber: z.string().max(30).optional(),
  caEmail: z.string().email().or(z.literal('')).optional(),
  autoEmailCa: z.boolean().optional()
});

function checkTaxIds(b: { gstin?: string; pan?: string; stateCode: string; gstType?: string }) {
  if (b.gstin) {
    const g = b.gstin.toUpperCase();
    if (!isValidGstin(g)) throw badRequest('GSTIN is not valid (format or checksum)');
    if (g.slice(0, 2) !== b.stateCode) throw badRequest(`GSTIN starts with ${g.slice(0, 2)} but state code is ${b.stateCode}`);
    if (b.pan && g.slice(2, 12) !== b.pan.toUpperCase()) throw badRequest('PAN does not match the PAN inside the GSTIN');
  } else if (b.gstType && b.gstType !== 'UNREGISTERED') {
    throw badRequest('GSTIN is required for regular and composition taxpayers');
  }
  if (b.pan && !isValidPan(b.pan)) throw badRequest('PAN is not valid');
  if (!GST_STATES[b.stateCode]) throw badRequest('Unknown state code');
}

/** Create a business: the caller becomes OWNER and gets a free trial of a paid plan. */
businessRouter.post(
  '/',
  ah(async (req, res) => {
    const body = profileSchema.parse(req.body);
    checkTaxIds(body);
    const owned = await Membership.find({ userId: req.user!._id, role: 'OWNER', status: 'ACTIVE' }).lean();
    if (owned.length) {
      const first = await Business.findById(owned[0].businessId).lean();
      if (first) await assertLimit(first as never, 'business', owned.length);
    }
    const trialEnds = todayIST(config.TRIAL_DAYS);
    const business = await Business.create({
      ...body,
      gstin: body.gstin?.toUpperCase() ?? '',
      pan: body.pan?.toUpperCase() ?? (body.gstin ? body.gstin.slice(2, 12).toUpperCase() : ''),
      state: GST_STATES[body.stateCode],
      ownerId: req.user!._id,
      planId: 'free',
      planCycle: 'TRIAL',
      trialPlanId: owned.length ? null : config.TRIAL_PLAN, // one trial per owner
      trialEndsOn: owned.length ? '' : trialEnds
    });
    await Membership.create({ userId: req.user!._id, businessId: business._id, role: 'OWNER' });
    await audit(req, 'BUSINESS_CREATE', `${business.name} (${business.gstin || 'unregistered'})`, 'SUCCESS', business._id);
    res.status(201).json(business);
  })
);

// everything below is scoped to the business in the X-Business-Id header
businessRouter.use(requireBusiness);

businessRouter.get(
  '/current',
  ah(async (req, res) => {
    const b = req.business!;
    const plan = await effectivePlan(b);
    const today = todayIST();
    const prefixes = (b.invoiceSettings?.docPrefixes ?? {}) as Record<string, string>;
    const numbering: Record<string, string> = { INV: await peekNumber(b, 'INV', b.invoiceSettings?.prefix ?? 'INV/{FY}/', today) };
    for (const [series, prefix] of Object.entries(prefixes)) numbering[series] = await peekNumber(b, series, prefix, today);
    res.json({ business: b, role: req.role, plan, usage: await usage(b._id), numbering });
  })
);

businessRouter.patch(
  '/current',
  allow(...MANAGE),
  ah(async (req, res) => {
    const body = profileSchema.partial().parse(req.body);
    const merged = { ...req.business!, ...body } as { gstin?: string; pan?: string; stateCode: string; gstType?: string };
    checkTaxIds(merged);
    const update = { ...body, ...(body.stateCode ? { state: GST_STATES[body.stateCode] } : {}), ...(body.gstin ? { gstin: body.gstin.toUpperCase() } : {}) };
    const b = await Business.findByIdAndUpdate(req.business!._id, update, { new: true });
    await audit(req, 'BUSINESS_UPDATE', 'Profile updated');
    res.json(b);
  })
);

const settingsSchema = z
  .object({
    prefix: z.string().max(14),
    padding: z.number().int().min(1).max(8),
    financialYearReset: z.boolean(),
    template: z.enum(['A4_CLASSIC', 'A4_MODERN', 'A5', 'THERMAL_3IN', 'THERMAL_2IN']),
    showUpiQr: z.boolean(),
    showBankDetails: z.boolean(),
    showSignature: z.boolean(),
    roundOff: z.boolean(),
    defaultDueDays: z.number().int().min(0).max(365),
    defaultNotes: z.string().max(500),
    terms: z.string().max(2000),
    allowNegativeStock: z.boolean(),
    autoReminders: z.object({ enabled: z.boolean(), days: z.array(z.number().int().min(0).max(120)).max(6), channels: z.array(z.enum(['WHATSAPP', 'SMS', 'EMAIL'])).min(1) }),
    docPrefixes: z.record(z.string(), z.string().max(14))
  })
  .partial();

businessRouter.patch(
  '/current/settings',
  allow(...MANAGE),
  ah(async (req, res) => {
    const body = settingsSchema.parse(req.body);
    const current = req.business!.invoiceSettings!;
    const next = { ...current, ...body, docPrefixes: { ...current.docPrefixes, ...(body.docPrefixes ?? {}) } };
    const sample = (p: string) => p.replace('{FY}', '26-27') + '9'.repeat(next.padding);
    for (const p of [next.prefix, ...Object.values(next.docPrefixes as Record<string, string>)]) {
      if (!isValidDocNumber(sample(p))) throw badRequest(`Prefix "${p}" would create numbers longer than 16 characters or with invalid characters`);
    }
    const b = await Business.findByIdAndUpdate(req.business!._id, { invoiceSettings: next }, { new: true });
    await audit(req, 'INVOICE_SETTINGS', `Prefix ${next.prefix}, padding ${next.padding}`);
    res.json(b!.invoiceSettings);
  })
);

// ---- team (multi-user roles) ----

businessRouter.get(
  '/current/members',
  allow(...READ),
  ah(async (req, res) => {
    const rows = await Membership.find({ businessId: req.business!._id, status: 'ACTIVE' }).populate('userId', 'name phone email').lean();
    res.json(rows.map(r => ({ id: r._id, role: r.role, user: r.userId })));
  })
);

businessRouter.post(
  '/current/members',
  allow(...MANAGE),
  ah(async (req, res) => {
    const body = z.object({ phone: z.string(), name: z.string().max(80).optional(), role: z.enum(BUSINESS_ROLES).refine(r => r !== 'OWNER', 'Cannot add another owner') }).parse(req.body);
    await assertLimit(req.business!, 'user');
    const phone = normalizePhone(body.phone);
    const user = (await User.findOne({ phone })) ?? (await User.create({ phone, name: body.name ?? '' }));
    const existing = await Membership.findOne({ userId: user._id, businessId: req.business!._id });
    if (existing?.status === 'ACTIVE') throw conflict('Already a member');
    const m = existing
      ? await Membership.findByIdAndUpdate(existing._id, { status: 'ACTIVE', role: body.role }, { new: true })
      : await Membership.create({ userId: user._id, businessId: req.business!._id, role: body.role });
    await audit(req, 'MEMBER_ADD', `${phone} as ${body.role}`);
    res.status(201).json(m);
  })
);

businessRouter.delete(
  '/current/members/:id',
  allow(...MANAGE),
  ah(async (req, res) => {
    const m = await Membership.findOne({ _id: req.params.id, businessId: req.business!._id });
    if (!m) throw notFound('Member');
    if (m.role === 'OWNER') throw badRequest('The owner cannot be removed');
    m.status = 'REMOVED';
    await m.save();
    await audit(req, 'MEMBER_REMOVE', `Member ${m.userId} removed`, 'WARNING');
    res.json({ ok: true });
  })
);

/** This business's own audit trail (owner, admin, CA). */
businessRouter.get(
  '/current/audit',
  allow('OWNER', 'ADMIN', 'ACCOUNTANT'),
  ah(async (req, res) => {
    res.json(await AuditLog.find({ businessId: req.business!._id }).sort({ createdAt: -1 }).limit(Math.min(500, Number(req.query.limit ?? 200))).lean());
  })
);

/** Feature flags evaluated for this business (used by the apps). Rollout is sticky per business. */
businessRouter.get(
  '/current/flags',
  ah(async (req, res) => {
    const plan = await effectivePlan(req.business!);
    const platform = String(req.headers['x-platform'] ?? 'Web');
    const flags = await FeatureFlag.find().lean();
    const out: Record<string, boolean> = {};
    for (const f of flags) {
      const bucket = parseInt(crypto.createHash('md5').update(`${f._id}:${req.business!._id}`).digest('hex').slice(0, 8), 16) % 100;
      out[String(f._id)] = !!f.enabled && f.plans.includes(plan._id) && (f.platforms.length === 0 || f.platforms.includes(platform as 'Web')) && bucket < f.rollout;
    }
    res.json(out);
  })
);

/**
 * Full data export for the business (Play data-safety: data export on request). Owner / admin / CA.
 */
businessRouter.get(
  '/current/export',
  allow('OWNER', 'ADMIN', 'ACCOUNTANT'),
  ah(async (req, res) => {
    const b = req.business!._id;
    const [parties, products, invoices, documents, payments, expenses, stock] = await Promise.all([
      Party.find({ businessId: b }).lean(),
      Product.find({ businessId: b }).lean(),
      Invoice.find({ businessId: b }).lean(),
      TradeDocument.find({ businessId: b }).lean(),
      Payment.find({ businessId: b }).lean(),
      Expense.find({ businessId: b }).lean(),
      StockMovement.find({ businessId: b }).lean()
    ]);
    await audit(req, 'DATA_EXPORT', `Exported ${invoices.length} invoices, ${documents.length} documents`, 'WARNING');
    res.setHeader('Content-Disposition', `attachment; filename="mango-invoice-export-${todayIST()}.json"`);
    res.json({ exportedAt: new Date().toISOString(), business: req.business, parties, products, invoices, documents, payments, expenses, stockMovements: stock });
  })
);

/**
 * Account deletion request (Play data-safety). Access is closed immediately; data is purged by the
 * platform after the GST retention period (books must be kept 72 months, Sec 36 CGST Act).
 */
businessRouter.post(
  '/current/deletion-request',
  allow('OWNER'),
  ah(async (req, res) => {
    const { confirmName } = z.object({ confirmName: z.string() }).parse(req.body);
    if (confirmName.trim().toLowerCase() !== req.business!.name.trim().toLowerCase()) throw badRequest('Type the exact business name to confirm');
    await Business.updateOne(
      { _id: req.business!._id },
      { status: 'SUSPENDED', suspendReason: 'Owner requested account deletion', deletionRequestedAt: new Date(), deletionRequestedBy: req.user!._id }
    );
    await audit(req, 'DELETION_REQUEST', `Owner requested deletion of ${req.business!.name}`, 'WARNING');
    res.json({ ok: true, message: 'Access closed. Your data will be deleted once the 72-month GST record-keeping period ends; download an export first if you need a copy.' });
  })
);
