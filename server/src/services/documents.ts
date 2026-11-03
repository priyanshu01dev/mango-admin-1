import type { Request } from 'express';
import type { ClientSession } from 'mongoose';
import { DocType, Invoice, Party, Payment, TradeDocument } from '../models/billing';
import { inTransaction } from '../db';
import { r2, isValidGstin } from '../../../shared/gst';
import { badRequest, conflict, notFound } from '../lib/errors';
import { todayIST } from '../lib/dates';
import { audit, buildLines, compliance, docTotals, LineInput, moveStock, nextNumber } from './common';
import { createInvoice } from './invoices';
import { allocateBatches, priceMapFor, StockLine } from './stock';
import { Godown } from '../models/inventory';

export const PURCHASE_TYPES: DocType[] = ['PURCHASE_ORDER', 'PURCHASE_BILL', 'DEBIT_NOTE'];
export const SALES_TYPES: DocType[] = ['QUOTATION', 'PROFORMA', 'SALES_ORDER', 'DELIVERY_CHALLAN', 'CREDIT_NOTE'];
const CONVERTIBLE_TO_INVOICE: DocType[] = ['QUOTATION', 'PROFORMA', 'SALES_ORDER', 'DELIVERY_CHALLAN'];

export interface CreateDocInput {
  docType: DocType;
  partyId: string;
  date?: string;
  dueDate?: string;
  items: LineInput[];
  reference?: string; // PURCHASE_BILL: supplier bill no. · CREDIT/DEBIT NOTE: original invoice / bill number
  reason?: string;
  restock?: boolean;
  itcEligible?: boolean;
  vehicleNumber?: string;
  notes?: string;
  godownId?: string;
  amountPaid?: number; // PURCHASE_BILL paid at the time of entry
  paymentMode?: 'CASH' | 'UPI' | 'NEFT_RTGS' | 'CHEQUE' | 'CARD';
}

/** What a document does to stock (+ in / − out) and to the party balance (+ receivable / − payable). */
function effects(docType: DocType, restock: boolean) {
  switch (docType) {
    case 'PURCHASE_BILL': return { stock: 1 as const, balanceSign: -1 };
    case 'DEBIT_NOTE': return { stock: -1 as const, balanceSign: 1 };
    case 'CREDIT_NOTE': return { stock: restock ? (1 as const) : null, balanceSign: -1 };
    default: return { stock: null, balanceSign: 0 }; // quotations, proforma, orders, challans: no books impact
  }
}

export async function createDocument(req: Request, input: CreateDocInput, outerSession?: ClientSession) {
  const business = req.business!;
  const rules = await compliance();
  const purchase = PURCHASE_TYPES.includes(input.docType);

  const run = async (session: ClientSession) => {
    const party = await Party.findOne({ _id: input.partyId, businessId: business._id }).session(session).lean();
    if (!party) throw notFound('Party');
    if (party.type !== (purchase ? 'SUPPLIER' : 'CUSTOMER')) throw badRequest(`${input.docType.replace(/_/g, ' ').toLowerCase()} needs a ${purchase ? 'supplier' : 'customer'}`);
    if (party.gstin && !isValidGstin(party.gstin)) throw badRequest(`Party GSTIN ${party.gstin} is not valid. Fix it in the party master.`);

    const date = input.date ?? todayIST();
    const isInterState = party.stateCode !== business.stateCode;
    const lines = (await buildLines(business._id, input.items, isInterState, purchase ? 'purchasePrice' : 'sellingPrice', 1, session, purchase ? undefined : await priceMapFor(party.priceListId, session))) as StockLine[];
    if (input.godownId && !(await Godown.exists({ _id: input.godownId, businessId: business._id }).session(session))) throw badRequest('Godown not found');
    // returned goods go back into a "RETURNS" batch unless the batch is given
    if (input.docType === 'CREDIT_NOTE') lines.forEach(l => { if (!l.batchNo) l.batchNo = 'RETURNS'; });
    if (input.docType === 'DEBIT_NOTE') await allocateBatches(business._id, lines, session);
    const t = docTotals(lines, business.invoiceSettings?.roundOff ?? true);
    const restock = input.restock ?? true;

    // notes must point at a live original document and cannot exceed what is left on it
    if (input.docType === 'CREDIT_NOTE') {
      if (!input.reference) throw badRequest('Select the invoice this credit note is against');
      const inv = await Invoice.findOne({ businessId: business._id, number: input.reference, partyId: party._id }).session(session);
      if (!inv || inv.status === 'CANCELLED') throw badRequest(`Invoice ${input.reference} not found for ${party.name}`);
      const credited = inv.creditedAmount ?? 0;
      if (t.grandTotal > inv.grandTotal - credited + 0.5) throw badRequest(`Credit note (₹${t.grandTotal}) is more than what is left on ${inv.number} (₹${r2(inv.grandTotal - credited)})`);
      inv.creditedAmount = r2(credited + t.grandTotal);
      inv.balanceDue = r2(Math.max(0, inv.balanceDue - t.grandTotal));
      if (inv.balanceDue <= 0) inv.status = 'PAID';
      await inv.save({ session });
    }
    if (input.docType === 'DEBIT_NOTE') {
      if (!input.reference) throw badRequest('Select the purchase bill this debit note is against');
      const bill = await TradeDocument.findOne({ businessId: business._id, docType: 'PURCHASE_BILL', number: input.reference, partyId: party._id }).session(session);
      if (!bill || bill.status === 'CANCELLED') throw badRequest(`Purchase bill ${input.reference} not found for ${party.name}`);
      const adjusted = bill.adjustedAmount ?? 0;
      if (t.grandTotal > bill.grandTotal - adjusted + 0.5) throw badRequest(`Debit note is more than what is left on ${bill.number}`);
      bill.adjustedAmount = r2(adjusted + t.grandTotal);
      if (bill.amountPaid + bill.adjustedAmount >= bill.grandTotal) bill.status = 'PAID';
      await bill.save({ session });
    }

    const paid = input.docType === 'PURCHASE_BILL' ? r2(Math.min(Math.max(0, input.amountPaid ?? 0), t.grandTotal)) : 0;
    let status = 'OPEN';
    if (input.docType === 'PURCHASE_BILL') status = paid >= t.grandTotal ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
    if (input.docType === 'CREDIT_NOTE' || input.docType === 'DEBIT_NOTE') status = 'ISSUED';

    const prefix = (business.invoiceSettings?.docPrefixes as Record<string, string> | undefined)?.[input.docType] ?? `${input.docType.slice(0, 2)}/{FY}/`;
    const number = await nextNumber(business, input.docType, prefix, date, session);

    const [doc] = await TradeDocument.create(
      [
        {
          businessId: business._id,
          docType: input.docType,
          number,
          date,
          dueDate: input.dueDate,
          partyId: party._id,
          partyName: party.name,
          partyGstin: party.gstin,
          partyPhone: party.phone,
          partyAddress: party.billingAddress,
          partyStateCode: party.stateCode,
          godownId: input.godownId || undefined,
          isInterState,
          items: lines,
          ...t,
          amountPaid: paid,
          status,
          reference: input.reference ?? '',
          reason: input.reason ?? '',
          restock,
          itcEligible: input.docType === 'PURCHASE_BILL' ? input.itcEligible ?? !!party.gstin : false,
          vehicleNumber: (input.vehicleNumber ?? '').toUpperCase(),
          notes: input.notes ?? '',
          createdBy: req.user!._id
        }
      ],
      { session }
    );

    const fx = effects(input.docType, restock);
    if (fx.stock) await moveStock(business, lines, fx.stock, { type: input.docType, id: doc._id, number, date, reason: input.docType.replace(/_/g, ' ').toLowerCase(), godownId: input.godownId }, session);
    if (fx.balanceSign) await Party.updateOne({ _id: party._id }, { $inc: { balance: fx.balanceSign * t.grandTotal } }, { session });
    if (paid > 0) {
      await Party.updateOne({ _id: party._id }, { $inc: { balance: paid } }, { session });
      await Payment.create(
        [{ businessId: business._id, type: 'PAYMENT_OUT', partyId: party._id, partyName: party.name, refType: 'PURCHASE_BILL', refId: doc._id, refNumber: input.reference || number, amount: paid, date, mode: input.paymentMode ?? 'NEFT_RTGS', notes: 'Paid with bill entry', createdBy: req.user!._id }],
        { session }
      );
    }
    if (input.docType === 'DELIVERY_CHALLAN' && t.grandTotal > rules.eWayBillThreshold && !input.vehicleNumber) {
      // challans above the threshold move goods: keep a warning in the record
      doc.notes = `[e-Way bill required: value above ₹${rules.eWayBillThreshold}] ${doc.notes}`;
      await doc.save({ session });
    }
    await audit(req, `${input.docType}_CREATE`, `${number} · ${party.name} · ₹${t.grandTotal}`, 'SUCCESS', business._id, session);
    return doc.toObject();
  };

  return outerSession ? run(outerSession) : inTransaction(run);
}

export async function cancelDocument(req: Request, id: string, reason: string) {
  const business = req.business!;
  return inTransaction(async session => {
    const doc = await TradeDocument.findOne({ _id: id, businessId: business._id }).session(session);
    if (!doc) throw notFound('Document');
    if (doc.status === 'CANCELLED') throw conflict('Already cancelled');
    if (doc.status === 'CONVERTED') throw conflict(`Already converted to ${doc.convertedTo}; cancel that instead`);
    if (doc.docType === 'PURCHASE_BILL' && doc.amountPaid > 0) throw conflict('Payments exist against this bill. Record a debit note instead.');
    if (doc.docType === 'PURCHASE_BILL' && (doc.adjustedAmount ?? 0) > 0) throw conflict('Debit notes exist against this bill; cancel them first');

    const fx = effects(doc.docType as DocType, doc.restock ?? true);
    if (fx.stock) {
      await moveStock(business, doc.items as never, (fx.stock * -1) as 1 | -1, { type: `${doc.docType}_CANCEL`, id: doc._id, number: doc.number, date: todayIST(), reason: 'Cancelled', godownId: doc.godownId }, session);
    }
    if (fx.balanceSign) await Party.updateOne({ _id: doc.partyId }, { $inc: { balance: -fx.balanceSign * doc.grandTotal } }, { session });
    if (doc.docType === 'CREDIT_NOTE') {
      const inv = await Invoice.findOne({ businessId: business._id, number: doc.reference }).session(session);
      if (inv) {
        inv.creditedAmount = r2(Math.max(0, (inv.creditedAmount ?? 0) - doc.grandTotal));
        inv.balanceDue = r2(inv.grandTotal - inv.amountPaid - inv.creditedAmount);
        inv.status = inv.balanceDue <= 0 ? 'PAID' : inv.amountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
        await inv.save({ session });
      }
    }
    if (doc.docType === 'DEBIT_NOTE') {
      const bill = await TradeDocument.findOne({ businessId: business._id, docType: 'PURCHASE_BILL', number: doc.reference }).session(session);
      if (bill) {
        bill.adjustedAmount = r2(Math.max(0, (bill.adjustedAmount ?? 0) - doc.grandTotal));
        bill.status = bill.amountPaid + bill.adjustedAmount >= bill.grandTotal ? 'PAID' : bill.amountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
        await bill.save({ session });
      }
    }
    doc.status = 'CANCELLED';
    doc.cancelReason = reason;
    await doc.save({ session });
    await audit(req, `${doc.docType}_CANCEL`, `${doc.number} · ${reason}`, 'WARNING', business._id, session);
    return doc.toObject();
  });
}

/** Quotation / proforma / sales order / challan → GST tax invoice (one transaction). */
export async function convertToInvoice(req: Request, id: string) {
  const business = req.business!;
  return inTransaction(async session => {
    const doc = await TradeDocument.findOne({ _id: id, businessId: business._id }).session(session);
    if (!doc) throw notFound('Document');
    if (!CONVERTIBLE_TO_INVOICE.includes(doc.docType as DocType)) throw badRequest(`${doc.docType} cannot be converted to an invoice`);
    if (doc.status === 'CONVERTED' || doc.status === 'CANCELLED') throw conflict(`Document is ${doc.status.toLowerCase()}`);
    const inv = await createInvoice(
      req,
      {
        partyId: String(doc.partyId),
        items: doc.items.map(i => ({ productId: i.productId ? String(i.productId) : undefined, name: i.name, hsnCode: i.hsnCode, unit: i.unit ?? undefined, quantity: i.quantity, price: i.price, discountPercent: i.discountPercent ?? 0, gstRate: i.gstRate, batchNo: i.batchNo ?? undefined })),
        godownId: doc.godownId ? String(doc.godownId) : undefined,
        notes: `Against ${doc.number}`,
        sourceDoc: doc.number
      },
      session
    );
    doc.status = 'CONVERTED';
    doc.convertedTo = inv.number;
    await doc.save({ session });
    return inv;
  });
}

/** Goods received against a purchase order → purchase bill. */
export async function convertPoToBill(req: Request, id: string, supplierBillNo: string) {
  const business = req.business!;
  return inTransaction(async session => {
    const po = await TradeDocument.findOne({ _id: id, businessId: business._id, docType: 'PURCHASE_ORDER' }).session(session);
    if (!po) throw notFound('Purchase order');
    if (po.status !== 'OPEN') throw conflict(`Purchase order is ${po.status.toLowerCase()}`);
    const bill = await createDocument(
      req,
      {
        docType: 'PURCHASE_BILL',
        partyId: String(po.partyId),
        reference: supplierBillNo,
        items: po.items.map(i => ({ productId: i.productId ? String(i.productId) : undefined, name: i.name, hsnCode: i.hsnCode, unit: i.unit ?? undefined, quantity: i.quantity, price: i.price, discountPercent: i.discountPercent ?? 0, gstRate: i.gstRate, batchNo: i.batchNo ?? undefined, expiryDate: i.expiryDate ?? undefined })),
        godownId: po.godownId ? String(po.godownId) : undefined,
        notes: `Against ${po.number}`
      },
      session
    );
    po.status = 'CONVERTED';
    po.convertedTo = bill.number;
    await po.save({ session });
    return bill;
  });
}
