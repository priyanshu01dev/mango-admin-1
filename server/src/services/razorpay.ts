import crypto from 'node:crypto';
import mongoose, { Schema } from 'mongoose';
import { config } from '../config';
import { HttpError } from '../lib/errors';

/** Razorpay REST API (orders + payment links) and signature checks. */

const { ObjectId } = Schema.Types;

/** One Razorpay order or payment link we created, so webhooks can be matched and applied once. */
const paymentOrderSchema = new Schema(
  {
    businessId: { type: ObjectId, ref: 'Business', required: true, index: true },
    purpose: { type: String, enum: ['SUBSCRIPTION', 'INVOICE'], required: true },
    gatewayId: { type: String, required: true, unique: true }, // order_xxx or plink_xxx
    amount: { type: Number, required: true }, // ₹
    status: { type: String, enum: ['CREATED', 'PAID', 'FAILED'], default: 'CREATED' },
    payload: { type: Schema.Types.Mixed, default: {} }, // plan/cycle/coupon or invoiceId
    paymentId: { type: String, default: '' },
    shortUrl: { type: String, default: '' },
    createdBy: { type: ObjectId, ref: 'User' }
  },
  { timestamps: true, versionKey: false }
);
export const PaymentOrder = mongoose.model('PaymentOrder', paymentOrderSchema);

export const razorpayConfigured = () => !!(config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET);

async function rzp<T>(path: string, body: unknown): Promise<T> {
  if (!razorpayConfigured()) throw new HttpError(503, 'Online payments (Razorpay) are not configured yet', 'PAYMENTS_NOT_CONFIGURED');
  const auth = Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new HttpError(502, `Razorpay: ${data.error?.description ?? res.status}`, 'RAZORPAY_FAILED');
  return data;
}

const paise = (rupees: number) => Math.round(rupees * 100);

export function createOrder(amount: number, receipt: string, notes: Record<string, string>) {
  return rzp<{ id: string; amount: number; currency: string }>('orders', { amount: paise(amount), currency: 'INR', receipt: receipt.slice(0, 40), notes });
}

export function createPaymentLink(input: { amount: number; description: string; referenceId: string; customer: { name: string; contact?: string; email?: string }; notes: Record<string, string>; expireBy?: number }) {
  return rzp<{ id: string; short_url: string }>('payment_links', {
    amount: paise(input.amount),
    currency: 'INR',
    accept_partial: false,
    description: input.description.slice(0, 2048),
    reference_id: input.referenceId.slice(0, 40),
    customer: { name: input.customer.name, ...(input.customer.contact ? { contact: input.customer.contact } : {}), ...(input.customer.email ? { email: input.customer.email } : {}) },
    notify: { sms: !!input.customer.contact, email: !!input.customer.email },
    reminder_enable: true,
    notes: input.notes,
    ...(input.expireBy ? { expire_by: input.expireBy } : {})
  });
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Checkout success handler signature: HMAC-SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  if (!config.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto.createHmac('sha256', config.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC-SHA256(raw body, webhook secret) in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string) {
  if (!config.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
