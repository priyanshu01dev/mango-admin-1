import { Router } from 'express';
import { z } from 'zod';
import { ah, badRequest, conflict, notFound } from '../lib/errors';
import { Invoice, Party, Payment, Product, StockMovement, TradeDocument } from '../models/billing';
import { allow, MANAGE, READ, SELL } from '../middleware/auth';
import { audit } from '../services/common';
import { allocateBatches, moveStock } from '../services/stock';
import { inTransaction } from '../db';
import { isValidGstin, GST_STATES } from '../../../shared/gst';
import { todayIST } from '../lib/dates';

export const mastersRouter = Router();

const page = (q: Record<string, unknown>) => {
  const limit = Math.min(200, Math.max(1, Number(q.limit ?? 50)));
  const skip = Math.max(0, Number(q.skip ?? 0));
  return { limit, skip };
};
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------- parties ----------------

const partySchema = z.object({
  type: z.enum(['CUSTOMER', 'SUPPLIER']),
  name: z.string().min(1).max(120),
  contactPerson: z.string().max(80).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  gstin: z.string().max(15).optional(),
  pan: z.string().max(10).optional(),
  billingAddress: z.string().max(300).optional(),
  shippingAddress: z.string().max(300).optional(),
  stateCode: z.string().regex(/^\d{2}$/),
  openingBalance: z.number().optional(),
  creditLimit: z.number().min(0).optional(),
  creditDays: z.number().int().min(0).max(365).optional(),
  priceListId: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'BLOCKED']).optional()
});

function checkParty(p: { gstin?: string; stateCode: string }) {
  if (!GST_STATES[p.stateCode]) throw badRequest('Unknown state code');
  if (p.gstin) {
    if (!isValidGstin(p.gstin)) throw badRequest('GSTIN is not valid (format or checksum)');
    if (p.gstin.slice(0, 2).toUpperCase() !== p.stateCode) throw badRequest('State code must match the first two digits of the GSTIN');
  }
}

mastersRouter.get(
  '/parties',
  allow(...READ),
  ah(async (req, res) => {
    const { limit, skip } = page(req.query);
    const filter: Record<string, unknown> = { businessId: req.business!._id };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.q) filter.$or = [{ name: new RegExp(escapeRe(String(req.query.q)), 'i') }, { phone: new RegExp(escapeRe(String(req.query.q))) }, { gstin: new RegExp(escapeRe(String(req.query.q)), 'i') }];
    const [items, total] = await Promise.all([Party.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(), Party.countDocuments(filter)]);
    res.json({ items, total });
  })
);

mastersRouter.post(
  '/parties',
  allow(...SELL),
  ah(async (req, res) => {
    const body = partySchema.parse(req.body);
    checkParty(body);
    const party = await Party.create({ ...body, businessId: req.business!._id, state: GST_STATES[body.stateCode], balance: body.openingBalance ?? 0 });
    await audit(req, 'PARTY_ADD', `${party.type} ${party.name}`);
    res.status(201).json(party);
  })
);

mastersRouter.patch(
  '/parties/:id',
  allow(...MANAGE),
  ah(async (req, res) => {
    // balance and opening balance are changed only through transactions
    const body = partySchema.omit({ openingBalance: true, type: true }).partial().parse(req.body);
    const existing = await Party.findOne({ _id: req.params.id, businessId: req.business!._id }).lean();
    if (!existing) throw notFound('Party');
    checkParty({ gstin: body.gstin ?? existing.gstin ?? '', stateCode: body.stateCode ?? existing.stateCode });
    const party = await Party.findByIdAndUpdate(existing._id, { ...body, ...(body.stateCode ? { state: GST_STATES[body.stateCode] } : {}) }, { new: true });
    res.json(party);
  })
);

/** Party ledger with running balance (spec §8.2). */
mastersRouter.get(
  '/parties/:id/ledger',
  allow(...READ),
  ah(async (req, res) => {
    const party = await Party.findOne({ _id: req.params.id, businessId: req.business!._id }).lean();
    if (!party) throw notFound('Party');
    const b = req.business!._id;
    const [invoices, docs, payments] = await Promise.all([
      Invoice.find({ businessId: b, partyId: party._id }).lean(),
      TradeDocument.find({ businessId: b, partyId: party._id, docType: { $in: ['PURCHASE_BILL', 'CREDIT_NOTE', 'DEBIT_NOTE'] } }).lean(),
      Payment.find({ businessId: b, partyId: party._id }).lean()
    ]);
    type Row = { date: string; type: string; number: string; debit: number; credit: number; note?: string };
    const rows: Row[] = [];
    for (const i of invoices) {
      rows.push({ date: i.date, type: 'Sales invoice', number: i.number, debit: i.grandTotal, credit: 0 });
      if (i.status === 'CANCELLED') rows.push({ date: i.date, type: 'Invoice cancelled', number: i.number, debit: 0, credit: i.grandTotal, note: i.cancelReason ?? '' });
    }
    for (const d of docs) {
      const live = d.status !== 'CANCELLED';
      if (d.docType === 'PURCHASE_BILL') rows.push({ date: d.date, type: 'Purchase bill', number: d.reference || d.number, debit: 0, credit: d.grandTotal });
      if (d.docType === 'CREDIT_NOTE') rows.push({ date: d.date, type: 'Credit note', number: d.number, debit: 0, credit: d.grandTotal });
      if (d.docType === 'DEBIT_NOTE') rows.push({ date: d.date, type: 'Debit note', number: d.number, debit: d.grandTotal, credit: 0 });
      if (!live) {
        const r = rows[rows.length - 1];
        rows.push({ date: d.date, type: `${r.type} cancelled`, number: r.number, debit: r.credit, credit: r.debit });
      }
    }
    for (const p of payments) rows.push({ date: p.date, type: p.type === 'PAYMENT_IN' ? 'Payment received' : 'Payment made', number: p.reference || p.refNumber || '', debit: p.type === 'PAYMENT_OUT' ? p.amount : 0, credit: p.type === 'PAYMENT_IN' ? p.amount : 0 });
    rows.sort((a, b) => a.date.localeCompare(b.date));
    let running = party.openingBalance ?? 0;
    const ledger = rows.map(r => ({ ...r, balance: (running = Math.round((running + r.debit - r.credit) * 100) / 100) }));
    res.json({ party, opening: party.openingBalance ?? 0, rows: ledger, closing: running, stored: party.balance });
  })
);

// ---------------- products ----------------

const productSchema = z.object({
  name: z.string().min(1).max(160),
  sku: z.string().max(40).optional(),
  barcode: z.string().regex(/^[A-Za-z0-9-]{4,30}$/, 'Barcode: 4–30 letters/digits').or(z.literal('')).optional(),
  variantOf: z.string().nullable().optional(),
  attributes: z.record(z.string(), z.string().max(40)).optional(),
  trackBatches: z.boolean().optional(),
  hsnCode: z.string().regex(/^\d{4,8}$/, 'HSN/SAC must be 4–8 digits'),
  category: z.string().max(60).optional(),
  unit: z.string().max(10).optional(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  mrp: z.number().min(0).optional(),
  priceIncludesTax: z.boolean().optional(),
  taxRate: z.union([z.literal(0), z.literal(0.25), z.literal(3), z.literal(5), z.literal(12), z.literal(18), z.literal(28)]),
  cessRate: z.number().min(0).max(300).optional(),
  isService: z.boolean().optional(),
  openingStock: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

mastersRouter.get(
  '/products',
  allow(...READ),
  ah(async (req, res) => {
    const { limit, skip } = page(req.query);
    const filter: Record<string, unknown> = { businessId: req.business!._id };
    if (req.query.q) filter.$or = [{ name: new RegExp(escapeRe(String(req.query.q)), 'i') }, { sku: new RegExp(escapeRe(String(req.query.q)), 'i') }, { hsnCode: new RegExp('^' + escapeRe(String(req.query.q))) }];
    if (req.query.lowStock === 'true') filter.$expr = { $lte: ['$stock', '$minStock'] };
    const [items, total] = await Promise.all([Product.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(), Product.countDocuments(filter)]);
    res.json({ items, total });
  })
);

mastersRouter.post(
  '/products',
  allow(...MANAGE),
  ah(async (req, res) => {
    const { openingStock, ...body } = productSchema.parse(req.body);
    if (body.trackBatches && openingStock) throw badRequest('Batch-tracked items get stock through a purchase bill (or adjustment) with a batch number and expiry');
    if (body.mrp && body.sellingPrice && !body.priceIncludesTax && body.sellingPrice * (1 + body.taxRate / 100) > body.mrp + 0.01) {
      throw badRequest('Selling price including GST is above MRP');
    }
    const product = await inTransaction(async session => {
      const [p] = await Product.create([{ ...body, businessId: req.business!._id, stock: openingStock ?? 0 }], { session });
      if (openingStock) await StockMovement.create([{ businessId: req.business!._id, productId: p._id, quantity: openingStock, reason: 'Opening stock', date: todayIST() }], { session });
      return p;
    });
    await audit(req, 'PRODUCT_ADD', `${product.name} (HSN ${product.hsnCode})`);
    res.status(201).json(product);
  })
);

mastersRouter.patch(
  '/products/:id',
  allow(...MANAGE),
  ah(async (req, res) => {
    // stock changes only through documents or /adjust
    const body = productSchema.omit({ openingStock: true }).partial().parse(req.body);
    const p = await Product.findOneAndUpdate({ _id: req.params.id, businessId: req.business!._id }, body, { new: true });
    if (!p) throw notFound('Product');
    res.json(p);
  })
);

mastersRouter.post(
  '/products/:id/adjust',
  allow(...MANAGE),
  ah(async (req, res) => {
    const { quantity, reason, godownId, batchNo, expiryDate } = z
      .object({
        quantity: z.number().refine(n => n !== 0, 'Quantity cannot be 0'),
        reason: z.string().min(2).max(120),
        godownId: z.string().optional(),
        batchNo: z.string().max(30).optional(),
        expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      })
      .parse(req.body);
    const product = await Product.findOne({ _id: req.params.id, businessId: req.business!._id }).lean();
    if (!product) throw notFound('Product');
    // same path as documents: total, godown, batch and item ledger stay in step
    await inTransaction(async session => {
      const line = { productId: String(product._id), name: product.name, unit: product.unit, quantity: Math.abs(quantity), batchNo, expiryDate } as never;
      if (quantity < 0 && (product as { trackBatches?: boolean }).trackBatches) await allocateBatches(req.business!._id, [line], session);
      await moveStock(req.business!, [line], quantity > 0 ? 1 : -1, { type: 'ADJUSTMENT', id: product._id, number: '', date: todayIST(), reason: `Adjustment: ${reason}`, godownId }, session);
    });
    const p = (await Product.findById(product._id).lean())!;
    await audit(req, 'STOCK_ADJUST', `${p.name} ${quantity > 0 ? '+' : ''}${quantity} · ${reason}`);
    res.json(p);
  })
);

/** Barcode scan → item (POS, spec §8.3 P1). Accepts the barcode or the SKU. */
mastersRouter.get(
  '/products/by-barcode/:code',
  allow(...READ),
  ah(async (req, res) => {
    const code = String(req.params.code).trim();
    const p = await Product.findOne({ businessId: req.business!._id, status: 'ACTIVE', $or: [{ barcode: code }, { sku: code }] }).lean();
    if (!p) throw notFound(`Item with barcode ${code}`);
    res.json(p);
  })
);

/** Item ledger (spec §8.3). */
mastersRouter.get(
  '/products/:id/ledger',
  allow(...READ),
  ah(async (req, res) => {
    const p = await Product.findOne({ _id: req.params.id, businessId: req.business!._id }).lean();
    if (!p) throw notFound('Product');
    const moves = await StockMovement.find({ productId: p._id, businessId: req.business!._id }).sort({ createdAt: 1 }).lean();
    let running = 0;
    res.json({ product: p, rows: moves.map(m => ({ ...m, balance: (running += m.quantity) })) });
  })
);

// ---------------- bulk import (spec §8.2 / §8.3: Excel import) ----------------
// The web app parses the CSV/Excel export and sends rows; every row is validated on its own and
// the response lists which rows failed, so one bad row never blocks the rest.

const MAX_IMPORT = 1000;

mastersRouter.post(
  '/parties/import',
  allow(...MANAGE),
  ah(async (req, res) => {
    const { rows } = z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_IMPORT) }).parse(req.body);
    const errors: { row: number; message: string }[] = [];
    const docs: Record<string, unknown>[] = [];
    rows.forEach((raw, i) => {
      const r = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.trim().toLowerCase().replace(/[^a-z]/g, ''), typeof v === 'string' ? v.trim() : v]));
      const candidate = {
        type: String(r.type ?? 'CUSTOMER').toUpperCase().startsWith('S') ? 'SUPPLIER' : 'CUSTOMER',
        name: String(r.name ?? r.partyname ?? ''),
        phone: r.phone || r.mobile ? String(r.phone ?? r.mobile) : undefined,
        email: r.email ? String(r.email) : undefined,
        gstin: r.gstin ? String(r.gstin).toUpperCase() : undefined,
        billingAddress: r.address || r.billingaddress ? String(r.address ?? r.billingaddress) : undefined,
        stateCode: String(r.statecode ?? (r.gstin ? String(r.gstin).slice(0, 2) : req.business!.stateCode)).padStart(2, '0'),
        openingBalance: r.openingbalance !== undefined && r.openingbalance !== '' ? Number(r.openingbalance) : undefined,
        creditLimit: r.creditlimit !== undefined && r.creditlimit !== '' ? Number(r.creditlimit) : undefined
      };
      const parsed = partySchema.safeParse(candidate);
      if (!parsed.success) return errors.push({ row: i + 2, message: parsed.error.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; ') });
      try {
        checkParty(parsed.data);
      } catch (e) {
        return errors.push({ row: i + 2, message: (e as Error).message });
      }
      docs.push({ ...parsed.data, businessId: req.business!._id, state: GST_STATES[parsed.data.stateCode], balance: parsed.data.openingBalance ?? 0 });
    });
    if (docs.length) await Party.insertMany(docs);
    await audit(req, 'PARTY_IMPORT', `${docs.length} imported, ${errors.length} rejected`);
    res.json({ created: docs.length, errors });
  })
);

mastersRouter.post(
  '/products/import',
  allow(...MANAGE),
  ah(async (req, res) => {
    const { rows } = z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_IMPORT) }).parse(req.body);
    const errors: { row: number; message: string }[] = [];
    const created: string[] = [];
    for (const [i, raw] of rows.entries()) {
      const r = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.trim().toLowerCase().replace(/[^a-z]/g, ''), typeof v === 'string' ? v.trim() : v]));
      const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(String(v).replace(/[₹,\s]/g, '')));
      const parsed = productSchema.safeParse({
        name: String(r.name ?? r.itemname ?? ''),
        sku: r.sku || r.code ? String(r.sku ?? r.code) : undefined,
        hsnCode: String(r.hsn ?? r.hsncode ?? r.hsnsac ?? ''),
        category: r.category ? String(r.category) : undefined,
        unit: r.unit ? String(r.unit).toUpperCase() : undefined,
        purchasePrice: num(r.purchaseprice ?? r.cost),
        sellingPrice: num(r.sellingprice ?? r.saleprice ?? r.price),
        mrp: num(r.mrp),
        taxRate: num(String(r.gst ?? r.gstrate ?? r.taxrate ?? '18').replace('%', '')),
        openingStock: num(r.openingstock ?? r.stock),
        minStock: num(r.minstock ?? r.lowstock)
      });
      if (!parsed.success) {
        errors.push({ row: i + 2, message: parsed.error.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; ') });
        continue;
      }
      const { openingStock, ...body } = parsed.data;
      try {
        await inTransaction(async session => {
          const [p] = await Product.create([{ ...body, businessId: req.business!._id, stock: openingStock ?? 0 }], { session });
          if (openingStock) await StockMovement.create([{ businessId: req.business!._id, productId: p._id, quantity: openingStock, reason: 'Opening stock (import)', date: todayIST() }], { session });
        });
        created.push(body.name);
      } catch (e) {
        errors.push({ row: i + 2, message: (e as { code?: number }).code === 11000 ? `SKU "${body.sku}" already exists` : (e as Error).message });
      }
    }
    await audit(req, 'PRODUCT_IMPORT', `${created.length} imported, ${errors.length} rejected`);
    res.json({ created: created.length, errors });
  })
);
