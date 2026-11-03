import crypto from 'node:crypto';
import type { Request } from 'express';
import { Invoice, InvoiceDoc } from '../models/billing';
import { BusinessDoc } from '../models/core';
import { config } from '../config';
import { fyLabel, isValidDocNumber, isValidGstin, daysBetween } from '../../../shared/gst';
import { HttpError, conflict, notFound } from '../lib/errors';
import { todayIST } from '../lib/dates';
import { assertLimit, audit, compliance } from './common';

export interface Issue {
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

/**
 * Pre-validation before anything is sent to the IRP / e-way bill portal (spec §8.6):
 * GSTIN format+checksum, HSN digits by turnover, Rule 46 numbering, document age, value thresholds.
 */
export async function prevalidateEInvoice(inv: InvoiceDoc, business: BusinessDoc): Promise<Issue[]> {
  const rules = await compliance();
  const issues: Issue[] = [];
  const err = (field: string, message: string) => issues.push({ field, message, severity: 'ERROR' });
  const warn = (field: string, message: string) => issues.push({ field, message, severity: 'WARNING' });

  if (!business.gstin || !isValidGstin(business.gstin)) err('seller.gstin', 'Your business GSTIN is missing or invalid');
  if (inv.kind !== 'TAX_INVOICE') err('kind', 'Bill of supply cannot be e-invoiced');
  if (inv.status === 'CANCELLED') err('status', 'Invoice is cancelled');
  if (!inv.partyGstin) err('buyer.gstin', 'e-Invoice applies to B2B: buyer GSTIN is required');
  else if (!isValidGstin(inv.partyGstin)) err('buyer.gstin', `Buyer GSTIN ${inv.partyGstin} fails format/checksum`);
  if (inv.partyGstin && inv.partyGstin.slice(0, 2) !== inv.partyStateCode) warn('buyer.state', 'Buyer state code does not match the first 2 digits of the GSTIN');
  if (!isValidDocNumber(inv.number, rules.invoiceNumberMaxLength)) err('number', 'Invoice number breaks Rule 46 (16 chars, letters/digits/-/)');
  if (inv.number !== inv.number.toUpperCase()) warn('number', 'Use upper-case invoice numbers for IRN');

  const minHsn = business.aatoBand === 'UPTO_5CR' ? rules.hsnDigitsUpto5Cr : rules.hsnDigitsAbove5Cr;
  inv.items.forEach((it, i) => {
    if (!/^\d+$/.test(it.hsnCode) || it.hsnCode.length < minHsn) err(`items.${i}.hsnCode`, `"${it.name}": HSN must have ${minHsn}+ digits`);
  });

  const age = daysBetween(inv.date, todayIST());
  if (business.aatoBand === 'ABOVE_10CR' && age > rules.irpReportingWindowDays) {
    err('date', `Invoice is ${age} days old. The IRP rejects uploads after ${rules.irpReportingWindowDays} days for AATO ≥ ₹10 Cr.`);
  } else if (business.aatoBand === 'ABOVE_10CR' && age > rules.irpReportingWindowDays - 5) {
    warn('date', `Only ${rules.irpReportingWindowDays - age} days left to report this invoice on the IRP`);
  }
  if (business.aatoBand === 'UPTO_5CR') warn('aato', `e-Invoicing is mandatory only above ₹${rules.eInvoiceAatoThresholdCr} Cr AATO`);
  return issues;
}

export async function prevalidateEWayBill(inv: InvoiceDoc, business: BusinessDoc, transport: { vehicleNumber?: string; distanceKm: number; transporterId?: string }) {
  const rules = await compliance();
  const issues: Issue[] = [];
  if (!business.gstin || !isValidGstin(business.gstin)) issues.push({ field: 'seller.gstin', message: 'Your business GSTIN is missing or invalid', severity: 'ERROR' });
  if (inv.status === 'CANCELLED') issues.push({ field: 'status', message: 'Invoice is cancelled', severity: 'ERROR' });
  if (inv.grandTotal <= rules.eWayBillThreshold) issues.push({ field: 'value', message: `Value is ₹${inv.grandTotal}: e-way bill is required only above ₹${rules.eWayBillThreshold}`, severity: 'WARNING' });
  const age = daysBetween(inv.date, todayIST());
  if (age > rules.eWayBillMaxDocAgeDays) issues.push({ field: 'date', message: `Document is ${age} days old; e-way bill allowed within ${rules.eWayBillMaxDocAgeDays} days`, severity: 'ERROR' });
  if (inv.items.every(i => i.hsnCode.startsWith('99'))) issues.push({ field: 'items', message: 'Services only (SAC 99xx): e-way bill is not needed', severity: 'ERROR' });
  if (!(transport.distanceKm >= 1 && transport.distanceKm <= 4000)) issues.push({ field: 'distanceKm', message: 'Distance must be 1–4000 km', severity: 'ERROR' });
  if (!transport.vehicleNumber && !transport.transporterId) issues.push({ field: 'vehicleNumber', message: 'Give a vehicle number (Part B) or a transporter ID', severity: 'ERROR' });
  if (transport.vehicleNumber && !/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(transport.vehicleNumber.replace(/[\s-]/g, '').toUpperCase())) {
    issues.push({ field: 'vehicleNumber', message: 'Vehicle number format looks wrong (e.g. DL01AB1234)', severity: 'ERROR' });
  }
  if (transport.transporterId && !(isValidGstin(transport.transporterId) || /^[0-9]{2}[A-Z0-9]{13}$/.test(transport.transporterId))) {
    issues.push({ field: 'transporterId', message: 'Transporter ID must be a GSTIN or 15-character TRANSIN', severity: 'ERROR' });
  }
  return issues;
}

function requireGsp() {
  if (config.GSP_MODE === 'disabled') {
    throw new HttpError(503, 'e-Invoice / e-Way bill provider (GSP) is not configured yet. Nothing was sent.', 'GSP_NOT_CONFIGURED');
  }
}

const fail = (issues: Issue[]) => {
  const errors = issues.filter(i => i.severity === 'ERROR');
  if (errors.length) throw new HttpError(422, 'Fix these before generating', 'PREVALIDATION_FAILED', issues);
};

export async function generateIrn(req: Request, invoiceId: string) {
  const business = req.business!;
  const inv = await Invoice.findOne({ _id: invoiceId, businessId: business._id }).lean<InvoiceDoc>();
  if (!inv) throw notFound('Invoice');
  if (inv.eInvoice?.status === 'GENERATED') throw conflict('IRN already generated');
  const issues = await prevalidateEInvoice(inv, business);
  fail(issues);
  await assertLimit(business, 'eInvoice');
  requireGsp();

  // GSP_MODE=mock (development only): IRN follows the real formula, SHA-256(GSTIN + FY + doc type + number),
  // but the record is flagged mock and "MOCK" is printed so it is never mistaken for a valid IRN.
  const irn = crypto.createHash('sha256').update(`${business.gstin}${fyLabel(inv.date)}INV${inv.number}`).digest('hex');
  const ackNo = 'MOCK' + Date.now().toString().slice(-11);
  const ackDate = new Date().toISOString();
  await Invoice.updateOne(
    { _id: inv._id },
    { eInvoice: { status: 'GENERATED', irn, ackNo, ackDate, signedQr: `MOCK|${business.gstin}|${inv.partyGstin}|${inv.number}|${inv.grandTotal}|${irn.slice(0, 16)}`, mock: true } }
  );
  await audit(req, 'EINVOICE_GENERATE', `${inv.number} · MOCK IRN ${irn.slice(0, 12)}…`, 'WARNING');
  return { irn, ackNo, ackDate, mock: true, warnings: issues };
}

export async function cancelIrn(req: Request, invoiceId: string, reason: string) {
  const business = req.business!;
  const rules = await compliance();
  const inv = await Invoice.findOne({ _id: invoiceId, businessId: business._id });
  if (!inv) throw notFound('Invoice');
  if (inv.eInvoice?.status !== 'GENERATED') throw conflict('No active IRN on this invoice');
  const hours = (Date.now() - new Date(inv.eInvoice.ackDate!).getTime()) / 3600000;
  if (hours > rules.irnCancelWindowHours) throw conflict(`IRN can only be cancelled within ${rules.irnCancelWindowHours} hours. Issue a credit note instead.`);
  requireGsp();
  inv.eInvoice.status = 'CANCELLED';
  await inv.save();
  await audit(req, 'EINVOICE_CANCEL', `${inv.number} · ${reason}`, 'WARNING');
  return inv.toObject();
}

export async function generateEWayBill(req: Request, invoiceId: string, transport: { vehicleNumber?: string; distanceKm: number; transporterId?: string }) {
  const business = req.business!;
  const inv = await Invoice.findOne({ _id: invoiceId, businessId: business._id }).lean<InvoiceDoc>();
  if (!inv) throw notFound('Invoice');
  if (inv.eWayBill?.status === 'GENERATED') throw conflict('e-Way bill already generated');
  const issues = await prevalidateEWayBill(inv, business, transport);
  fail(issues);
  await assertLimit(business, 'eWayBill');
  requireGsp();
  // validity: 1 day per 200 km for regular cargo
  const days = Math.max(1, Math.ceil(transport.distanceKm / 200));
  const validUpto = new Date(Date.now() + days * 86400000).toISOString();
  const number = 'MOCK' + String(Date.now()).slice(-8);
  await Invoice.updateOne(
    { _id: inv._id },
    { eWayBill: { status: 'GENERATED', number, validUpto, vehicleNumber: transport.vehicleNumber?.toUpperCase(), transporterId: transport.transporterId, distanceKm: transport.distanceKm, mock: true } }
  );
  await audit(req, 'EWAY_GENERATE', `${inv.number} · MOCK EWB ${number}`, 'WARNING');
  return { number, validUpto, mock: true, warnings: issues };
}
