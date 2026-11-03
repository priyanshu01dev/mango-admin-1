import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { ah, badRequest, HttpError, notFound } from '../lib/errors';
import { Coupon, Plan, Ticket } from '../models/platform';
import { Counter } from '../models/core';
import { allow, MANAGE, READ } from '../middleware/auth';
import { r2 } from '../../../shared/gst';
import { todayIST } from '../lib/dates';

export const supportRouter = Router();
export const PLATFORM_ID = new Types.ObjectId('000000000000000000000000');
export const SUB_GST_RATE = 18;

export async function platformNumber(key: string, prefix: string) {
  const c = await Counter.findOneAndUpdate({ businessId: PLATFORM_ID, key }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return prefix + String(c!.seq).padStart(5, '0');
}

/** Price for a plan + cycle with an optional coupon, GST at 18%. */
export async function quote(planId: string, cycle: '1Y' | '2Y' | '3Y' | 'LIFETIME', couponCode?: string) {
  const plan = await Plan.findById(planId).lean();
  if (!plan || !plan.isActive) throw badRequest('Plan is not available');
  const base = cycle === '2Y' ? plan.price2Years : cycle === '3Y' ? plan.price3Years : cycle === 'LIFETIME' ? plan.priceLifetime : plan.priceYearly;
  if (!base) throw badRequest('This plan has no price for that cycle');
  let discount = 0;
  let coupon: string | undefined;
  if (couponCode) {
    const c = await Coupon.findOne({ code: couponCode.toUpperCase() }).lean();
    if (!c || !c.active || c.validUntil < todayIST() || c.redeemed >= c.maxRedemptions) throw badRequest('Coupon is invalid or expired');
    if (c.appliesTo.length && !c.appliesTo.includes(planId as 'gold')) throw badRequest(`Coupon does not apply to ${plan.name}`);
    discount = c.type === 'PERCENT' ? r2((base * c.value) / 100) : Math.min(base, c.value);
    coupon = c.code;
  }
  const taxable = r2(base - discount);
  const gst = r2((taxable * SUB_GST_RATE) / 100);
  return { planId, planName: plan.name, cycle, baseAmount: base, discount, couponCode: coupon, taxable, gstAmount: gst, totalAmount: r2(taxable + gst) };
}

// ---------- merchant: support tickets ----------

supportRouter.get(
  '/tickets',
  allow(...READ),
  ah(async (req, res) => res.json(await Ticket.find({ businessId: req.business!._id }).sort({ updatedAt: -1 }).limit(100).lean()))
);

supportRouter.post(
  '/tickets',
  allow(...READ),
  ah(async (req, res) => {
    const body = z
      .object({
        subject: z.string().min(5).max(160),
        message: z.string().min(5).max(4000),
        category: z.enum(['E_INVOICE', 'EWAY_BILL', 'GSTR_FILING', 'SUBSCRIPTION', 'APP_BUG', 'PRINTING', 'ACCOUNT']),
        channel: z.enum(['WHATSAPP', 'IN_APP', 'EMAIL', 'CALL']).default('IN_APP')
      })
      .parse(req.body);
    const urgent = body.category === 'E_INVOICE' || body.category === 'EWAY_BILL';
    const t = await Ticket.create({
      ticketNo: await platformNumber('TICKET', 'MI-TKT-'),
      businessId: req.business!._id,
      businessName: req.business!.tradeName || req.business!.name,
      phone: req.user!.phone,
      subject: body.subject,
      category: body.category,
      channel: body.channel,
      priority: urgent ? 'HIGH' : 'MEDIUM',
      messages: [{ from: 'MERCHANT', author: req.user!.name || req.user!.phone, text: body.message }]
    });
    res.status(201).json(t);
  })
);

supportRouter.post(
  '/tickets/:id/messages',
  allow(...READ),
  ah(async (req, res) => {
    const { text } = z.object({ text: z.string().min(1).max(4000) }).parse(req.body);
    const t = await Ticket.findOne({ _id: req.params.id, businessId: req.business!._id });
    if (!t) throw notFound('Ticket');
    t.messages.push({ from: 'MERCHANT', author: req.user!.name || req.user!.phone, text, at: new Date() });
    if (t.status === 'WAITING_ON_MERCHANT' || t.status === 'RESOLVED') t.status = 'OPEN';
    await t.save();
    res.json(t);
  })
);

// ---------- merchant: plans & checkout ----------

supportRouter.get('/plans', ah(async (_req, res) => res.json(await Plan.find({ isActive: true }).sort({ priceYearly: 1 }).lean())));

supportRouter.post(
  '/billing/quote',
  allow(...MANAGE),
  ah(async (req, res) => {
    const b = z.object({ planId: z.enum(['silver', 'gold', 'platinum']), cycle: z.enum(['1Y', '2Y', '3Y', 'LIFETIME']), couponCode: z.string().optional() }).parse(req.body);
    res.json(await quote(b.planId, b.cycle, b.couponCode));
  })
);


