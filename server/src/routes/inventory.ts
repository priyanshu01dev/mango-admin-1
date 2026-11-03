import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { ah, badRequest, notFound } from '../lib/errors';
import { allow, MANAGE, READ } from '../middleware/auth';
import { Godown, ProductStock, Batch, PriceList } from '../models/inventory';
import { Party, Product, StockMovement } from '../models/billing';
import { inTransaction } from '../db';
import { audit } from '../services/common';
import { changeGodownStock, defaultGodown } from '../services/stock';
import { todayIST } from '../lib/dates';
import { r2 } from '../../../shared/gst';

/** Inventory P1 (spec §8.3): godowns + transfers, batches + expiry, price lists. */
export const inventoryRouter = Router();

// ---------------- godowns ----------------

inventoryRouter.get(
  '/godowns',
  allow(...READ),
  ah(async (req, res) => {
    const b = req.business!._id;
    await defaultGodown(b);
    const godowns = await Godown.find({ businessId: b }).sort({ isDefault: -1, name: 1 }).lean();
    // products without per-godown rows still hold all their stock in the default godown
    const rows = await ProductStock.find({ businessId: b }).lean();
    const products = await Product.find({ businessId: b, isService: { $ne: true } }, { stock: 1, purchasePrice: 1 }).lean();
    const tracked = new Set(rows.map(r => String(r.productId)));
    const value = new Map<string, { items: number; units: number; value: number }>();
    const add = (g: string, units: number, cost: number) => {
      const v = value.get(g) ?? { items: 0, units: 0, value: 0 };
      if (units !== 0) v.items++;
      v.units = r2(v.units + units);
      v.value = r2(v.value + units * cost);
      value.set(g, v);
    };
    const cost = new Map(products.map(p => [String(p._id), p.purchasePrice ?? 0]));
    for (const r of rows) add(String(r.godownId), r.quantity, cost.get(String(r.productId)) ?? 0);
    const def = godowns.find(g => g.isDefault)!;
    for (const p of products) if (!tracked.has(String(p._id))) add(String(def._id), p.stock ?? 0, p.purchasePrice ?? 0);
    res.json(godowns.map(g => ({ ...g, ...(value.get(String(g._id)) ?? { items: 0, units: 0, value: 0 }) })));
  })
);

inventoryRouter.post(
  '/godowns',
  allow(...MANAGE),
  ah(async (req, res) => {
    const body = z.object({ name: z.string().min(2).max(60), address: z.string().max(200).optional() }).parse(req.body);
    await defaultGodown(req.business!._id);
    const g = await Godown.create({ ...body, businessId: req.business!._id });
    await audit(req, 'GODOWN_CREATE', g.name);
    res.status(201).json(g);
  })
);

inventoryRouter.get(
  '/godowns/:id/stock',
  allow(...READ),
  ah(async (req, res) => {
    const g = await Godown.findOne({ _id: req.params.id, businessId: req.business!._id }).lean();
    if (!g) throw notFound('Godown');
    const rows = await ProductStock.find({ godownId: g._id }).populate('productId', 'name sku unit purchasePrice').lean();
    let items = rows.map(r => ({ product: r.productId, quantity: r.quantity }));
    if (g.isDefault) {
      const tracked = new Set((await ProductStock.find({ businessId: req.business!._id }, { productId: 1 }).lean()).map(r => String(r.productId)));
      const untracked = await Product.find({ businessId: req.business!._id, isService: { $ne: true }, _id: { $nin: [...tracked].map(t => new Types.ObjectId(t)) } }, { name: 1, sku: 1, unit: 1, purchasePrice: 1, stock: 1 }).lean();
      items = items.concat(untracked.map(p => ({ product: p as never, quantity: p.stock ?? 0 })));
    }
    res.json({ godown: g, items: items.filter(i => i.quantity !== 0) });
  })
);

/** Stock transfer between godowns: business total does not change. */
inventoryRouter.post(
  '/godowns/transfer',
  allow(...MANAGE),
  ah(async (req, res) => {
    const body = z.object({ productId: z.string(), fromGodownId: z.string(), toGodownId: z.string(), quantity: z.number().positive(), note: z.string().max(200).optional() }).parse(req.body);
    if (body.fromGodownId === body.toGodownId) throw badRequest('Choose two different godowns');
    const b = req.business!._id;
    const [p, from, to] = await Promise.all([
      Product.findOne({ _id: body.productId, businessId: b }).lean(),
      Godown.findOne({ _id: body.fromGodownId, businessId: b }).lean(),
      Godown.findOne({ _id: body.toGodownId, businessId: b }).lean()
    ]);
    if (!p || !from || !to) throw notFound('Item or godown');
    await inTransaction(async session => {
      await changeGodownStock(b, body.productId, from._id, -body.quantity, false, p.name, session);
      await changeGodownStock(b, body.productId, to._id, body.quantity, false, p.name, session);
      const ref = { businessId: b, productId: p._id, reason: `Transfer ${from.name} → ${to.name}${body.note ? ': ' + body.note : ''}`, refType: 'TRANSFER', date: todayIST() };
      await StockMovement.create([{ ...ref, quantity: -body.quantity, godownId: from._id }, { ...ref, quantity: body.quantity, godownId: to._id }], { session, ordered: true });
    });
    await audit(req, 'STOCK_TRANSFER', `${p.name}: ${body.quantity} ${p.unit} ${from.name} → ${to.name}`);
    res.json({ ok: true });
  })
);

// ---------------- batches & expiry ----------------

inventoryRouter.get(
  '/batches',
  allow(...READ),
  ah(async (req, res) => {
    const filter: Record<string, unknown> = { businessId: req.business!._id };
    if (req.query.productId) filter.productId = req.query.productId;
    if (req.query.inStock !== 'false') filter.quantity = { $gt: 0 };
    res.json(await Batch.find(filter).sort({ expiryDate: 1 }).populate('productId', 'name unit').lean());
  })
);

/** Items expiring within N days (default 60), plus already-expired stock still on hand. */
inventoryRouter.get(
  '/batches/expiring',
  allow(...READ),
  ah(async (req, res) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days ?? 60)));
    const limit = todayIST(days);
    const rows = await Batch.find({ businessId: req.business!._id, quantity: { $gt: 0 }, expiryDate: { $gt: '', $lte: limit } }).sort({ expiryDate: 1 }).populate('productId', 'name unit purchasePrice').lean();
    const today = todayIST();
    res.json({ days, rows: rows.map(r => ({ ...r, expired: r.expiryDate < today })) });
  })
);

// ---------------- price lists ----------------

const priceListBody = z.object({ name: z.string().min(2).max(60), items: z.array(z.object({ productId: z.string(), price: z.number().min(0) })).max(2000), active: z.boolean().optional() });

inventoryRouter.get('/price-lists', allow(...READ), ah(async (req, res) => res.json(await PriceList.find({ businessId: req.business!._id }).sort({ name: 1 }).lean())));

inventoryRouter.post(
  '/price-lists',
  allow(...MANAGE),
  ah(async (req, res) => {
    const body = priceListBody.parse(req.body);
    const pl = await PriceList.create({ ...body, businessId: req.business!._id });
    await audit(req, 'PRICE_LIST_CREATE', `${pl.name} (${pl.items.length} items)`);
    res.status(201).json(pl);
  })
);

inventoryRouter.put(
  '/price-lists/:id',
  allow(...MANAGE),
  ah(async (req, res) => {
    const pl = await PriceList.findOneAndUpdate({ _id: req.params.id, businessId: req.business!._id }, priceListBody.parse(req.body), { new: true });
    if (!pl) throw notFound('Price list');
    res.json(pl);
  })
);

/** Prices that apply to a party (its price list over the item master), for the invoice form. */
inventoryRouter.get(
  '/price-lists/resolve',
  allow(...READ),
  ah(async (req, res) => {
    const party = await Party.findOne({ _id: req.query.partyId, businessId: req.business!._id }).lean();
    if (!party?.priceListId) return res.json({ priceList: null, prices: {} });
    const pl = await PriceList.findById(party.priceListId).lean();
    if (!pl?.active) return res.json({ priceList: null, prices: {} });
    res.json({ priceList: pl.name, prices: Object.fromEntries(pl.items.map(i => [String(i.productId), i.price])) });
  })
);
