import type { ClientSession, Types } from 'mongoose';
import type { Request } from 'express';
import { AuditLog, Business, BusinessDoc, Counter, Membership } from '../models/core';
import { Invoice, Product } from '../models/billing';
import { Plan, PlanDoc, Setting, DEFAULT_COMPLIANCE, ComplianceRules } from '../models/platform';
import { fyLabel, isValidDocNumber, recalcItem, docTotals, GstLine } from '../../../shared/gst';
import { badRequest, planLimit } from '../lib/errors';
import { todayIST } from '../lib/dates';

// ---------------- numbering ----------------

/**
 * Allocates the next number for a document series. The counter is incremented atomically inside the
 * caller's transaction, so two parallel invoices can never get the same number and an aborted
 * transaction does not burn a number.
 */
export async function nextNumber(business: BusinessDoc, series: string, prefixTemplate: string, date: string, session?: ClientSession) {
  const s = business.invoiceSettings!;
  const fy = fyLabel(date);
  const key = s.financialYearReset ? `${series}:${fy}` : series;
  const counter = await Counter.findOneAndUpdate(
    { businessId: business._id, key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session }
  );
  const number = prefixTemplate.replace('{FY}', fy) + String(counter!.seq).padStart(s.padding ?? 4, '0');
  if (!isValidDocNumber(number)) {
    throw badRequest(`Generated number "${number}" breaks GST Rule 46 (max 16 chars: letters, digits, - and /). Shorten the prefix in Invoice Settings.`);
  }
  return number;
}

/** Shows the number the next document in a series will get, without using it up. */
export async function peekNumber(business: BusinessDoc, series: string, prefixTemplate: string, date: string) {
  const s = business.invoiceSettings!;
  const fy = fyLabel(date);
  const key = s.financialYearReset ? `${series}:${fy}` : series;
  const counter = await Counter.findOne({ businessId: business._id, key }).lean();
  return prefixTemplate.replace('{FY}', fy) + String((counter?.seq ?? 0) + 1).padStart(s.padding ?? 4, '0');
}

// ---------------- audit ----------------

export async function audit(
  req: Request | null,
  action: string,
  details: string,
  status: 'SUCCESS' | 'WARNING' | 'FAILED' = 'SUCCESS',
  businessId?: Types.ObjectId | null,
  session?: ClientSession
) {
  await AuditLog.create(
    [
      {
        businessId: businessId ?? req?.business?._id ?? null,
        userId: req?.user?._id,
        userName: req?.user?.name || req?.user?.phone || req?.user?.email,
        action,
        details,
        status,
        ip: req?.ip
      }
    ],
    { session }
  );
}

// ---------------- plans & limits ----------------

/** The plan whose limits apply right now: an active trial, else a valid paid plan, else Free. */
export async function effectivePlan(business: BusinessDoc): Promise<PlanDoc & { onTrial: boolean }> {
  const today = todayIST();
  let id = 'free';
  let onTrial = false;
  if (business.trialPlanId && business.trialEndsOn && business.trialEndsOn >= today) {
    id = business.trialPlanId;
    onTrial = true;
  } else if (business.planId !== 'free' && (business.planCycle === 'LIFETIME' || (business.planValidUntil && business.planValidUntil >= today))) {
    id = business.planId;
  }
  const plan = await Plan.findById(id).lean<PlanDoc>();
  if (!plan) throw new Error(`Plan ${id} missing, run the seed script`);
  return { ...plan, onTrial };
}

export async function usage(businessId: Types.ObjectId) {
  const today = todayIST();
  const monthStart = today.slice(0, 7) + '-01';
  const fyStart = (Number(today.slice(5, 7)) >= 4 ? today.slice(0, 4) : String(Number(today.slice(0, 4)) - 1)) + '-04-01';
  const [invoicesThisMonth, users, eInvoices, eWayBills] = await Promise.all([
    Invoice.countDocuments({ businessId, date: { $gte: monthStart } }),
    Membership.countDocuments({ businessId, status: 'ACTIVE' }),
    Invoice.countDocuments({ businessId, date: { $gte: fyStart }, 'eInvoice.status': 'GENERATED', 'eInvoice.mock': { $ne: true } }),
    Invoice.countDocuments({ businessId, date: { $gte: fyStart }, 'eWayBill.status': 'GENERATED', 'eWayBill.mock': { $ne: true } })
  ]);
  return { invoicesThisMonth, users, eInvoicesThisYear: eInvoices, eWayBillsThisYear: eWayBills };
}

export async function assertLimit(business: BusinessDoc, what: 'invoice' | 'user' | 'eInvoice' | 'eWayBill' | 'business', ownerBusinesses?: number) {
  const plan = await effectivePlan(business);
  const u = await usage(business._id);
  const L = plan.limits!;
  const fail = (msg: string) => {
    throw planLimit(`${msg} on the ${plan.name} plan. Upgrade to continue.`);
  };
  if (what === 'invoice' && L.invoicesPerMonth != null && u.invoicesThisMonth >= L.invoicesPerMonth) fail(`Monthly limit of ${L.invoicesPerMonth} invoices reached`);
  if (what === 'user' && u.users >= (L.users ?? 1)) fail(`User limit of ${L.users} reached`);
  if (what === 'eInvoice') {
    if (!L.eInvoicesPerYear) fail('e-Invoicing is not included');
    if (L.eInvoicesPerYear != null && u.eInvoicesThisYear >= L.eInvoicesPerYear) fail(`Yearly limit of ${L.eInvoicesPerYear} e-invoices reached`);
  }
  if (what === 'eWayBill') {
    if (L.eWayBillsPerYear === 0) fail('e-Way bills are not included');
    if (L.eWayBillsPerYear != null && u.eWayBillsThisYear >= L.eWayBillsPerYear) fail(`Yearly limit of ${L.eWayBillsPerYear} e-way bills reached`);
  }
  if (what === 'business' && ownerBusinesses !== undefined && ownerBusinesses >= (L.businesses ?? 1)) fail(`Business limit of ${L.businesses} reached`);
}

export async function compliance(): Promise<ComplianceRules> {
  const row = await Setting.findById('compliance').lean<{ value: ComplianceRules }>();
  return { ...DEFAULT_COMPLIANCE, ...(row?.value ?? {}) };
}

// ---------------- line items ----------------

export interface LineInput {
  productId?: string;
  name?: string;
  hsnCode?: string;
  unit?: string;
  quantity: number;
  price?: number;
  discountPercent?: number;
  gstRate?: number;
  priceIncludesTax?: boolean;
  batchNo?: string;
  expiryDate?: string;
  mfgDate?: string;
}

/**
 * Builds line items on the server. Product lines take HSN, unit and GST rate from the item master
 * (price may be overridden); totals are always recomputed, client-sent amounts are ignored.
 */
export async function buildLines(
  businessId: Types.ObjectId,
  inputs: LineInput[],
  isInterState: boolean,
  priceField: 'sellingPrice' | 'purchasePrice',
  hsnMinDigits: number,
  session?: ClientSession,
  priceMap?: Map<string, number>
): Promise<GstLine[]> {
  if (!inputs.length) throw badRequest('Add at least one item');
  const ids = inputs.filter(i => i.productId).map(i => i.productId!);
  const products = await Product.find({ _id: { $in: ids }, businessId }).session(session ?? null).lean();
  return inputs.map((inp, idx) => {
    const p = inp.productId ? products.find(x => String(x._id) === inp.productId) : undefined;
    if (inp.productId && !p) throw badRequest(`Item ${idx + 1}: product not found in this business`);
    const hsn = p?.hsnCode ?? inp.hsnCode ?? '';
    if (!/^\d+$/.test(hsn) || hsn.length < hsnMinDigits) throw badRequest(`Item ${idx + 1}: HSN/SAC must have at least ${hsnMinDigits} digits`);
    const line: GstLine = {
      id: String(idx + 1),
      productId: p ? String(p._id) : undefined,
      name: p?.name ?? inp.name ?? '',
      hsnCode: hsn,
      quantity: inp.quantity,
      unit: p?.unit ?? inp.unit ?? 'NOS',
      // explicit price > party price list > item master
      price: inp.price ?? (p && priceMap?.has(String(p._id)) ? priceMap.get(String(p._id))! : p ? (p[priceField] as number) : 0),
      discountPercent: inp.discountPercent ?? 0,
      priceIncludesTax: inp.priceIncludesTax ?? (inp.price === undefined ? !!p?.priceIncludesTax : false),
      gstRate: p?.taxRate ?? inp.gstRate ?? 18,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0,
      ...(inp.batchNo ? { batchNo: inp.batchNo.toUpperCase() } : {}),
      ...(inp.expiryDate ? { expiryDate: inp.expiryDate } : {}),
      ...(inp.mfgDate ? { mfgDate: inp.mfgDate } : {})
    } as GstLine;
    if (!line.name) throw badRequest(`Item ${idx + 1}: name is required`);
    if (!(line.quantity > 0)) throw badRequest(`Item ${idx + 1}: quantity must be more than 0`);
    if (line.price < 0) throw badRequest(`Item ${idx + 1}: price cannot be negative`);
    return recalcItem(line, isInterState);
  });
}

export { docTotals };

export { moveStock } from './stock';

export async function bumpFirstInvoice(businessId: Types.ObjectId, session: ClientSession) {
  await Business.updateOne({ _id: businessId, firstInvoiceAt: null }, { firstInvoiceAt: new Date() }, { session });
}
