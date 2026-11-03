import { Router } from 'express';
import { z } from 'zod';
import { ah, badRequest, notFound } from '../lib/errors';
import { AuditLog, Business, Membership, User } from '../models/core';
import { Invoice } from '../models/billing';
import { Broadcast, Coupon, DEFAULT_COMPLIANCE, FeatureFlag, Plan, Setting, Subscription, Ticket } from '../models/platform';
import { requirePlatformRole } from '../middleware/auth';
import { config } from '../config';
import type { Types } from 'mongoose';
import { audit, compliance, effectivePlan, usage } from '../services/common';
import { platformNumber, quote } from './support';
import { todayIST } from '../lib/dates';
import { fyLabel } from '../../../shared/gst';

/** Super-admin API (spec §8.14). SUPPORT staff can read and work tickets; only SUPER_ADMIN changes money or flags. */
export const adminRouter = Router();
const ANY = requirePlatformRole('SUPER_ADMIN', 'SUPPORT');
const SUPER = requirePlatformRole('SUPER_ADMIN');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

/** Adds per-business usage (this month / this FY), member count and subscription revenue to a page of businesses. */
async function withUsage<T extends { _id: Types.ObjectId }>(items: T[]) {
  const ids = items.map(i => i._id);
  const today = todayIST();
  const monthStart = today.slice(0, 7) + '-01';
  const fyStart = (Number(today.slice(5, 7)) >= 4 ? today.slice(0, 4) : String(Number(today.slice(0, 4)) - 1)) + '-04-01';
  const [inv, members, revenue] = await Promise.all([
    Invoice.aggregate([
      { $match: { businessId: { $in: ids }, date: { $gte: fyStart } } },
      {
        $group: {
          _id: '$businessId',
          invoicesThisMonth: { $sum: { $cond: [{ $gte: ['$date', monthStart] }, 1, 0] } },
          eInvoicesThisYear: { $sum: { $cond: [{ $and: [{ $eq: ['$eInvoice.status', 'GENERATED'] }, { $ne: ['$eInvoice.mock', true] }] }, 1, 0] } },
          eWayBillsThisYear: { $sum: { $cond: [{ $and: [{ $eq: ['$eWayBill.status', 'GENERATED'] }, { $ne: ['$eWayBill.mock', true] }] }, 1, 0] } }
        }
      }
    ]),
    Membership.aggregate([{ $match: { businessId: { $in: ids }, status: 'ACTIVE' } }, { $group: { _id: '$businessId', users: { $sum: 1 } } }]),
    Subscription.aggregate([{ $match: { businessId: { $in: ids }, status: { $ne: 'CANCELLED' } } }, { $group: { _id: '$businessId', total: { $sum: '$totalAmount' } } }])
  ]);
  const by = <R extends { _id: Types.ObjectId }>(rows: R[]) => new Map(rows.map(r => [String(r._id), r]));
  const invBy = by(inv);
  const memBy = by(members);
  const revBy = by(revenue);
  return items.map(b => {
    const k = String(b._id);
    const i = invBy.get(k);
    return {
      ...b,
      usage: {
        invoicesThisMonth: i?.invoicesThisMonth ?? 0,
        users: memBy.get(k)?.users ?? 0,
        eInvoicesThisYear: i?.eInvoicesThisYear ?? 0,
        eWayBillsThisYear: i?.eWayBillsThisYear ?? 0
      },
      lifetimeRevenue: Math.round((revBy.get(k)?.total ?? 0) * 100) / 100
    };
  });
}

// ---------------- analytics ----------------

adminRouter.get(
  '/analytics',
  ANY,
  ah(async (_req, res) => {
    const today = todayIST();
    const since = daysAgo(30);
    const [totalBusinesses, suspended, paid, trials, invoicesPerDay, signupsPerDay, activated30, signups30, planMix] = await Promise.all([
      Business.countDocuments(),
      Business.countDocuments({ status: 'SUSPENDED' }),
      Business.countDocuments({ planId: { $ne: 'free' }, $or: [{ planCycle: 'LIFETIME' }, { planValidUntil: { $gte: today } }] }),
      Business.countDocuments({ trialPlanId: { $ne: null }, trialEndsOn: { $gte: today } }),
      Invoice.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, invoices: { $sum: 1 }, value: { $sum: '$grandTotal' } } }, { $sort: { _id: 1 } }]),
      Business.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, signups: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      // activation = first invoice within 7 days of creating the business
      Business.countDocuments({ createdAt: { $gte: since }, $expr: { $lte: [{ $subtract: ['$firstInvoiceAt', '$createdAt'] }, 7 * 86400000] }, firstInvoiceAt: { $ne: null } }),
      Business.countDocuments({ createdAt: { $gte: since } }),
      Business.aggregate([{ $group: { _id: '$planId', count: { $sum: 1 } } }])
    ]);
    const activeSubs = await Subscription.find({ status: 'ACTIVE' }).lean();
    const years = (c: string) => (c === '2Y' ? 2 : c === '3Y' ? 3 : c === 'LIFETIME' ? 5 : 1);
    const arr = activeSubs.reduce((a, s) => a + ((s.baseAmount ?? 0) - (s.discount ?? 0)) / years(s.cycle), 0);
    // activated per signup day, active merchants per day, e-invoice/e-way volume, monthly retention cohorts
    const monthStart = today.slice(0, 7) + '-01';
    const [activatedPerDay, activePerDay, einvMonth, ewbMonth, cohortRows] = await Promise.all([
      Business.aggregate([
        { $match: { createdAt: { $gte: since }, firstInvoiceAt: { $ne: null } } },
        { $match: { $expr: { $lte: [{ $subtract: ['$firstInvoiceAt', '$createdAt'] }, 7 * 86400000] } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, activated: { $sum: 1 } } }
      ]),
      Invoice.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, b: '$businessId' } } },
        { $group: { _id: '$_id.d', activeMerchants: { $sum: 1 } } }
      ]),
      Invoice.countDocuments({ date: { $gte: monthStart }, 'eInvoice.status': 'GENERATED', 'eInvoice.mock': { $ne: true } }),
      Invoice.countDocuments({ date: { $gte: monthStart }, 'eWayBill.status': 'GENERATED', 'eWayBill.mock': { $ne: true } }),
      Invoice.aggregate([{ $group: { _id: { b: '$businessId', m: { $substrBytes: ['$date', 0, 7] } } } }])
    ]);
    // retention: % of a signup-month cohort that raised at least one invoice in month N
    const signupMonth = new Map(
      (await Business.find({ createdAt: { $gte: daysAgo(220) } }, { createdAt: 1 }).lean()).map(b => [
        String(b._id),
        new Date((b.createdAt as Date).getTime() + 5.5 * 3600000).toISOString().slice(0, 7)
      ])
    );
    const activeMonths = new Map<string, Set<string>>();
    for (const r of cohortRows as { _id: { b: Types.ObjectId; m: string } }[]) {
      const k = String(r._id.b);
      if (!signupMonth.has(k)) continue;
      if (!activeMonths.has(k)) activeMonths.set(k, new Set());
      activeMonths.get(k)!.add(r._id.m);
    }
    const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
    const cohorts: Record<string, { size: number; active: number[] }> = {};
    const currentMonth = today.slice(0, 7);
    for (const [id, m] of signupMonth) {
      cohorts[m] ??= { size: 0, active: Array(monthsBetween(m, currentMonth) + 1).fill(0) };
      cohorts[m].size++;
      for (const am of activeMonths.get(id) ?? []) {
        const n = monthsBetween(m, am);
        if (n >= 0 && n < cohorts[m].active.length) cohorts[m].active[n]++;
      }
    }
    const retention = Object.entries(cohorts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cohort, c]) => ({ cohort, size: c.size, retention: c.active.map(n => Math.round((n / c.size) * 100)) }));

    res.json({
      activatedPerDay,
      activeMerchantsPerDay: activePerDay,
      thisMonth: { eInvoices: einvMonth, eWayBills: ewbMonth },
      retention,
      totals: { businesses: totalBusinesses, paid, trials, suspended, users: await User.countDocuments() },
      activation: { signups30, activated30, rate: signups30 ? Math.round((activated30 / signups30) * 1000) / 10 : 0 },
      revenue: { arr: Math.round(arr), mrr: Math.round(arr / 12) },
      planMix: Object.fromEntries(planMix.map(p => [p._id, p.count])),
      invoicesPerDay,
      signupsPerDay,
      openTickets: await Ticket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } })
    });
  })
);

// ---------------- merchants ----------------

adminRouter.get(
  '/merchants',
  ANY,
  ah(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.planId) filter.planId = req.query.planId;
    if (req.query.q) {
      const re = new RegExp(escapeRe(String(req.query.q)), 'i');
      filter.$or = [{ name: re }, { tradeName: re }, { gstin: re }, { city: re }, { phone: re }];
    }
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const skip = Number(req.query.skip ?? 0);
    const [items, total] = await Promise.all([Business.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('ownerId', 'name phone email').lean(), Business.countDocuments(filter)]);
    res.json({ items: await withUsage(items), total });
  })
);

adminRouter.get(
  '/merchants/:id',
  ANY,
  ah(async (req, res) => {
    const b = await Business.findById(req.params.id).populate('ownerId', 'name phone email').lean();
    if (!b) throw notFound('Business');
    const [plan, u, members, subscriptions, tickets] = await Promise.all([
      effectivePlan(b as never),
      usage(b._id),
      Membership.find({ businessId: b._id, status: 'ACTIVE' }).populate('userId', 'name phone email').lean(),
      Subscription.find({ businessId: b._id }).sort({ createdAt: -1 }).lean(),
      Ticket.find({ businessId: b._id }).sort({ updatedAt: -1 }).limit(20).lean()
    ]);
    res.json({ business: b, plan, usage: u, members, subscriptions, tickets });
  })
);

adminRouter.post(
  '/merchants/:id/status',
  SUPER,
  ah(async (req, res) => {
    const { status, reason } = z.object({ status: z.enum(['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CHURNED']), reason: z.string().max(200).optional() }).parse(req.body);
    if (status === 'SUSPENDED' && !reason) throw badRequest('A reason is required to suspend');
    const b = await Business.findByIdAndUpdate(req.params.id, { status, suspendReason: status === 'SUSPENDED' ? reason : undefined }, { new: true });
    if (!b) throw notFound('Business');
    await audit(req, 'MERCHANT_STATUS', `${b.name} → ${status}${reason ? ' · ' + reason : ''}`, status === 'SUSPENDED' ? 'WARNING' : 'SUCCESS', b._id);
    res.json(b);
  })
);

adminRouter.post(
  '/merchants/:id/extend-trial',
  SUPER,
  ah(async (req, res) => {
    const { days, planId } = z.object({ days: z.number().int().min(1).max(90), planId: z.enum(['silver', 'gold', 'platinum']).optional() }).parse(req.body);
    const b = await Business.findById(req.params.id);
    if (!b) throw notFound('Business');
    const base = b.trialEndsOn && b.trialEndsOn > todayIST() ? b.trialEndsOn : todayIST();
    const d = new Date(base + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    b.trialEndsOn = d.toISOString().slice(0, 10);
    b.trialPlanId = (planId ?? b.trialPlanId ?? 'gold') as 'gold';
    await b.save();
    await audit(req, 'TRIAL_EXTEND', `${b.name} +${days}d (${b.trialPlanId}) until ${b.trialEndsOn}`, 'SUCCESS', b._id);
    res.json(b);
  })
);

/** Manual / offline plan activation: issues the platform's GST invoice for the subscription. */
adminRouter.post(
  '/merchants/:id/subscription',
  SUPER,
  ah(async (req, res) => {
    const body = z.object({ planId: z.enum(['silver', 'gold', 'platinum']), cycle: z.enum(['1Y', '2Y', '3Y', 'LIFETIME']), couponCode: z.string().optional(), gatewayRef: z.string().max(80).optional() }).parse(req.body);
    const b = await Business.findById(req.params.id);
    if (!b) throw notFound('Business');
    const q = await quote(body.planId, body.cycle, body.couponCode);
    const start = todayIST();
    const end = new Date(start + 'T00:00:00Z');
    if (body.cycle === 'LIFETIME') end.setUTCFullYear(2099, 11, 31);
    else end.setUTCFullYear(end.getUTCFullYear() + Number(body.cycle[0]));
    const renewsOn = end.toISOString().slice(0, 10);
    await Subscription.updateMany({ businessId: b._id, status: 'ACTIVE' }, { status: 'CANCELLED', autoRenew: false });
    const sub = await Subscription.create({
      // Rule 46 applies to our own invoices too: MS/26-27/00001 = 14 chars
      invoiceNo: await platformNumber(`SUB_INVOICE:${fyLabel(start)}`, `MS/${fyLabel(start)}/`),
      businessId: b._id,
      businessName: b.name,
      businessGstin: b.gstin,
      planId: body.planId,
      cycle: body.cycle,
      baseAmount: q.baseAmount,
      discount: q.discount,
      gstAmount: q.gstAmount,
      totalAmount: q.totalAmount,
      couponCode: q.couponCode,
      gateway: 'MANUAL',
      gatewayRef: body.gatewayRef,
      status: 'ACTIVE',
      startDate: start,
      renewsOn,
      autoRenew: false,
      createdBy: req.user!._id
    });
    if (q.couponCode) await Coupon.updateOne({ code: q.couponCode }, { $inc: { redeemed: 1 } });
    b.planId = body.planId;
    b.planCycle = body.cycle;
    b.planValidUntil = renewsOn;
    b.trialPlanId = null;
    b.trialEndsOn = '';
    if (b.status === 'PAST_DUE') b.status = 'ACTIVE';
    await b.save();
    await audit(req, 'PLAN_CHANGE', `${b.name} → ${q.planName} ${body.cycle} · ₹${q.totalAmount} (${sub.invoiceNo})`, 'SUCCESS', b._id);
    res.status(201).json(sub);
  })
);

adminRouter.post(
  '/merchants/:id/downgrade',
  SUPER,
  ah(async (req, res) => {
    const b = await Business.findById(req.params.id);
    if (!b) throw notFound('Business');
    await Subscription.updateMany({ businessId: b._id, status: 'ACTIVE' }, { status: 'CANCELLED', autoRenew: false });
    b.planId = 'free';
    b.planCycle = '1Y';
    b.planValidUntil = '';
    b.trialPlanId = null;
    b.trialEndsOn = '';
    await b.save();
    await audit(req, 'PLAN_CHANGE', `${b.name} → Free`, 'WARNING', b._id);
    res.json(b);
  })
);

adminRouter.patch(
  '/merchants/:id/notes',
  ANY,
  ah(async (req, res) => {
    const { notes } = z.object({ notes: z.string().max(2000) }).parse(req.body);
    const b = await Business.findByIdAndUpdate(req.params.id, { adminNotes: notes }, { new: true });
    if (!b) throw notFound('Business');
    res.json({ ok: true });
  })
);

// ---------------- plans, coupons, subscriptions ----------------

const limitNum = z.number().int().min(0).nullable();
const planSchema = z.object({
  name: z.string().min(2).max(40),
  tagline: z.string().max(120).optional(),
  priceYearly: z.number().min(0),
  price2Years: z.number().min(0),
  price3Years: z.number().min(0),
  priceLifetime: z.number().min(0),
  limits: z.object({ invoicesPerMonth: limitNum, users: z.number().int().min(1), businesses: z.number().int().min(1), eWayBillsPerYear: limitNum, eInvoicesPerYear: limitNum }),
  features: z.array(z.string().max(120)).max(20),
  watermark: z.boolean(),
  highlight: z.string().max(30).optional(),
  isActive: z.boolean()
});

adminRouter.get('/plans', ANY, ah(async (_req, res) => res.json(await Plan.find().sort({ priceYearly: 1 }).lean())));
adminRouter.put(
  '/plans/:id',
  SUPER,
  ah(async (req, res) => {
    const body = planSchema.parse(req.body);
    const p = await Plan.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!p) throw notFound('Plan');
    await audit(req, 'PLAN_UPDATE', `${p.name}: ₹${p.priceYearly}/yr`, 'SUCCESS', null);
    res.json(p);
  })
);

adminRouter.get('/subscriptions', ANY, ah(async (req, res) => res.json(await Subscription.find(req.query.status ? { status: req.query.status } : {}).sort({ createdAt: -1 }).limit(500).lean())));
adminRouter.patch(
  '/subscriptions/:id',
  SUPER,
  ah(async (req, res) => {
    const body = z.object({ autoRenew: z.boolean().optional(), status: z.enum(['ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']).optional() }).parse(req.body);
    const s = await Subscription.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!s) throw notFound('Subscription');
    await audit(req, 'SUBSCRIPTION_UPDATE', `${s.invoiceNo} ${JSON.stringify(body)}`, 'SUCCESS', s.businessId);
    res.json(s);
  })
);

adminRouter.get('/coupons', ANY, ah(async (_req, res) => res.json(await Coupon.find().sort({ createdAt: -1 }).lean())));
adminRouter.post(
  '/coupons',
  SUPER,
  ah(async (req, res) => {
    const body = z
      .object({ code: z.string().regex(/^[A-Z0-9]{4,16}$/), type: z.enum(['PERCENT', 'FLAT']), value: z.number().positive(), appliesTo: z.array(z.enum(['silver', 'gold', 'platinum'])).min(1), maxRedemptions: z.number().int().min(1), validUntil: z.string(), description: z.string().max(120).optional() })
      .refine(c => c.type !== 'PERCENT' || c.value <= 90, 'Percent discount cannot exceed 90')
      .parse(req.body);
    const c = await Coupon.create(body);
    await audit(req, 'COUPON_CREATE', `${c.code} ${c.type === 'PERCENT' ? c.value + '%' : '₹' + c.value}`, 'SUCCESS', null);
    res.status(201).json(c);
  })
);
adminRouter.patch(
  '/coupons/:id',
  SUPER,
  ah(async (req, res) => {
    const c = await Coupon.findByIdAndUpdate(req.params.id, z.object({ active: z.boolean() }).parse(req.body), { new: true });
    if (!c) throw notFound('Coupon');
    res.json(c);
  })
);

// ---------------- tickets ----------------

adminRouter.get(
  '/tickets',
  ANY,
  ah(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.assignee) filter.assignee = req.query.assignee;
    res.json(await Ticket.find(filter).sort({ updatedAt: -1 }).limit(300).lean());
  })
);
adminRouter.patch(
  '/tickets/:id',
  ANY,
  ah(async (req, res) => {
    const body = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_MERCHANT', 'RESOLVED', 'CLOSED']).optional(), assignee: z.string().max(60).optional(), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional() }).parse(req.body);
    const t = await Ticket.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!t) throw notFound('Ticket');
    res.json(t);
  })
);
adminRouter.post(
  '/tickets/:id/reply',
  ANY,
  ah(async (req, res) => {
    const { text } = z.object({ text: z.string().min(1).max(4000) }).parse(req.body);
    const t = await Ticket.findById(req.params.id);
    if (!t) throw notFound('Ticket');
    t.messages.push({ from: 'AGENT', author: req.user!.name || 'Support', text, at: new Date() });
    if (t.status === 'OPEN') t.status = 'IN_PROGRESS';
    await t.save();
    res.json(t);
  })
);

// ---------------- feature flags ----------------

adminRouter.get('/flags', ANY, ah(async (_req, res) => res.json(await FeatureFlag.find().sort({ _id: 1 }).lean())));
adminRouter.put(
  '/flags/:key',
  SUPER,
  ah(async (req, res) => {
    const body = z
      .object({ name: z.string().max(80), description: z.string().max(300).optional(), phase: z.enum(['P0', 'P1', 'P2']), enabled: z.boolean(), rollout: z.number().int().min(0).max(100), plans: z.array(z.enum(['free', 'silver', 'gold', 'platinum'])), platforms: z.array(z.enum(['Android', 'iOS', 'Web'])) })
      .parse(req.body);
    const f = await FeatureFlag.findByIdAndUpdate(req.params.key, body, { new: true, upsert: true });
    await audit(req, 'FEATURE_FLAG', `${req.params.key}: ${body.enabled ? 'ON' : 'OFF'} ${body.rollout}% ${body.plans.join('/')}`, 'SUCCESS', null);
    res.json(f);
  })
);

// ---------------- broadcasts ----------------

async function segmentCount(segment: string) {
  const today = todayIST();
  const in3 = todayIST(3);
  switch (segment) {
    case 'FREE': return Business.countDocuments({ planId: 'free' });
    case 'PAID': return Business.countDocuments({ planId: { $ne: 'free' } });
    case 'TRIAL_EXPIRING': return Business.countDocuments({ trialPlanId: { $ne: null }, trialEndsOn: { $gte: today, $lte: in3 } });
    case 'PAST_DUE': return Business.countDocuments({ status: 'PAST_DUE' });
    case 'INACTIVE_14D': return Business.countDocuments({ $or: [{ lastActiveAt: { $lt: daysAgo(14) } }, { lastActiveAt: null }] });
    case 'EINVOICE_ELIGIBLE': return Business.countDocuments({ aatoBand: { $ne: 'UPTO_5CR' } });
    default: return Business.countDocuments({ status: { $ne: 'SUSPENDED' } });
  }
}

adminRouter.get(
  '/segments',
  ANY,
  ah(async (_req, res) => {
    const keys = ['ALL', 'FREE', 'PAID', 'TRIAL_EXPIRING', 'PAST_DUE', 'INACTIVE_14D', 'EINVOICE_ELIGIBLE'];
    res.json(Object.fromEntries(await Promise.all(keys.map(async k => [k, await segmentCount(k)]))));
  })
);

adminRouter.get('/broadcasts', ANY, ah(async (_req, res) => res.json(await Broadcast.find().sort({ createdAt: -1 }).limit(100).lean())));
adminRouter.post(
  '/broadcasts',
  SUPER,
  ah(async (req, res) => {
    const body = z
      .object({ title: z.string().min(3).max(80), message: z.string().min(3).max(1000), channels: z.array(z.enum(['PUSH', 'WHATSAPP', 'SMS', 'EMAIL'])).min(1), segment: z.enum(['ALL', 'FREE', 'PAID', 'TRIAL_EXPIRING', 'PAST_DUE', 'INACTIVE_14D', 'EINVOICE_ELIGIBLE']), language: z.enum(['English', 'Hindi']).default('English'), send: z.enum(['DRAFT', 'NOW', 'SCHEDULE']), scheduledAt: z.string().datetime().optional() })
      .parse(req.body);
    if (body.send === 'SCHEDULE' && !body.scheduledAt) throw badRequest('scheduledAt is required to schedule');
    // delivery workers (FCM / WhatsApp / MSG91) pick up QUEUED and due SCHEDULED broadcasts
    const b = await Broadcast.create({
      ...body,
      status: body.send === 'NOW' ? 'QUEUED' : body.send === 'SCHEDULE' ? 'SCHEDULED' : 'DRAFT',
      scheduledAt: body.scheduledAt,
      recipients: await segmentCount(body.segment),
      createdBy: req.user!._id
    });
    await audit(req, 'BROADCAST', `${b.status} "${b.title}" → ${b.segment} (${b.recipients})`, 'SUCCESS', null);
    res.status(201).json(b);
  })
);

// ---------------- integrations: status only. Secrets live in server env vars, never in the browser ----------------

adminRouter.get(
  '/integrations',
  ANY,
  ah(async (_req, res) => {
    const has = (...keys: string[]) => keys.every(k => !!process.env[k]);
    const prodOrSandbox = config.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
    res.json([
      {
        key: 'gsp', name: 'e-Invoice & e-Way bill GSP', category: 'GSP (e-Invoice / e-Way Bill)',
        provider: config.GSP_MODE === 'mock' ? 'Mock (development only)' : 'Not connected', environment: 'SANDBOX',
        status: config.GSP_MODE === 'disabled' ? 'NOT_CONFIGURED' : 'MOCK',
        envVars: ['GSP_MODE', 'GSP_PROVIDER', 'GSP_CLIENT_ID', 'GSP_CLIENT_SECRET'],
        note: 'SMB apps go through a GSP (IRIS, Masters India, Vayana, ClearTax…). Mock IRNs are blocked in production.'
      },
      {
        key: 'sms', name: 'SMS & OTP', category: 'Auth / OTP',
        provider: config.SMS_PROVIDER === 'msg91' ? 'MSG91' : 'Console (development only)', environment: prodOrSandbox,
        status: config.SMS_PROVIDER === 'msg91' ? (has('MSG91_AUTH_KEY', 'MSG91_OTP_TEMPLATE_ID') ? 'CONNECTED' : 'ERROR') : 'MOCK',
        envVars: ['SMS_PROVIDER', 'MSG91_AUTH_KEY', 'MSG91_OTP_TEMPLATE_ID'],
        note: 'DLT registration and an approved OTP template are required for real SMS.'
      },
      {
        key: 'razorpay', name: 'Payment links & subscriptions', category: 'Payments', provider: 'Razorpay', environment: 'SANDBOX',
        status: has('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET') ? 'CONNECTED' : 'NOT_CONFIGURED',
        envVars: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'],
        note: 'Checkout and webhook-confirmed plan activation are not built yet. Plans can be activated manually.'
      },
      {
        key: 'play_billing', name: 'Google Play Billing', category: 'Payments', provider: 'Google Play', environment: 'SANDBOX',
        status: has('PLAY_PACKAGE_NAME', 'PLAY_SERVICE_ACCOUNT_JSON') ? 'CONNECTED' : 'NOT_CONFIGURED',
        envVars: ['PLAY_PACKAGE_NAME', 'PLAY_SERVICE_ACCOUNT_JSON'],
        note: 'Needed once the Android app sells subscriptions in-app.'
      },
      {
        key: 'whatsapp', name: 'WhatsApp Business (Cloud API)', category: 'Messaging', provider: 'Not connected', environment: 'SANDBOX',
        status: has('WHATSAPP_API_KEY') ? 'CONNECTED' : 'NOT_CONFIGURED',
        envVars: ['WHATSAPP_PROVIDER', 'WHATSAPP_API_KEY', 'WHATSAPP_SENDER'],
        note: 'Invoice and reminder templates need Meta approval. Broadcasts stay QUEUED until a sender is connected.'
      },
      {
        key: 'database', name: 'Database', category: 'Storage & Backup',
        provider: config.MONGODB_URI.includes('mongodb.net') ? 'MongoDB Atlas' : 'MongoDB (local / self-hosted)', environment: prodOrSandbox,
        status: 'CONNECTED', envVars: ['MONGODB_URI'],
        note: 'Use Atlas in Mumbai (ap-south-1) with daily backups for production.'
      }
    ]);
  })
);

// ---------------- add-ons (stored as a platform setting) ----------------

const DEFAULT_ADDONS = [
  { id: 'addon-user', name: 'Extra user login', description: 'One more staff / CA login on any paid plan', price: 499, unit: 'per user / year', active: true },
  { id: 'addon-wa', name: 'WhatsApp message pack', description: '1,000 template messages (invoice + reminders)', price: 699, unit: 'per 1,000 msgs', active: true },
  { id: 'addon-einv', name: 'e-Invoice call pack', description: '500 additional IRN generations', price: 999, unit: 'per 500 IRNs', active: true },
  { id: 'addon-ewb', name: 'e-Way bill call pack', description: '250 additional e-way bills', price: 599, unit: 'per 250 EWBs', active: true },
  { id: 'addon-filing', name: 'Assisted GST filing', description: 'In-house CA files GSTR-1 / 3B', price: 499, unit: 'per return', active: true }
];
const addonSchema = z
  .array(z.object({ id: z.string(), name: z.string().max(80), description: z.string().max(200), price: z.number().min(0), unit: z.string().max(40), active: z.boolean() }))
  .max(30);

adminRouter.get('/addons', ANY, ah(async (_req, res) => res.json(((await Setting.findById('addons').lean())?.value as unknown[]) ?? DEFAULT_ADDONS)));
adminRouter.put(
  '/addons',
  SUPER,
  ah(async (req, res) => {
    const value = addonSchema.parse(req.body);
    await Setting.findByIdAndUpdate('addons', { value }, { upsert: true });
    await audit(req, 'ADDONS_UPDATE', `${value.length} add-ons`, 'SUCCESS', null);
    res.json(value);
  })
);

// ---------------- compliance rules & audit ----------------

adminRouter.get('/compliance', ANY, ah(async (_req, res) => res.json(await compliance())));
adminRouter.put(
  '/compliance',
  SUPER,
  ah(async (req, res) => {
    const shape = Object.fromEntries(Object.keys(DEFAULT_COMPLIANCE).map(k => [k, z.number().min(0)]));
    const value = z.object(shape).partial().parse(req.body);
    const next = { ...(await compliance()), ...value };
    await Setting.findByIdAndUpdate('compliance', { value: next }, { upsert: true });
    await audit(req, 'COMPLIANCE_RULES', JSON.stringify(value), 'SUCCESS', null);
    res.json(next);
  })
);

adminRouter.get(
  '/audit',
  ANY,
  ah(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (req.query.businessId) filter.businessId = req.query.businessId;
    if (req.query.action) filter.action = req.query.action;
    res.json(await AuditLog.find(filter).sort({ createdAt: -1 }).limit(Math.min(500, Number(req.query.limit ?? 200))).lean());
  })
);
