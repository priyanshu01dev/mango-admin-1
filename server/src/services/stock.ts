import type { ClientSession, Types } from 'mongoose';
import { BusinessDoc } from '../models/core';
import { Product, StockMovement } from '../models/billing';
import { Batch, Godown, PriceList, ProductStock } from '../models/inventory';
import { badRequest } from '../lib/errors';
import type { GstLine } from '../../../shared/gst';
import { todayIST } from '../lib/dates';

/** The business's default godown, created on first use. */
export async function defaultGodown(businessId: Types.ObjectId, session?: ClientSession) {
  const g = await Godown.findOne({ businessId, isDefault: true }).session(session ?? null);
  if (g) return g;
  const [created] = await Godown.create([{ businessId, name: 'Main godown', isDefault: true }], { session });
  return created;
}

/** Products created before godowns existed carry all their stock in the default godown. */
async function ensureGodownRows(businessId: Types.ObjectId, productId: string, session: ClientSession) {
  if (await ProductStock.exists({ productId }).session(session)) return;
  const p = await Product.findById(productId).session(session).lean();
  const g = await defaultGodown(businessId, session);
  await ProductStock.create([{ businessId, productId, godownId: g._id, quantity: p?.stock ?? 0 }], { session });
}

export async function changeGodownStock(businessId: Types.ObjectId, productId: string, godownId: Types.ObjectId, qty: number, allowNegative: boolean, name: string, session: ClientSession) {
  await ensureGodownRows(businessId, productId, session);
  const filter: Record<string, unknown> = { productId, godownId };
  if (qty < 0 && !allowNegative) filter.quantity = { $gte: -qty };
  const r = await ProductStock.findOneAndUpdate(filter, { $inc: { quantity: qty }, $setOnInsert: { businessId } }, { session, new: true, upsert: qty > 0 || allowNegative });
  if (!r) {
    const g = await Godown.findById(godownId).session(session).lean();
    const row = await ProductStock.findOne({ productId, godownId }).session(session).lean();
    throw badRequest(`Not enough stock of "${name}" in ${g?.name ?? 'this godown'} (available ${row?.quantity ?? 0})`);
  }
}

export interface BatchAllocation {
  batchNo: string;
  quantity: number;
  expiryDate?: string;
}
export type StockLine = GstLine & { batchNo?: string; expiryDate?: string; mfgDate?: string; batches?: BatchAllocation[] };

/**
 * Picks batches for outgoing batch-tracked lines: the given batch, else first-expiry-first-out,
 * skipping expired batches. The allocation is stored on the line so cancellations restore the same batches.
 */
export async function allocateBatches(businessId: Types.ObjectId, lines: StockLine[], session: ClientSession) {
  const today = todayIST();
  for (const l of lines) {
    if (!l.productId) continue;
    const p = await Product.findById(l.productId).session(session).lean();
    if (!(p as { trackBatches?: boolean } | null)?.trackBatches) continue;
    if (l.batchNo) {
      const b = await Batch.findOne({ productId: l.productId, batchNo: l.batchNo.toUpperCase() }).session(session).lean();
      if (!b) throw badRequest(`Batch ${l.batchNo} of "${l.name}" not found`);
      if (b.expiryDate && b.expiryDate < today) throw badRequest(`Batch ${b.batchNo} of "${l.name}" expired on ${b.expiryDate}`);
      l.batches = [{ batchNo: b.batchNo, quantity: l.quantity, expiryDate: b.expiryDate }];
      continue;
    }
    const batches = await Batch.find({ productId: l.productId, quantity: { $gt: 0 }, $or: [{ expiryDate: '' }, { expiryDate: { $gte: today } }] })
      .sort({ expiryDate: 1, createdAt: 1 })
      .session(session)
      .lean();
    let need = l.quantity;
    const alloc: BatchAllocation[] = [];
    for (const b of batches) {
      if (need <= 0) break;
      const take = Math.min(need, b.quantity);
      alloc.push({ batchNo: b.batchNo, quantity: take, expiryDate: b.expiryDate });
      need -= take;
    }
    if (need > 0) throw badRequest(`Not enough unexpired batch stock for "${l.name}" (short by ${need} ${l.unit})`);
    l.batches = alloc;
  }
}

async function changeBatches(businessId: Types.ObjectId, l: StockLine, sign: 1 | -1, session: ClientSession) {
  const p = await Product.findById(l.productId).session(session).lean();
  if (!(p as { trackBatches?: boolean } | null)?.trackBatches) return;
  if (l.batches?.length) {
    for (const a of l.batches) {
      const qty = sign * a.quantity;
      const filter: Record<string, unknown> = { productId: l.productId, batchNo: a.batchNo };
      if (qty < 0) filter.quantity = { $gte: -qty };
      const r = await Batch.findOneAndUpdate(filter, { $inc: { quantity: qty } }, { session, new: true });
      if (!r) throw badRequest(`Batch ${a.batchNo} of "${l.name}" does not have ${-qty} left`);
    }
    return;
  }
  if (sign > 0) {
    // stock coming in (purchase, return): needs a batch number
    const batchNo = (l.batchNo || '').toUpperCase();
    if (!batchNo) throw badRequest(`"${l.name}" is batch-tracked: enter the batch number`);
    await Batch.findOneAndUpdate(
      { productId: l.productId, batchNo },
      { $inc: { quantity: l.quantity }, $set: { businessId, ...(l.expiryDate ? { expiryDate: l.expiryDate } : {}), ...(l.mfgDate ? { mfgDate: l.mfgDate } : {}) } },
      { session, upsert: true }
    );
    l.batches = [{ batchNo, quantity: l.quantity, expiryDate: l.expiryDate }];
    return;
  }
  throw badRequest(`"${l.name}" is batch-tracked: batches were not allocated`);
}

/**
 * Applies stock changes for a document: product total, godown, batches, and the item ledger.
 * Throws (rolling back the transaction) if stock would go negative, unless the business allows it.
 */
export async function moveStock(
  business: BusinessDoc,
  lines: StockLine[],
  sign: 1 | -1,
  ref: { type: string; id: Types.ObjectId; number: string; date: string; reason: string; godownId?: Types.ObjectId | string | null },
  session: ClientSession
) {
  const allowNegative = !!business.invoiceSettings?.allowNegativeStock;
  const godownId = ref.godownId ? (ref.godownId as Types.ObjectId) : (await defaultGodown(business._id, session))._id;
  for (const l of lines) {
    if (!l.productId) continue;
    const qty = sign * l.quantity;
    const filter: Record<string, unknown> = { _id: l.productId, businessId: business._id, isService: { $ne: true } };
    if (qty < 0 && !allowNegative) filter.stock = { $gte: -qty };
    const before = await Product.findById(l.productId).session(session).lean();
    if (before?.isService) continue;
    await ensureGodownRows(business._id, String(l.productId), session);
    const updated = await Product.findOneAndUpdate(filter, { $inc: { stock: qty } }, { session, new: true });
    if (!updated) {
      throw badRequest(`Not enough stock for "${l.name}" (available ${before?.stock ?? 0} ${l.unit}). Enable negative stock in settings to bill anyway.`);
    }
    await changeGodownStock(business._id, String(l.productId), godownId as Types.ObjectId, qty, allowNegative, l.name, session);
    await changeBatches(business._id, l, sign, session);
    await StockMovement.create(
      [{ businessId: business._id, productId: l.productId, quantity: qty, reason: ref.reason, refType: ref.type, refId: ref.id, refNumber: ref.number, date: ref.date, godownId, batches: l.batches }],
      { session }
    );
  }
}

/** productId → price from the party's price list (used when the client does not send a price). */
export async function priceMapFor(priceListId: unknown, session?: ClientSession) {
  if (!priceListId) return new Map<string, number>();
  const pl = await PriceList.findById(priceListId).session(session ?? null).lean();
  if (!pl?.active) return new Map<string, number>();
  return new Map(pl.items.map(i => [String(i.productId), i.price]));
}
