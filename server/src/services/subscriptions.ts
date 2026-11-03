import type { Request } from 'express';
import { Business } from '../models/core';
import { config } from '../config';
import { Coupon, Subscription } from '../models/platform';
import { notFound } from '../lib/errors';
import { todayIST } from '../lib/dates';
import { fyLabel } from '../../../shared/gst';
import { audit } from './common';
import { platformNumber, quote } from '../routes/support';

/**
 * Activates a paid plan for a business and issues the platform's GST invoice for it.
 * Used by manual activation (admin), Razorpay checkout and Razorpay webhooks.
 */
export async function activateSubscription(
  req: Request | null,
  businessId: string,
  input: { planId: 'silver' | 'gold' | 'platinum'; cycle: '1Y' | '2Y' | '3Y' | 'LIFETIME'; couponCode?: string; gateway: 'RAZORPAY' | 'PLAY_BILLING' | 'MANUAL'; gatewayRef?: string }
) {
  const b = await Business.findById(businessId);
  if (!b) throw notFound('Business');
  // a gateway payment is applied once, even if both the checkout callback and the webhook arrive
  if (input.gatewayRef) {
    const existing = await Subscription.findOne({ gatewayRef: input.gatewayRef }).lean();
    if (existing) return existing;
  }
  const q = await quote(input.planId, input.cycle, input.couponCode);
  const start = todayIST();
  const end = new Date(start + 'T00:00:00Z');
  if (input.cycle === 'LIFETIME') end.setUTCFullYear(2099, 11, 31);
  else end.setUTCFullYear(end.getUTCFullYear() + Number(input.cycle[0]));
  const renewsOn = end.toISOString().slice(0, 10);
  await Subscription.updateMany({ businessId: b._id, status: 'ACTIVE' }, { status: 'CANCELLED', autoRenew: false });
  const sub = await Subscription.create({
    // Rule 46 applies to our own invoices too: MS/26-27/00001 = 14 chars
    invoiceNo: await platformNumber(`SUB_INVOICE:${fyLabel(start)}`, `MS/${fyLabel(start)}/`),
    businessId: b._id,
    businessName: b.name,
    businessGstin: b.gstin,
    sellerName: config.PLATFORM_LEGAL_NAME,
    sellerGstin: config.PLATFORM_GSTIN,
    sellerStateCode: config.PLATFORM_STATE_CODE,
    planId: input.planId,
    cycle: input.cycle,
    baseAmount: q.baseAmount,
    discount: q.discount,
    gstAmount: q.gstAmount,
    totalAmount: q.totalAmount,
    couponCode: q.couponCode,
    gateway: input.gateway,
    gatewayRef: input.gatewayRef,
    status: 'ACTIVE',
    startDate: start,
    renewsOn,
    autoRenew: false,
    createdBy: req?.user?._id
  });
  if (q.couponCode) await Coupon.updateOne({ code: q.couponCode }, { $inc: { redeemed: 1 } });
  b.planId = input.planId;
  b.planCycle = input.cycle;
  b.planValidUntil = renewsOn;
  b.trialPlanId = null;
  b.trialEndsOn = '';
  if (b.status === 'PAST_DUE') b.status = 'ACTIVE';
  await b.save();
  await audit(req, 'PLAN_CHANGE', `${b.name} → ${q.planName} ${input.cycle} · ₹${q.totalAmount} (${sub.invoiceNo}, ${input.gateway})`, 'SUCCESS', b._id);
  return sub.toObject();
}
