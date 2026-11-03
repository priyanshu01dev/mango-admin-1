import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { ah, badRequest, notFound } from '../lib/errors';
import { allow, BOOKS, MANAGE, READ } from '../middleware/auth';
import { RecurringInvoice } from '../models/phase2';
import { Expense, Invoice, Party, Payment, Product, TradeDocument } from '../models/billing';
import { Business } from '../models/core';
import { runDueRecurring } from '../services/recurring';
import { audit } from '../services/common';
import { isoDate, todayIST } from '../lib/dates';
import { r2 } from '../../../shared/gst';

/** Phase 2 (spec P1): recurring invoices, books of account, GSTR-2B reconciliation, public links, Tally export. */
export const phase2Router = Router();

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

// ---------------- recurring invoices ----------------

phase2Router.get('/recurring', allow(...READ), ah(async (req, res) => res.json(await RecurringInvoice.find({ businessId: req.business!._id }).sort({ nextRunOn: 1 }).lean())));

phase2Router.post(
  '/recurring',
  allow(...MANAGE),
  ah(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(2).max(80),
        partyId: z.string(),
        items: z.array(line).min(1).max(100),
        frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
        startOn: z.string().regex(isoDate),
        endsOn: z.string().regex(isoDate).or(z.literal('')).optional(),
        dueDays: z.number().int().min(0).max(180).optional(),
        notes: z.string().max(500).optional()
      })
      .parse(req.body);
    const party = await Party.findOne({ _id: body.partyId, businessId: req.business!._id, type: 'CUSTOMER' }).lean();
    if (!party) throw notFound('Customer');
    if (body.startOn < todayIST()) throw badRequest('Start date cannot be in the past');
    const r = await RecurringInvoice.create({ ...body, businessId: req.business!._id, partyName: party.name, nextRunOn: body.startOn, createdBy: req.user!._id });
    await audit(req, 'RECURRING_CREATE', `${r.name} · ${r.frequency} from ${r.nextRunOn} for ${party.name}`);
    res.status(201).json(r);
  })
);

phase2Router.patch(
  '/recurring/:id',
  allow(...MANAGE),
  ah(async (req, res) => {
    const body = z.object({ active: z.boolean().optional(), endsOn: z.string().regex(isoDate).or(z.literal('')).optional(), nextRunOn: z.string().regex(isoDate).optional() }).parse(req.body);
    if (body.nextRunOn && body.nextRunOn < todayIST()) throw badRequest('Next run cannot be in the past');
    const r = await RecurringInvoice.findOneAndUpdate({ _id: req.params.id, businessId: req.business!._id }, { ...body, ...(body.active ? { lastError: '' } : {}) }, { new: true });
    if (!r) throw notFound('Recurring profile');
    res.json(r);
  })
);

/** Raise everything due now for this business (the server also runs this every hour). */
phase2Router.post('/recurring/run', allow(...MANAGE), ah(async (req, res) => res.json(await runDueRecurring(String(req.business!._id)))));

// ---------------- books of account ----------------

const range = (q: Record<string, unknown>) => {
  const today = todayIST();
  const fyStart = (Number(today.slice(5, 7)) >= 4 ? today.slice(0, 4) : String(Number(today.slice(0, 4)) - 1)) + '-04-01';
  return { from: z.string().regex(isoDate).parse(q.from ?? fyStart), to: z.string().regex(isoDate).parse(q.to ?? today) };
};

phase2Router.patch(
  '/books/opening',
  allow(...MANAGE),
  ah(async (req, res) => {
    const body = z.object({ cash: z.number(), bank: z.number(), capital: z.number().optional(), asOn: z.string().regex(isoDate) }).parse(req.body);
    await Business.updateOne({ _id: req.business!._id }, { openingBalances: body });
    await audit(req, 'OPENING_BALANCES', `Cash ₹${body.cash}, bank ₹${body.bank} as on ${body.asOn}`);
    res.json(body);
  })
);

/**
 * Cash book (mode CASH) or bank book (UPI, NEFT/RTGS, cheque, card) with running balance.
 * Built from payments and expenses; opening balance from Books → Opening balances.
 */
phase2Router.get(
  '/books/:book(cash|bank)',
  allow(...BOOKS),
  ah(async (req, res) => {
    const { from, to } = range(req.query);
    const b = req.business!._id;
    const isCash = req.params.book === 'cash';
    const modeFilter = isCash ? 'CASH' : { $ne: 'CASH' };
    const opening = ((req.business as { openingBalances?: { cash?: number; bank?: number } }).openingBalances ?? {})[isCash ? 'cash' : 'bank'] ?? 0;
    const [payBefore, expBefore, pays, exps] = await Promise.all([
      Payment.aggregate([{ $match: { businessId: b, mode: modeFilter, date: { $lt: from } } }, { $group: { _id: '$type', t: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $match: { businessId: b, mode: modeFilter, date: { $lt: from } } }, { $group: { _id: null, t: { $sum: '$total' } } }]),
      Payment.find({ businessId: b, mode: modeFilter, date: { $gte: from, $lte: to } }).sort({ date: 1, createdAt: 1 }).lean(),
      Expense.find({ businessId: b, mode: modeFilter, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean()
    ]);
    const before = (payBefore.find(p => p._id === 'PAYMENT_IN')?.t ?? 0) - (payBefore.find(p => p._id === 'PAYMENT_OUT')?.t ?? 0) - (expBefore[0]?.t ?? 0);
    const openingForPeriod = r2(opening + before);
    const rows = [
      ...pays.map(p => ({ date: p.date, particulars: `${p.type === 'PAYMENT_IN' ? 'Received from' : 'Paid to'} ${p.partyName ?? ''}`, ref: p.reference || p.refNumber || '', mode: p.mode, receipt: p.type === 'PAYMENT_IN' ? p.amount : 0, payment: p.type === 'PAYMENT_OUT' ? p.amount : 0 })),
      ...exps.map(e => ({ date: e.date, particulars: `${e.category} · ${e.vendorName}`, ref: e.number, mode: e.mode, receipt: 0, payment: e.total }))
    ].sort((a, c) => a.date.localeCompare(c.date));
    let bal = openingForPeriod;
    const withBal = rows.map(r => ({ ...r, balance: (bal = r2(bal + r.receipt - r.payment)) }));
    res.json({ book: req.params.book, from, to, opening: openingForPeriod, rows: withBal, receipts: r2(rows.reduce((a, r) => a + r.receipt, 0)), payments: r2(rows.reduce((a, r) => a + r.payment, 0)), closing: bal });
  })
);

/**
 * Simplified financial statements derived from the transaction data (not a full double-entry ledger):
 * balance sheet, trial balance and cash flow. The owner's capital is the balancing figure.
 */
phase2Router.get(
  '/books/statements',
  allow(...BOOKS),
  ah(async (req, res) => {
    const { from, to } = range(req.query);
    const b = req.business!._id;
    const opening = (req.business as { openingBalances?: { cash?: number; bank?: number; capital?: number } }).openingBalances ?? {};
    const [parties, products, invoices, docs, payments, expenses] = await Promise.all([
      Party.find({ businessId: b }).lean(),
      Product.find({ businessId: b }, { stock: 1, purchasePrice: 1 }).lean(),
      Invoice.find({ businessId: b, status: { $ne: 'CANCELLED' }, date: { $lte: to } }).lean(),
      TradeDocument.find({ businessId: b, docType: { $in: ['PURCHASE_BILL', 'CREDIT_NOTE', 'DEBIT_NOTE'] }, status: { $ne: 'CANCELLED' }, date: { $lte: to } }).lean(),
      Payment.find({ businessId: b, date: { $lte: to } }).lean(),
      Expense.find({ businessId: b, date: { $lte: to } }).lean()
    ]);
    const sum = <T>(rows: T[], f: (r: T) => number) => r2(rows.reduce((a, r) => a + (f(r) || 0), 0));
    const inPeriod = (d: string) => d >= from && d <= to;
    const bills = docs.filter(d => d.docType === 'PURCHASE_BILL');
    const cns = docs.filter(d => d.docType === 'CREDIT_NOTE');
    const dns = docs.filter(d => d.docType === 'DEBIT_NOTE');

    const debtors = sum(parties.filter(p => p.balance > 0), p => p.balance);
    const creditors = sum(parties.filter(p => p.balance < 0), p => -p.balance);
    const stock = sum(products, p => (p.stock ?? 0) * (p.purchasePrice ?? 0));
    const cashFlow = (mode: 'cash' | 'bank') => {
      const m = (x: string) => (mode === 'cash' ? x === 'CASH' : x !== 'CASH');
      return r2((opening[mode] ?? 0) + sum(payments.filter(p => m(p.mode)), p => (p.type === 'PAYMENT_IN' ? p.amount : -p.amount)) - sum(expenses.filter(e => m(e.mode)), e => e.total));
    };
    const cash = cashFlow('cash');
    const bank = cashFlow('bank');
    const outputGst = r2(sum(invoices, i => i.totalGst ?? 0) - sum(cns, c => c.totalGst ?? 0));
    const inputGst = r2(sum(bills.filter(x => x.itcEligible), x => x.totalGst ?? 0) - sum(dns, x => x.totalGst ?? 0) + sum(expenses.filter(e => e.itcEligible), e => e.gstAmount ?? 0));
    const tcsCollected = sum(invoices, i => (i as { tcsAmount?: number }).tcsAmount ?? 0);
    const tdsReceivable = sum(payments, p => (p as { tdsAmount?: number }).tdsAmount ?? 0);
    const gstPayable = r2(outputGst - inputGst);

    const sales = r2(sum(invoices, i => i.taxableTotal ?? 0) - sum(cns, c => c.taxableTotal ?? 0));
    const purchases = r2(sum(bills, x => x.taxableTotal ?? 0) - sum(dns, x => x.taxableTotal ?? 0));
    const expenseTotal = sum(expenses, e => e.amount + (e.itcEligible ? 0 : e.gstAmount ?? 0));

    const assets = { debtors, stock, cash, bank, gstReceivable: gstPayable < 0 ? -gstPayable : 0, tdsReceivable };
    const liabilities = { creditors, gstPayable: gstPayable > 0 ? gstPayable : 0, tcsPayable: tcsCollected };
    const totalAssets = r2(Object.values(assets).reduce((a, v) => a + v, 0));
    const totalLiabilities = r2(Object.values(liabilities).reduce((a, v) => a + v, 0));
    const ownersEquity = r2(totalAssets - totalLiabilities);

    const trial = [
      { account: 'Sundry debtors', dr: debtors, cr: 0 },
      { account: 'Closing stock', dr: stock, cr: 0 },
      { account: 'Cash in hand', dr: Math.max(0, cash), cr: Math.max(0, -cash) },
      { account: 'Bank', dr: Math.max(0, bank), cr: Math.max(0, -bank) },
      { account: 'Input GST (ITC)', dr: inputGst, cr: 0 },
      { account: 'TDS receivable', dr: tdsReceivable, cr: 0 },
      { account: 'Purchases', dr: purchases, cr: 0 },
      { account: 'Expenses', dr: expenseTotal, cr: 0 },
      { account: 'Sundry creditors', dr: 0, cr: creditors },
      { account: 'Output GST', dr: 0, cr: outputGst },
      { account: 'TCS payable', dr: 0, cr: tcsCollected },
      { account: 'Sales', dr: 0, cr: sales }
    ];
    const drTotal = r2(trial.reduce((a, t) => a + t.dr, 0));
    const crTotal = r2(trial.reduce((a, t) => a + t.cr, 0));
    trial.push({ account: "Capital / opening balances (balancing)", dr: crTotal > drTotal ? r2(crTotal - drTotal) : 0, cr: drTotal > crTotal ? r2(drTotal - crTotal) : 0 });

    const periodPays = payments.filter(p => inPeriod(p.date));
    const periodExp = expenses.filter(e => inPeriod(e.date));
    const cashFlowStatement = {
      receiptsFromCustomers: sum(periodPays.filter(p => p.type === 'PAYMENT_IN'), p => p.amount),
      paymentsToSuppliers: sum(periodPays.filter(p => p.type === 'PAYMENT_OUT'), p => p.amount),
      expensesPaid: sum(periodExp, e => e.total),
      byCategory: Object.entries(periodExp.reduce<Record<string, number>>((m, e) => ({ ...m, [e.category]: r2((m[e.category] ?? 0) + e.total) }), {})).map(([category, amount]) => ({ category, amount }))
    };
    res.json({
      asOn: to,
      from,
      balanceSheet: { assets, totalAssets, liabilities, totalLiabilities, ownersEquity },
      trialBalance: { rows: trial, total: r2(Math.max(drTotal, crTotal)) },
      cashFlow: { ...cashFlowStatement, netOperating: r2(cashFlowStatement.receiptsFromCustomers - cashFlowStatement.paymentsToSuppliers - cashFlowStatement.expensesPaid) },
      note: 'Derived from invoices, bills, payments, expenses and stock at purchase price. GST and TDS settlements made outside the app are not included. Review with your CA before filing.'
    });
  })
);

// ---------------- GSTR-2B reconciliation ----------------

// "VS/0042", "vs-42" and "VS 42" are the same invoice: ignore case, separators and zero padding
const normInv = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/(^|[A-Z])0+(?=\d)/g, '$1');

/**
 * Matches the GSTR-2B JSON downloaded from the GST portal against purchase bills (supplier GSTIN +
 * invoice number), so ITC is claimed only on invoices the supplier has reported.
 */
phase2Router.post(
  '/gstr2b/reconcile',
  allow(...BOOKS),
  ah(async (req, res) => {
    const body = req.body as { data?: { docdata?: { b2b?: unknown[] }; rtnprd?: string; gstin?: string } };
    const b2b = (body?.data?.docdata?.b2b ?? []) as { ctin: string; trdnm?: string; inv: { inum: string; dt: string; val: number; itcavl?: string; items?: { txval?: number; igst?: number; cgst?: number; sgst?: number }[] }[] }[];
    if (!Array.isArray(b2b)) throw badRequest('Not a GSTR-2B JSON file (data.docdata.b2b missing)');
    const period = body.data?.rtnprd ?? '';
    const bills = await TradeDocument.find({ businessId: req.business!._id, docType: 'PURCHASE_BILL', status: { $ne: 'CANCELLED' } }).lean();
    const byKey = new Map(bills.map(x => [`${x.partyGstin}|${normInv(x.reference || x.number)}`, x]));
    const used = new Set<string>();
    const rows: { status: 'MATCHED' | 'MISMATCH' | 'MISSING_IN_BOOKS' | 'MISSING_IN_2B'; supplierGstin: string; supplier: string; invoiceNo: string; date: string; value2b?: number; valueBooks?: number; tax2b?: number; taxBooks?: number; itcAvailable?: boolean; billId?: string }[] = [];
    for (const sup of b2b) {
      for (const inv of sup.inv ?? []) {
        const key = `${sup.ctin}|${normInv(inv.inum)}`;
        const tax2b = r2((inv.items ?? []).reduce((a, i) => a + (i.igst ?? 0) + (i.cgst ?? 0) + (i.sgst ?? 0), 0));
        const bill = byKey.get(key);
        if (!bill) {
          rows.push({ status: 'MISSING_IN_BOOKS', supplierGstin: sup.ctin, supplier: sup.trdnm ?? '', invoiceNo: inv.inum, date: inv.dt, value2b: inv.val, tax2b, itcAvailable: inv.itcavl !== 'N' });
          continue;
        }
        used.add(key);
        const close = Math.abs((bill.grandTotal ?? 0) - inv.val) <= 1 && Math.abs((bill.totalGst ?? 0) - tax2b) <= 1;
        rows.push({ status: close ? 'MATCHED' : 'MISMATCH', supplierGstin: sup.ctin, supplier: bill.partyName, invoiceNo: inv.inum, date: inv.dt, value2b: inv.val, valueBooks: bill.grandTotal, tax2b, taxBooks: bill.totalGst, itcAvailable: inv.itcavl !== 'N', billId: String(bill._id) });
      }
    }
    // bills in this period's books the supplier has not reported: ITC at risk
    const [y, m] = period.length === 6 ? [period.slice(2), period.slice(0, 2)] : ['', ''];
    for (const x of bills) {
      const key = `${x.partyGstin}|${normInv(x.reference || x.number)}`;
      if (used.has(key) || !x.partyGstin || !x.itcEligible) continue;
      if (y && x.date.slice(0, 7) !== `${y}-${m}`) continue;
      rows.push({ status: 'MISSING_IN_2B', supplierGstin: x.partyGstin, supplier: x.partyName, invoiceNo: x.reference || x.number, date: x.date, valueBooks: x.grandTotal, taxBooks: x.totalGst, billId: String(x._id) });
    }
    const count = (s: string) => rows.filter(r => r.status === s).length;
    const itcAtRisk = r2(rows.filter(r => r.status === 'MISSING_IN_2B').reduce((a, r) => a + (r.taxBooks ?? 0), 0));
    await audit(req, 'GSTR2B_RECONCILE', `${period}: ${count('MATCHED')} matched, ${count('MISMATCH')} mismatched, ${count('MISSING_IN_2B')} missing in 2B`);
    res.json({ period, summary: { matched: count('MATCHED'), mismatch: count('MISMATCH'), missingInBooks: count('MISSING_IN_BOOKS'), missingIn2b: count('MISSING_IN_2B'), itcAtRisk }, rows });
  })
);

// ---------------- public invoice link ----------------

phase2Router.post(
  '/invoices/:id/share',
  allow(...READ),
  ah(async (req, res) => {
    const inv = await Invoice.findOne({ _id: req.params.id, businessId: req.business!._id });
    if (!inv) throw notFound('Invoice');
    if (!(inv as { publicToken?: string }).publicToken) {
      await Invoice.updateOne({ _id: inv._id }, { publicToken: crypto.randomBytes(18).toString('base64url') });
    }
    const fresh = await Invoice.findById(inv._id).lean<{ publicToken: string }>();
    res.json({ token: fresh!.publicToken, path: `/i/${fresh!.publicToken}` });
  })
);

// ---------------- Tally export ----------------

const xml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const tallyDate = (iso: string) => iso.replace(/-/g, '');

/** Sales, purchase, receipt and payment vouchers as Tally XML (Import Data → Vouchers). */
phase2Router.get(
  '/tally/vouchers.xml',
  allow(...BOOKS),
  ah(async (req, res) => {
    const { from, to } = range(req.query);
    const b = req.business!._id;
    const [invoices, bills, payments] = await Promise.all([
      Invoice.find({ businessId: b, status: { $ne: 'CANCELLED' }, date: { $gte: from, $lte: to } }).lean(),
      TradeDocument.find({ businessId: b, docType: 'PURCHASE_BILL', status: { $ne: 'CANCELLED' }, date: { $gte: from, $lte: to } }).lean(),
      Payment.find({ businessId: b, date: { $gte: from, $lte: to } }).lean()
    ]);
    // Tally: negative AMOUNT = debit, positive = credit; ISDEEMEDPOSITIVE=Yes for debits
    const entry = (ledger: string, amount: number) =>
      `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xml(ledger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${amount < 0 ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE><AMOUNT>${r2(amount).toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`;
    const voucher = (type: string, date: string, number: string, party: string, entries: string[], narration: string) =>
      `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="${type}" ACTION="Create"><DATE>${tallyDate(date)}</DATE><VOUCHERTYPENAME>${type}</VOUCHERTYPENAME><VOUCHERNUMBER>${xml(number)}</VOUCHERNUMBER><PARTYLEDGERNAME>${xml(party)}</PARTYLEDGERNAME><NARRATION>${xml(narration)}</NARRATION>${entries.join('')}</VOUCHER></TALLYMESSAGE>`;
    const gst = (t: { cgstTotal?: number | null; sgstTotal?: number | null; igstTotal?: number | null }, side: 'Output' | 'Input', sign: 1 | -1) =>
      [t.cgstTotal ? entry(`${side} CGST`, sign * t.cgstTotal) : '', t.sgstTotal ? entry(`${side} SGST`, sign * t.sgstTotal) : '', t.igstTotal ? entry(`${side} IGST`, sign * t.igstTotal) : ''];
    const msgs = [
      ...invoices.map(i => {
        const tcs = (i as { tcsAmount?: number }).tcsAmount ?? 0;
        return voucher('Sales', i.date, i.number, i.partyName, [entry(i.partyName, -i.grandTotal), entry('Sales', i.taxableTotal), ...gst(i, 'Output', 1), tcs ? entry('TCS Payable', tcs) : '', i.roundOff ? entry('Round Off', i.roundOff) : ''], `Invoice ${i.number}`);
      }),
      ...bills.map(x => voucher('Purchase', x.date, x.reference || x.number, x.partyName, [entry(x.partyName, x.grandTotal), entry('Purchase', -x.taxableTotal), ...gst(x, 'Input', -1), x.roundOff ? entry('Round Off', -x.roundOff) : ''], `Bill ${x.reference || x.number}`)),
      ...payments.map(p => {
        const ledger = p.mode === 'CASH' ? 'Cash' : 'Bank';
        const party = p.partyName || 'Cash Sales';
        return p.type === 'PAYMENT_IN'
          ? voucher('Receipt', p.date, p.reference || String(p._id).slice(-6), party, [entry(ledger, -p.amount), entry(party, p.amount)], `Receipt ${p.refNumber ?? ''}`)
          : voucher('Payment', p.date, p.reference || String(p._id).slice(-6), party, [entry(party, -p.amount), entry(ledger, p.amount)], `Payment ${p.refNumber ?? ''}`);
      })
    ];
    const company = req.business!.name;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tally-vouchers-${from}-to-${to}.xml"`);
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${xml(company)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>
${msgs.join('\n')}
</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`);
  })
);
