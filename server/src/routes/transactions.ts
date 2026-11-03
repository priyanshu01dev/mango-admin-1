import { Router } from 'express';
import { z } from 'zod';
import { ah, badRequest, notFound } from '../lib/errors';
import { DOC_TYPES, Expense, Invoice, Payment, TradeDocument } from '../models/billing';
import { allow, assertRole, BOOKS, MANAGE, READ, SELL } from '../middleware/auth';
import { cancelInvoice, createInvoice, recordPayment } from '../services/invoices';
import { cancelDocument, convertPoToBill, convertToInvoice, createDocument, PURCHASE_TYPES } from '../services/documents';
import { cancelIrn, generateEWayBill, generateIrn, prevalidateEInvoice } from '../services/gsp';
import { audit, nextNumber } from '../services/common';
import { inTransaction } from '../db';
import { isoDate, todayIST } from '../lib/dates';
import { isValidGstin, r2 } from '../../../shared/gst';
import type { InvoiceDoc } from '../models/billing';

export const txRouter = Router();

const MODES = ['CASH', 'UPI', 'NEFT_RTGS', 'CHEQUE', 'CARD'] as const;
const line = z.object({
  productId: z.string().optional(),
  name: z.string().max(160).optional(),
  hsnCode: z.string().max(8).optional(),
  unit: z.string().max(10).optional(),
  quantity: z.number().positive(),
  price: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  gstRate: z.number().min(0).max(28).optional(),
  priceIncludesTax: z.boolean().optional()
});
const date = z.string().regex(isoDate, 'Use YYYY-MM-DD');
const listParams = (q: Record<string, unknown>) => ({ limit: Math.min(200, Number(q.limit ?? 50)), skip: Math.max(0, Number(q.skip ?? 0)) });
const range = (q: Record<string, unknown>) => (q.from || q.to ? { date: { ...(q.from ? { $gte: String(q.from) } : {}), ...(q.to ? { $lte: String(q.to) } : {}) } } : {});
const reasonBody = z.object({ reason: z.string().min(3).max(200) });

// ---------------- invoices ----------------

txRouter.get(
  '/invoices',
  allow(...READ),
  ah(async (req, res) => {
    const { limit, skip } = listParams(req.query);
    const filter: Record<string, unknown> = { businessId: req.business!._id, ...range(req.query) };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.partyId) filter.partyId = req.query.partyId;
    const [items, total] = await Promise.all([Invoice.find(filter).sort({ date: -1, number: -1 }).skip(skip).limit(limit).lean(), Invoice.countDocuments(filter)]);
    res.json({ items, total });
  })
);

txRouter.get(
  '/invoices/:id',
  allow(...READ),
  ah(async (req, res) => {
    const inv = await Invoice.findOne({ _id: req.params.id, businessId: req.business!._id }).lean();
    if (!inv) throw notFound('Invoice');
    res.json(inv);
  })
);

txRouter.post(
  '/invoices',
  allow(...SELL),
  ah(async (req, res) => {
    const body = z
      .object({
        partyId: z.string().optional(),
        walkIn: z.object({ name: z.string().min(1), phone: z.string().optional(), address: z.string().optional(), stateCode: z.string().regex(/^\d{2}$/), gstin: z.string().optional() }).optional(),
        date: date.optional(),
        dueDate: date.optional(),
        number: z.string().max(16).optional(),
        items: z.array(line).min(1).max(200),
        amountPaid: z.number().min(0).optional(),
        paymentMode: z.enum(MODES).optional(),
        paymentReference: z.string().max(60).optional(),
        reverseCharge: z.boolean().optional(),
        notes: z.string().max(1000).optional(),
        supplyType: z.enum(['REGULAR', 'EXPORT_WPAY', 'EXPORT_WOPAY', 'SEZ_WPAY', 'SEZ_WOPAY', 'DEEMED_EXPORT']).optional(),
        exportDetails: z
          .object({ currency: z.string().length(3).optional(), exchangeRate: z.number().positive().optional(), portCode: z.string().max(6).optional(), shippingBillNo: z.string().max(20).optional(), shippingBillDate: date.or(z.literal('')).optional(), lutNumber: z.string().max(30).optional() })
          .optional(),
        billDiscount: z.number().min(0).optional(),
        charges: z.array(z.object({ label: z.string().min(1).max(40), amount: z.number().min(0), gstRate: z.number().min(0).max(28).optional() })).max(5).optional(),
        tcsRate: z.number().min(0).max(5).optional(),
        shippingAddress: z.string().max(300).optional(),
        poNumber: z.string().max(40).optional(),
        poDate: date.optional(),
        transport: z
          .object({ mode: z.enum(['ROAD', 'RAIL', 'AIR', 'SHIP', '']).optional(), vehicleNumber: z.string().max(12).optional(), transporterName: z.string().max(80).optional(), lrNumber: z.string().max(30).optional(), lrDate: date.or(z.literal('')).optional() })
          .optional()
      })
      .parse(req.body);
    res.status(201).json(await createInvoice(req, body));
  })
);

txRouter.post('/invoices/:id/cancel', allow(...MANAGE), ah(async (req, res) => res.json(await cancelInvoice(req, req.params.id, reasonBody.parse(req.body).reason))));

txRouter.get(
  '/invoices/:id/einvoice/validate',
  allow(...SELL),
  ah(async (req, res) => {
    const inv = await Invoice.findOne({ _id: req.params.id, businessId: req.business!._id }).lean<InvoiceDoc>();
    if (!inv) throw notFound('Invoice');
    const issues = await prevalidateEInvoice(inv, req.business!);
    res.json({ ok: !issues.some(i => i.severity === 'ERROR'), issues });
  })
);
txRouter.post('/invoices/:id/einvoice', allow(...SELL), ah(async (req, res) => res.json(await generateIrn(req, req.params.id))));
txRouter.post('/invoices/:id/einvoice/cancel', allow(...MANAGE), ah(async (req, res) => res.json(await cancelIrn(req, req.params.id, reasonBody.parse(req.body).reason))));
txRouter.post(
  '/invoices/:id/ewaybill',
  allow(...SELL),
  ah(async (req, res) => {
    const body = z.object({ vehicleNumber: z.string().max(12).optional(), transporterId: z.string().max(15).optional(), distanceKm: z.number().int() }).parse(req.body);
    res.json(await generateEWayBill(req, req.params.id, body));
  })
);

// ---------------- other documents ----------------

txRouter.get(
  '/documents',
  allow(...READ),
  ah(async (req, res) => {
    const { limit, skip } = listParams(req.query);
    // ?type=PROFORMA or ?type=PROFORMA,SALES_ORDER
    const types = z.array(z.enum(DOC_TYPES)).min(1).parse(String(req.query.type ?? '').split(',').filter(Boolean));
    const filter: Record<string, unknown> = { businessId: req.business!._id, docType: { $in: types }, ...range(req.query) };
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([TradeDocument.find(filter).sort({ date: -1, number: -1 }).skip(skip).limit(limit).lean(), TradeDocument.countDocuments(filter)]);
    res.json({ items, total });
  })
);

txRouter.post(
  '/documents',
  ah(async (req, res) => {
    const body = z
      .object({
        docType: z.enum(DOC_TYPES),
        partyId: z.string(),
        date: date.optional(),
        dueDate: date.optional(),
        items: z.array(line).min(1).max(200),
        reference: z.string().max(40).optional(),
        reason: z.string().max(200).optional(),
        restock: z.boolean().optional(),
        itcEligible: z.boolean().optional(),
        vehicleNumber: z.string().max(12).optional(),
        notes: z.string().max(1000).optional(),
        amountPaid: z.number().min(0).optional(),
        paymentMode: z.enum(MODES).optional()
      })
      .parse(req.body);
    // purchases and notes affect the books: owner/admin only; salesmen may raise sales documents
    assertRole(req, PURCHASE_TYPES.includes(body.docType) || body.docType === 'CREDIT_NOTE' ? MANAGE : SELL);
    res.status(201).json(await createDocument(req, body));
  })
);

txRouter.post('/documents/:id/cancel', allow(...MANAGE), ah(async (req, res) => res.json(await cancelDocument(req, req.params.id, reasonBody.parse(req.body).reason))));
txRouter.post('/documents/:id/convert', allow(...SELL), ah(async (req, res) => res.status(201).json(await convertToInvoice(req, req.params.id))));
txRouter.post(
  '/documents/:id/receive',
  allow(...MANAGE),
  ah(async (req, res) => res.status(201).json(await convertPoToBill(req, req.params.id, z.object({ supplierBillNo: z.string().min(1).max(40) }).parse(req.body).supplierBillNo)))
);
txRouter.post(
  '/documents/:id/delivered',
  allow(...SELL),
  ah(async (req, res) => {
    const d = await TradeDocument.findOneAndUpdate({ _id: req.params.id, businessId: req.business!._id, docType: 'SALES_ORDER', status: 'OPEN' }, { status: 'DELIVERED' }, { new: true });
    if (!d) throw notFound('Open sales order');
    res.json(d);
  })
);

// ---------------- payments ----------------

txRouter.get(
  '/payments',
  allow(...READ),
  ah(async (req, res) => {
    const { limit, skip } = listParams(req.query);
    const filter: Record<string, unknown> = { businessId: req.business!._id, ...range(req.query) };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.partyId) filter.partyId = req.query.partyId;
    const [items, total] = await Promise.all([Payment.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(), Payment.countDocuments(filter)]);
    res.json({ items, total });
  })
);

txRouter.post(
  '/payments',
  ah(async (req, res) => {
    const body = z
      .object({ type: z.enum(['PAYMENT_IN', 'PAYMENT_OUT']), partyId: z.string(), invoiceId: z.string().optional(), billId: z.string().optional(), amount: z.number().positive(), tdsAmount: z.number().min(0).optional(), date: date.optional(), mode: z.enum(MODES), reference: z.string().max(60).optional(), notes: z.string().max(300).optional() })
      .parse(req.body);
    assertRole(req, body.type === 'PAYMENT_OUT' ? MANAGE : SELL);
    res.status(201).json(await recordPayment(req, body));
  })
);

// ---------------- expenses ----------------

txRouter.get(
  '/expenses',
  allow(...BOOKS),
  ah(async (req, res) => {
    const { limit, skip } = listParams(req.query);
    const filter: Record<string, unknown> = { businessId: req.business!._id, ...range(req.query) };
    if (req.query.category) filter.category = req.query.category;
    const [items, total] = await Promise.all([Expense.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(), Expense.countDocuments(filter)]);
    res.json({ items, total });
  })
);

txRouter.post(
  '/expenses',
  allow(...MANAGE),
  ah(async (req, res) => {
    const body = z
      .object({
        date: date.optional(),
        category: z.string().min(2).max(60),
        vendorName: z.string().min(1).max(120),
        vendorGstin: z.string().max(15).optional(),
        description: z.string().max(300).optional(),
        amount: z.number().positive(),
        gstRate: z.number().min(0).max(28).default(0),
        mode: z.enum(MODES).default('UPI'),
        itcEligible: z.boolean().default(false),
        reference: z.string().max(60).optional()
      })
      .parse(req.body);
    if (body.vendorGstin && !isValidGstin(body.vendorGstin)) throw badRequest('Vendor GSTIN is not valid');
    const gstAmount = r2((body.amount * body.gstRate) / 100);
    // ITC needs a registered vendor and GST actually charged
    const itcEligible = body.itcEligible && !!body.vendorGstin && gstAmount > 0;
    const d = body.date ?? todayIST();
    const exp = await inTransaction(async session => {
      const prefix = (req.business!.invoiceSettings?.docPrefixes as Record<string, string> | undefined)?.EXPENSE ?? 'EXP/{FY}/';
      const number = await nextNumber(req.business!, 'EXPENSE', prefix, d, session);
      const [e] = await Expense.create([{ ...body, date: d, number, gstAmount, total: r2(body.amount + gstAmount), itcEligible, businessId: req.business!._id, createdBy: req.user!._id }], { session });
      return e;
    });
    await audit(req, 'EXPENSE_ADD', `${exp.number} ${exp.category} ₹${exp.total}`);
    res.status(201).json(exp);
  })
);

txRouter.delete(
  '/expenses/:id',
  allow(...MANAGE),
  ah(async (req, res) => {
    const e = await Expense.findOneAndDelete({ _id: req.params.id, businessId: req.business!._id });
    if (!e) throw notFound('Expense');
    await audit(req, 'EXPENSE_DELETE', `${e.number} ₹${e.total}`, 'WARNING');
    res.json({ ok: true });
  })
);
