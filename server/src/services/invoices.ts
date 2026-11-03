import type { Request } from 'express';
import type { ClientSession } from 'mongoose';
import { Invoice, Party, Payment, TradeDocument } from '../models/billing';
import { BusinessDoc } from '../models/core';
import { inTransaction } from '../db';
import { r2, isValidDocNumber, isValidGstin } from '../../../shared/gst';
import { badRequest, conflict, notFound } from '../lib/errors';
import { todayIST } from '../lib/dates';
import { assertLimit, audit, buildLines, bumpFirstInvoice, compliance, docTotals, LineInput, moveStock, nextNumber } from './common';

export interface CreateInvoiceInput {
  partyId?: string;
  walkIn?: { name: string; phone?: string; address?: string; stateCode: string; gstin?: string };
  date?: string;
  dueDate?: string;
  number?: string; // optional manual number, must be unique and Rule 46 compliant
  items: LineInput[];
  amountPaid?: number;
  paymentMode?: 'CASH' | 'UPI' | 'NEFT_RTGS' | 'CHEQUE' | 'CARD';
  paymentReference?: string;
  reverseCharge?: boolean;
  notes?: string;
  sourceDoc?: string;
}

const hsnMin = (business: BusinessDoc, isB2B: boolean, rules: { hsnDigitsUpto5Cr: number; hsnDigitsAbove5Cr: number }) =>
  business.aatoBand === 'UPTO_5CR' ? (isB2B ? rules.hsnDigitsUpto5Cr : 1) : rules.hsnDigitsAbove5Cr;

export async function createInvoice(req: Request, input: CreateInvoiceInput, outerSession?: ClientSession) {
  const business = req.business!;
  const rules = await compliance();
  await assertLimit(business, 'invoice');

  const run = async (session: ClientSession) => {
    // ---- buyer ----
    let buyer: { partyId?: unknown; name: string; gstin: string; phone: string; address: string; stateCode: string };
    if (input.partyId) {
      const party = await Party.findOne({ _id: input.partyId, businessId: business._id }).session(session).lean();
      if (!party) throw notFound('Customer');
      if (party.type !== 'CUSTOMER') throw badRequest('Invoices can only be raised to customers');
      if (party.status === 'BLOCKED') throw badRequest(`${party.name} is blocked`);
      buyer = { partyId: party._id, name: party.name, gstin: party.gstin ?? '', phone: party.phone ?? '', address: party.billingAddress ?? '', stateCode: party.stateCode };
    } else if (input.walkIn) {
      buyer = { name: input.walkIn.name, gstin: (input.walkIn.gstin ?? '').toUpperCase(), phone: input.walkIn.phone ?? '', address: input.walkIn.address ?? '', stateCode: input.walkIn.stateCode };
    } else {
      throw badRequest('Choose a customer or enter walk-in buyer details');
    }
    if (buyer.gstin && !isValidGstin(buyer.gstin)) throw badRequest(`Buyer GSTIN ${buyer.gstin} is not valid`);

    const date = input.date ?? todayIST();
    if (date > todayIST()) throw badRequest('Invoice date cannot be in the future');
    const isInterState = buyer.stateCode !== business.stateCode;
    // composition / unregistered sellers issue a Bill of Supply and cannot charge GST
    const billOfSupply = business.gstType !== 'REGULAR';
    const isB2B = !!buyer.gstin;

    const lines = await buildLines(
      business._id,
      input.items.map(i => (billOfSupply ? { ...i, gstRate: 0 } : i)),
      isInterState,
      'sellingPrice',
      hsnMin(business, isB2B, rules),
      session
    );
    if (billOfSupply) lines.forEach(l => Object.assign(l, { gstRate: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalAmount: l.taxableAmount }));
    const t = docTotals(lines, business.invoiceSettings?.roundOff ?? true);

    // Rule 46: unregistered buyer above threshold needs full address
    if (!isB2B && t.taxableTotal >= rules.b2cLargeThreshold && !buyer.address.trim()) {
      throw badRequest(`Buyer address is required for unregistered buyers when taxable value is ₹${rules.b2cLargeThreshold.toLocaleString('en-IN')} or more (Rule 46)`);
    }

    const paid = r2(Math.min(input.amountPaid ?? 0, t.grandTotal));
    if (paid < 0) throw badRequest('Amount paid cannot be negative');

    // ---- number ----
    let number: string;
    if (input.number) {
      number = input.number.trim().toUpperCase();
      if (!isValidDocNumber(number, rules.invoiceNumberMaxLength)) throw badRequest('Invoice number: max 16 characters, letters, digits, "-" and "/" only (Rule 46)');
      if (await Invoice.exists({ businessId: business._id, number }).session(session)) throw conflict(`Invoice number ${number} already exists`);
    } else {
      number = await nextNumber(business, 'INV', business.invoiceSettings?.prefix ?? 'INV/{FY}/', date, session);
    }

    const dueDays = business.invoiceSettings?.defaultDueDays ?? 15;
    const [inv] = await Invoice.create(
      [
        {
          businessId: business._id,
          number,
          kind: billOfSupply ? 'BILL_OF_SUPPLY' : 'TAX_INVOICE',
          date,
          dueDate: input.dueDate ?? addDays(date, dueDays),
          partyId: buyer.partyId,
          partyName: buyer.name,
          partyGstin: buyer.gstin,
          partyPhone: buyer.phone,
          partyAddress: buyer.address,
          partyStateCode: buyer.stateCode,
          placeOfSupply: buyer.stateCode,
          isInterState,
          reverseCharge: !!input.reverseCharge,
          items: lines,
          ...t,
          amountPaid: paid,
          balanceDue: r2(t.grandTotal - paid),
          status: paid >= t.grandTotal ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
          notes: input.notes ?? business.invoiceSettings?.defaultNotes ?? '',
          sourceDoc: input.sourceDoc ?? '',
          createdBy: req.user!._id
        }
      ],
      { session }
    );

    await moveStock(business, lines, -1, { type: 'INVOICE', id: inv._id, number, date, reason: 'Sale' }, session);

    if (buyer.partyId) await Party.updateOne({ _id: buyer.partyId }, { $inc: { balance: t.grandTotal } }, { session });
    if (paid > 0) {
      await Payment.create(
        [{ businessId: business._id, type: 'PAYMENT_IN', partyId: buyer.partyId ?? undefined, partyName: buyer.name, refType: 'INVOICE', refId: inv._id, refNumber: number, amount: paid, date, mode: input.paymentMode ?? 'CASH', reference: input.paymentReference ?? '', notes: 'Collected with invoice', createdBy: req.user!._id }],
        { session }
      );
      if (buyer.partyId) await Party.updateOne({ _id: buyer.partyId }, { $inc: { balance: -paid } }, { session });
    }

    await bumpFirstInvoice(business._id, session);
    await audit(req, 'INVOICE_CREATE', `${number} for ${buyer.name} · ₹${t.grandTotal}`, 'SUCCESS', business._id, session);
    return inv.toObject();
  };

  return outerSession ? run(outerSession) : inTransaction(run);
}

/** Rule 46: a cancelled invoice keeps its number in the register (never reused); goods and dues are reversed. */
export async function cancelInvoice(req: Request, invoiceId: string, reason: string) {
  const business = req.business!;
  return inTransaction(async session => {
    const inv = await Invoice.findOne({ _id: invoiceId, businessId: business._id }).session(session);
    if (!inv) throw notFound('Invoice');
    if (inv.status === 'CANCELLED') throw conflict('Invoice is already cancelled');
    if (inv.eInvoice?.status === 'GENERATED') {
      throw conflict('This invoice has an IRN. Cancel the e-invoice first (allowed within 24 hours on the IRP) or issue a credit note.');
    }
    if (inv.eWayBill?.status === 'GENERATED') throw conflict('Cancel the e-way bill first');
    if (await TradeDocument.exists({ businessId: business._id, docType: 'CREDIT_NOTE', reference: inv.number, status: { $ne: 'CANCELLED' } }).session(session)) {
      throw conflict('Credit notes exist against this invoice; cancel them first');
    }

    await moveStock(business, inv.items as never, 1, { type: 'INVOICE_CANCEL', id: inv._id, number: inv.number, date: todayIST(), reason: 'Invoice cancelled' }, session);
    // remove the whole invoice value from the receivable; any payment already taken becomes an advance
    if (inv.partyId) await Party.updateOne({ _id: inv.partyId }, { $inc: { balance: -inv.grandTotal } }, { session });

    inv.status = 'CANCELLED';
    inv.cancelReason = reason;
    inv.cancelledAt = new Date();
    inv.balanceDue = 0;
    await inv.save({ session });
    await audit(req, 'INVOICE_CANCEL', `${inv.number} (₹${inv.grandTotal}) · ${reason}`, 'WARNING', business._id, session);
    return inv.toObject();
  });
}

export interface PaymentInput {
  type: 'PAYMENT_IN' | 'PAYMENT_OUT';
  partyId: string;
  invoiceId?: string; // PAYMENT_IN against an invoice
  billId?: string; // PAYMENT_OUT against a purchase bill
  amount: number;
  date?: string;
  mode: 'CASH' | 'UPI' | 'NEFT_RTGS' | 'CHEQUE' | 'CARD';
  reference?: string;
  notes?: string;
}

export async function recordPayment(req: Request, input: PaymentInput) {
  const business = req.business!;
  const amount = r2(input.amount);
  if (!(amount > 0)) throw badRequest('Amount must be more than 0');
  return inTransaction(async session => {
    const party = await Party.findOne({ _id: input.partyId, businessId: business._id }).session(session);
    if (!party) throw notFound('Party');
    const date = input.date ?? todayIST();
    let refType: 'INVOICE' | 'PURCHASE_BILL' | 'ADVANCE' = 'ADVANCE';
    let refId: unknown;
    let refNumber = '';

    if (input.type === 'PAYMENT_IN' && input.invoiceId) {
      const inv = await Invoice.findOne({ _id: input.invoiceId, businessId: business._id, partyId: party._id }).session(session);
      if (!inv) throw notFound('Invoice for this customer');
      if (inv.status === 'CANCELLED') throw badRequest('Invoice is cancelled');
      if (amount > inv.balanceDue + 0.001) throw badRequest(`Amount is more than the balance due (₹${inv.balanceDue})`);
      inv.amountPaid = r2(inv.amountPaid + amount);
      inv.balanceDue = r2(inv.balanceDue - amount);
      inv.status = inv.balanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      await inv.save({ session });
      refType = 'INVOICE';
      refId = inv._id;
      refNumber = inv.number;
    }
    if (input.type === 'PAYMENT_OUT' && input.billId) {
      const bill = await TradeDocument.findOne({ _id: input.billId, businessId: business._id, docType: 'PURCHASE_BILL', partyId: party._id }).session(session);
      if (!bill) throw notFound('Purchase bill for this supplier');
      if (bill.status === 'CANCELLED') throw badRequest('Bill is cancelled');
      const due = r2(bill.grandTotal - bill.amountPaid - (bill.adjustedAmount ?? 0));
      if (amount > due + 0.001) throw badRequest(`Amount is more than the balance due (₹${due})`);
      bill.amountPaid = r2(bill.amountPaid + amount);
      bill.status = bill.amountPaid + (bill.adjustedAmount ?? 0) >= bill.grandTotal ? 'PAID' : 'PARTIALLY_PAID';
      await bill.save({ session });
      refType = 'PURCHASE_BILL';
      refId = bill._id;
      refNumber = bill.reference || bill.number;
    }

    // receivable goes down when money comes in; payable goes down (balance up) when we pay
    await Party.updateOne({ _id: party._id }, { $inc: { balance: input.type === 'PAYMENT_IN' ? -amount : amount } }, { session });
    const [pay] = await Payment.create(
      [{ businessId: business._id, type: input.type, partyId: party._id, partyName: party.name, refType, refId, refNumber, amount, date, mode: input.mode, reference: input.reference ?? '', notes: input.notes ?? '', createdBy: req.user!._id }],
      { session }
    );
    await audit(req, input.type, `₹${amount} ${input.type === 'PAYMENT_IN' ? 'from' : 'to'} ${party.name}${refNumber ? ' · ' + refNumber : ''}`, 'SUCCESS', business._id, session);
    return pay.toObject();
  });
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
