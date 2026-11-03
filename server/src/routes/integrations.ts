import { Router, type Request } from 'express';
import { z } from 'zod';
import { ah, badRequest, conflict, HttpError, notFound } from '../lib/errors';
import { allow, BOOKS, MANAGE, SELL } from '../middleware/auth';
import { Invoice, InvoiceDoc, Party } from '../models/billing';
import { Business, BusinessDoc, User, UserDoc } from '../models/core';
import { config } from '../config';
import { quote } from './support';
import { createOrder, createPaymentLink, PaymentOrder, verifyCheckoutSignature, verifyWebhookSignature } from '../services/razorpay';
import { activateSubscription } from '../services/subscriptions';
import { recordPayment } from '../services/invoices';
import { audit } from '../services/common';
import { prevalidateEInvoice, prevalidateEWayBill } from '../services/gsp';
import { eInvoicePayload, eWayBillPayload } from '../services/nic';
import { emailLayout, escapeHtml, sendEmail, sendSms, sendWhatsAppTemplate } from '../services/notify';
import { buildCaReport } from '../services/workers';

/** Phase 3 (spec §8.6–8.9, §9): payments, messaging, e-invoice/e-way bill JSON. */
export const integrationsRouter = Router();
export const webhookRouter = Router();

const money = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------------- subscription checkout (Razorpay) ----------------

integrationsRouter.post(
  '/billing/checkout',
  allow(...MANAGE),
  ah(async (req, res) => {
    const b = z.object({ planId: z.enum(['silver', 'gold', 'platinum']), cycle: z.enum(['1Y', '2Y', '3Y', 'LIFETIME']), couponCode: z.string().optional() }).parse(req.body);
    const q = await quote(b.planId, b.cycle, b.couponCode);
    const biz = req.business!;
    const order = await createOrder(q.totalAmount, `sub-${String(biz._id).slice(-8)}-${Date.now()}`, { businessId: String(biz._id), planId: b.planId, cycle: b.cycle });
    await PaymentOrder.create({ businessId: biz._id, purpose: 'SUBSCRIPTION', gatewayId: order.id, amount: q.totalAmount, payload: b, createdBy: req.user!._id });
    res.json({ keyId: config.RAZORPAY_KEY_ID, orderId: order.id, amount: order.amount, currency: 'INR', quote: q, name: 'Mango Invoice', description: `${q.planName} plan (${b.cycle})`, prefill: { name: req.user!.name, contact: req.user!.phone, email: req.user!.email } });
  })
);

/** Called by the web/app after Razorpay Checkout succeeds; the webhook is the backup path. */
integrationsRouter.post(
  '/billing/checkout/verify',
  allow(...MANAGE),
  ah(async (req, res) => {
    const b = z.object({ orderId: z.string(), paymentId: z.string(), signature: z.string() }).parse(req.body);
    if (!verifyCheckoutSignature(b.orderId, b.paymentId, b.signature)) throw badRequest('Payment signature is not valid');
    const po = await PaymentOrder.findOne({ gatewayId: b.orderId, businessId: req.business!._id, purpose: 'SUBSCRIPTION' });
    if (!po) throw notFound('Order');
    const sub = await activateSubscription(req, String(po.businessId), { ...(po.payload as { planId: 'gold'; cycle: '1Y'; couponCode?: string }), gateway: 'RAZORPAY', gatewayRef: b.paymentId });
    po.status = 'PAID';
    po.paymentId = b.paymentId;
    await po.save();
    res.json(sub);
  })
);

// ---------------- invoice payment link ----------------

integrationsRouter.post(
  '/invoices/:id/payment-link',
  allow(...SELL),
  ah(async (req, res) => {
    const inv = await Invoice.findOne({ _id: req.params.id, businessId: req.business!._id }).lean<InvoiceDoc>();
    if (!inv) throw notFound('Invoice');
    if (inv.status === 'CANCELLED' || inv.balanceDue <= 0) throw conflict('Nothing is due on this invoice');
    const existing = await PaymentOrder.findOne({ purpose: 'INVOICE', 'payload.invoiceId': String(inv._id), status: 'CREATED', amount: inv.balanceDue }).lean();
    if (existing?.shortUrl) return res.json({ url: existing.shortUrl, reused: true });
    const link = await createPaymentLink({
      amount: inv.balanceDue,
      description: `Invoice ${inv.number} from ${req.business!.tradeName || req.business!.name}`,
      referenceId: `${inv.number}-${Date.now().toString(36)}`,
      customer: { name: inv.partyName, contact: inv.partyPhone || undefined },
      notes: { businessId: String(req.business!._id), invoiceId: String(inv._id), invoiceNo: inv.number }
    });
    await PaymentOrder.create({ businessId: req.business!._id, purpose: 'INVOICE', gatewayId: link.id, amount: inv.balanceDue, payload: { invoiceId: String(inv._id), partyId: String(inv.partyId ?? '') }, shortUrl: link.short_url, createdBy: req.user!._id });
    await audit(req, 'PAYMENT_LINK', `${inv.number} · ${money(inv.balanceDue)} · ${link.id}`);
    res.json({ url: link.short_url });
  })
);

// ---------------- email / reminders ----------------

async function shareUrl(inv: InvoiceDoc) {
  const token = (inv as { publicToken?: string }).publicToken ?? (await import('node:crypto')).randomBytes(18).toString('base64url');
  if (!(inv as { publicToken?: string }).publicToken) await Invoice.updateOne({ _id: inv._id }, { publicToken: token });
  return `${config.APP_URL.replace(/\/$/, '')}/i/${token}`;
}

integrationsRouter.post(
  '/invoices/:id/email',
  allow(...SELL),
  ah(async (req, res) => {
    const { to } = z.object({ to: z.string().email() }).parse(req.body);
    const inv = await Invoice.findOne({ _id: req.params.id, businessId: req.business!._id }).lean<InvoiceDoc>();
    if (!inv) throw notFound('Invoice');
    const url = await shareUrl(inv);
    const biz = req.business!;
    await sendEmail({
      to,
      subject: `Invoice ${inv.number} from ${biz.tradeName || biz.name} · ${money(inv.grandTotal)}`,
      html: emailLayout(`Invoice ${inv.number}`, `<p>Dear ${escapeHtml(inv.partyName)},</p><p>Please find invoice <b>${escapeHtml(inv.number)}</b> dated ${inv.date} for <b>${money(inv.grandTotal)}</b>${inv.balanceDue > 0 ? `, balance due <b>${money(inv.balanceDue)}</b> by ${inv.dueDate}` : ''}.</p><p><a href="${url}" style="background:#f7781b;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700">View & pay invoice</a></p><p>Regards,<br/>${escapeHtml(biz.name)}</p>`)
    });
    await audit(req, 'INVOICE_EMAIL', `${inv.number} → ${to}`);
    res.json({ ok: true });
  })
);

/** Sends one payment reminder now on the chosen channel. */
integrationsRouter.post(
  '/invoices/:id/remind',
  allow(...SELL),
  ah(async (req, res) => {
    const { channel, email } = z.object({ channel: z.enum(['WHATSAPP', 'SMS', 'EMAIL']), email: z.string().email().optional() }).parse(req.body);
    const inv = await Invoice.findOne({ _id: req.params.id, businessId: req.business!._id }).lean<InvoiceDoc>();
    if (!inv) throw notFound('Invoice');
    if (inv.balanceDue <= 0) throw conflict('Nothing is due on this invoice');
    await sendReminder(req.business!, inv, channel, email);
    await audit(req, 'PAYMENT_REMINDER', `${inv.number} via ${channel}`);
    res.json({ ok: true });
  })
);

export async function sendReminder(biz: BusinessDoc, inv: InvoiceDoc, channel: 'WHATSAPP' | 'SMS' | 'EMAIL', email?: string) {
  const url = await shareUrl(inv);
  const name = biz.tradeName || biz.name;
  if (channel === 'WHATSAPP') {
    if (!inv.partyPhone) throw badRequest('Customer has no mobile number');
    await sendWhatsAppTemplate(inv.partyPhone, config.WHATSAPP_REMINDER_TEMPLATE, [inv.partyName, money(inv.balanceDue), inv.number, inv.dueDate ?? '', name, url]);
  } else if (channel === 'SMS') {
    if (!inv.partyPhone) throw badRequest('Customer has no mobile number');
    await sendSms(inv.partyPhone, config.MSG91_REMINDER_TEMPLATE_ID, { name: inv.partyName, amount: money(inv.balanceDue), invoice: inv.number, link: url, business: name });
  } else {
    const party = inv.partyId ? await Party.findById(inv.partyId).lean() : null;
    const to = email || party?.email;
    if (!to) throw badRequest('Customer has no email address');
    await sendEmail({
      to,
      subject: `Payment reminder: ${inv.number} · ${money(inv.balanceDue)} due`,
      html: emailLayout('Payment reminder', `<p>Dear ${escapeHtml(inv.partyName)},</p><p>This is a reminder that <b>${money(inv.balanceDue)}</b> is due on invoice <b>${escapeHtml(inv.number)}</b> (due ${inv.dueDate}).</p><p><a href="${url}">View & pay online</a></p><p>Regards,<br/>${escapeHtml(name)}</p>`)
    });
  }
  await Invoice.updateOne({ _id: inv._id }, { $push: { remindersSent: { channel, at: new Date() } } });
}

// ---------------- e-invoice / e-way bill JSON (no GSP needed) ----------------

integrationsRouter.get(
  '/invoices/:id/einvoice/json',
  allow(...SELL),
  ah(async (req, res) => {
    const inv = await Invoice.findOne({ _id: req.params.id, businessId: req.business!._id }).lean<InvoiceDoc>();
    if (!inv) throw notFound('Invoice');
    const checks = (await prevalidateEInvoice(inv, req.business!)).filter(i => i.severity === 'ERROR');
    const { payload, issues } = eInvoicePayload(inv, req.business!);
    const all = [...checks.map(c => ({ field: c.field, message: c.message })), ...issues];
    if (all.length) throw new HttpError(422, 'Fix these before generating the e-invoice JSON', 'PREVALIDATION_FAILED', all.map(i => ({ ...i, severity: 'ERROR' })));
    res.json([payload]); // the IRP bulk tool takes an array
  })
);

/** Records an IRN obtained from the IRP portal / bulk tool (a real IRN, not mock). */
integrationsRouter.post(
  '/invoices/:id/einvoice/manual',
  allow(...MANAGE),
  ah(async (req, res) => {
    const b = z.object({ irn: z.string().regex(/^[a-f0-9]{64}$/i, 'IRN is 64 hexadecimal characters'), ackNo: z.string().regex(/^\d{12,20}$/, 'Ack no. is 12–20 digits'), ackDate: z.string().min(8), signedQr: z.string().max(5000).optional() }).parse(req.body);
    const inv = await Invoice.findOneAndUpdate(
      { _id: req.params.id, businessId: req.business!._id, 'eInvoice.status': { $ne: 'GENERATED' } },
      { eInvoice: { status: 'GENERATED', irn: b.irn.toLowerCase(), ackNo: b.ackNo, ackDate: b.ackDate, signedQr: b.signedQr ?? '', mock: false } },
      { new: true }
    );
    if (!inv) throw conflict('Invoice not found or IRN already recorded');
    await audit(req, 'EINVOICE_MANUAL', `${inv.number} · IRN ${b.irn.slice(0, 12)}… · Ack ${b.ackNo}`);
    res.json(inv);
  })
);

integrationsRouter.get(
  '/invoices/:id/ewaybill/json',
  allow(...SELL),
  ah(async (req, res) => {
    const q = z.object({ distanceKm: z.coerce.number().int(), vehicleNumber: z.string().optional(), transporterId: z.string().optional(), transporterName: z.string().optional() }).parse(req.query);
    const inv = await Invoice.findOne({ _id: req.params.id, businessId: req.business!._id }).lean<InvoiceDoc>();
    if (!inv) throw notFound('Invoice');
    const checks = (await prevalidateEWayBill(inv, req.business!, q)).filter(i => i.severity === 'ERROR');
    const { payload, issues } = eWayBillPayload(inv, req.business!, q);
    const all = [...checks.map(c => ({ field: c.field, message: c.message })), ...issues];
    if (all.length) throw new HttpError(422, 'Fix these before generating the e-way bill JSON', 'PREVALIDATION_FAILED', all.map(i => ({ ...i, severity: 'ERROR' })));
    res.json(payload);
  })
);

integrationsRouter.post(
  '/invoices/:id/ewaybill/manual',
  allow(...MANAGE),
  ah(async (req, res) => {
    const b = z.object({ number: z.string().regex(/^\d{12}$/, 'E-way bill number is 12 digits'), validUpto: z.string().min(8), vehicleNumber: z.string().optional() }).parse(req.body);
    const inv = await Invoice.findOneAndUpdate(
      { _id: req.params.id, businessId: req.business!._id, 'eWayBill.status': { $ne: 'GENERATED' } },
      { eWayBill: { status: 'GENERATED', number: b.number, validUpto: b.validUpto, vehicleNumber: b.vehicleNumber ?? '', mock: false } },
      { new: true }
    );
    if (!inv) throw conflict('Invoice not found or e-way bill already recorded');
    await audit(req, 'EWAY_MANUAL', `${inv.number} · EWB ${b.number}`);
    res.json(inv);
  })
);

// ---------------- CA report email ----------------

integrationsRouter.post(
  '/reports/email-ca',
  allow(...BOOKS),
  ah(async (req, res) => {
    const b = z.object({ to: z.string().email().optional(), period: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(req.body);
    const to = b.to || (req.business as { caEmail?: string }).caEmail;
    if (!to) throw badRequest("Add your CA's email in Store Profile or enter it here");
    const r = await buildCaReport(req.business!, b.period);
    await sendEmail({ to, subject: r.subject, html: r.html, attachments: r.attachments });
    await audit(req, 'CA_REPORT_EMAIL', `${r.period} → ${to}`);
    res.json({ ok: true, period: r.period });
  })
);

// ---------------- Razorpay webhook (public, signature-verified) ----------------

type RawReq = Request & { rawBody?: Buffer };

async function asOwner(businessId: unknown) {
  const business = await Business.findById(businessId).lean<BusinessDoc>();
  if (!business) return null;
  const user = await User.findById(business.ownerId).lean<UserDoc>();
  return { business, user: { ...user, name: 'Razorpay' }, ip: 'razorpay-webhook', role: 'OWNER' } as unknown as Request;
}

const MODE: Record<string, 'UPI' | 'CARD' | 'NEFT_RTGS'> = { upi: 'UPI', card: 'CARD', netbanking: 'NEFT_RTGS', wallet: 'UPI', emi: 'CARD' };

webhookRouter.post(
  '/razorpay',
  ah(async (req, res) => {
    const raw = (req as RawReq).rawBody ?? Buffer.from(JSON.stringify(req.body));
    if (!verifyWebhookSignature(raw, String(req.headers['x-razorpay-signature'] ?? ''))) throw new HttpError(401, 'Bad signature', 'BAD_SIGNATURE');
    const event = String(req.body?.event ?? '');
    const payment = req.body?.payload?.payment?.entity as { id: string; order_id?: string; method?: string; amount?: number } | undefined;

    if (event === 'payment_link.paid') {
      const linkId = req.body?.payload?.payment_link?.entity?.id as string;
      const po = await PaymentOrder.findOneAndUpdate({ gatewayId: linkId, status: 'CREATED' }, { status: 'PAID', paymentId: payment?.id ?? '' }, { new: true });
      if (po) {
        const fake = await asOwner(po.businessId);
        const { invoiceId, partyId } = po.payload as { invoiceId: string; partyId: string };
        if (fake && partyId) {
          await recordPayment(fake, { type: 'PAYMENT_IN', partyId, invoiceId, amount: po.amount, mode: MODE[payment?.method ?? ''] ?? 'UPI', reference: payment?.id ?? linkId, notes: 'Paid online via Razorpay payment link' }).catch(async e => {
            await PaymentOrder.updateOne({ _id: po._id }, { status: 'FAILED', 'payload.error': (e as Error).message });
          });
        }
      }
    } else if ((event === 'order.paid' || event === 'payment.captured') && payment?.order_id) {
      const po = await PaymentOrder.findOne({ gatewayId: payment.order_id, purpose: 'SUBSCRIPTION' });
      if (po && po.status !== 'PAID') {
        const fake = await asOwner(po.businessId);
        await activateSubscription(fake, String(po.businessId), { ...(po.payload as { planId: 'gold'; cycle: '1Y'; couponCode?: string }), gateway: 'RAZORPAY', gatewayRef: payment.id });
        po.status = 'PAID';
        po.paymentId = payment.id;
        await po.save();
      }
    }
    res.json({ ok: true });
  })
);

