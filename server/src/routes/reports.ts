import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../lib/errors';
import { Expense, Invoice, Party, Payment, Product, TradeDocument } from '../models/billing';
import { allow, BOOKS, READ } from '../middleware/auth';
import { compliance } from '../services/common';
import { r2, daysBetween } from '../../../shared/gst';
import { todayIST, isoDate } from '../lib/dates';

export const reportsRouter = Router();

const sum = <T>(rows: T[], f: (r: T) => number) => r2(rows.reduce((a, r) => a + (f(r) || 0), 0));
const period = (q: Record<string, unknown>) => {
  const p = z.string().regex(/^\d{4}-\d{2}$/).parse(q.period ?? todayIST().slice(0, 7));
  const [y, m] = p.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${p}-01`, to: `${p}-${String(last).padStart(2, '0')}`, label: p };
};
const span = (q: Record<string, unknown>) => {
  const today = todayIST();
  const fyStart = (Number(today.slice(5, 7)) >= 4 ? today.slice(0, 4) : String(Number(today.slice(0, 4)) - 1)) + '-04-01';
  return { from: z.string().regex(isoDate).parse(q.from ?? fyStart), to: z.string().regex(isoDate).parse(q.to ?? today) };
};

/** GSTR-1 sections: B2B, B2CL, B2CS, CDNR, CDNUR and HSN summary. */
reportsRouter.get(
  '/gstr1',
  allow(...BOOKS),
  ah(async (req, res) => {
    const { from, to, label } = period(req.query);
    const rules = await compliance();
    const b = req.business!._id;
    const invoices = await Invoice.find({ businessId: b, kind: 'TAX_INVOICE', status: { $ne: 'CANCELLED' }, date: { $gte: from, $lte: to } }).lean();
    const notes = await TradeDocument.find({ businessId: b, docType: 'CREDIT_NOTE', status: { $ne: 'CANCELLED' }, date: { $gte: from, $lte: to } }).lean();

    const b2b = invoices.filter(i => i.partyGstin);
    const b2cl = invoices.filter(i => !i.partyGstin && i.isInterState && i.grandTotal > rules.b2clInvoiceThreshold);
    const b2cs = invoices.filter(i => !i.partyGstin && !b2cl.includes(i));

    // B2CS is reported by place of supply + rate
    const b2csRows: Record<string, { placeOfSupply: string; rate: number; taxable: number; igst: number; cgst: number; sgst: number }> = {};
    for (const i of b2cs)
      for (const it of i.items) {
        const k = `${i.placeOfSupply}|${it.gstRate}`;
        b2csRows[k] ??= { placeOfSupply: i.placeOfSupply, rate: it.gstRate, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
        const row = b2csRows[k];
        row.taxable = r2(row.taxable + (it.taxableAmount ?? 0));
        row.igst = r2(row.igst + (it.igstAmount ?? 0));
        row.cgst = r2(row.cgst + (it.cgstAmount ?? 0));
        row.sgst = r2(row.sgst + (it.sgstAmount ?? 0));
      }

    const hsn: Record<string, { hsn: string; description: string; uqc: string; qty: number; value: number; taxable: number; igst: number; cgst: number; sgst: number }> = {};
    for (const i of invoices)
      for (const it of i.items) {
        const k = `${it.hsnCode}|${it.gstRate}`;
        hsn[k] ??= { hsn: it.hsnCode, description: it.name, uqc: it.unit ?? 'NOS', qty: 0, value: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
        const h = hsn[k];
        h.qty += it.quantity;
        h.value = r2(h.value + (it.totalAmount ?? 0));
        h.taxable = r2(h.taxable + (it.taxableAmount ?? 0));
        h.igst = r2(h.igst + (it.igstAmount ?? 0));
        h.cgst = r2(h.cgst + (it.cgstAmount ?? 0));
        h.sgst = r2(h.sgst + (it.sgstAmount ?? 0));
      }

    const inv = (i: (typeof invoices)[number]) => ({ number: i.number, date: i.date, gstin: i.partyGstin, name: i.partyName, placeOfSupply: i.placeOfSupply, reverseCharge: i.reverseCharge, value: i.grandTotal, taxable: i.taxableTotal, igst: i.igstTotal, cgst: i.cgstTotal, sgst: i.sgstTotal });
    const note = (n: (typeof notes)[number]) => ({ number: n.number, date: n.date, gstin: n.partyGstin, name: n.partyName, against: n.reference, value: n.grandTotal, taxable: n.taxableTotal, igst: n.igstTotal, cgst: n.cgstTotal, sgst: n.sgstTotal });

    res.json({
      period: label,
      gstin: req.business!.gstin,
      b2b: b2b.map(inv),
      b2cl: b2cl.map(inv),
      b2cs: Object.values(b2csRows),
      cdnr: notes.filter(n => n.partyGstin).map(note),
      cdnur: notes.filter(n => !n.partyGstin).map(note),
      hsn: Object.values(hsn),
      docs: { invoicesIssued: invoices.length, cancelled: await Invoice.countDocuments({ businessId: b, status: 'CANCELLED', date: { $gte: from, $lte: to } }) },
      note: 'Verify the B2CL threshold and HSN-wise reporting rules against the latest GSTN advisory before filing.'
    });
  })
);

/** GSTR-3B: Table 3.1 outward liability (net of credit notes) and Table 4 eligible ITC. */
reportsRouter.get(
  '/gstr3b',
  allow(...BOOKS),
  ah(async (req, res) => {
    const { from, to, label } = period(req.query);
    const b = req.business!._id;
    const inRange = { $gte: from, $lte: to };
    const [invoices, docs, expenses] = await Promise.all([
      Invoice.find({ businessId: b, kind: 'TAX_INVOICE', status: { $ne: 'CANCELLED' }, date: inRange }).lean(),
      TradeDocument.find({ businessId: b, docType: { $in: ['CREDIT_NOTE', 'PURCHASE_BILL', 'DEBIT_NOTE'] }, status: { $ne: 'CANCELLED' }, date: inRange }).lean(),
      Expense.find({ businessId: b, itcEligible: true, date: inRange }).lean()
    ]);
    const outward = invoices.filter(i => !i.reverseCharge);
    const cn = docs.filter(d => d.docType === 'CREDIT_NOTE');
    const bills = docs.filter(d => d.docType === 'PURCHASE_BILL' && d.itcEligible);
    // a debit note reverses ITC only if the bill it is against was ITC-eligible
    const eligibleBills = new Set(
      (await TradeDocument.find({ businessId: b, docType: 'PURCHASE_BILL', itcEligible: true, status: { $ne: 'CANCELLED' } }, { number: 1 }).lean()).map(x => x.number)
    );
    const dn = docs.filter(d => d.docType === 'DEBIT_NOTE' && eligibleBills.has(d.reference ?? ''));
    const tax = <T extends { igstTotal?: number | null; cgstTotal?: number | null; sgstTotal?: number | null; taxableTotal?: number | null }>(rows: T[]) => ({
      taxable: sum(rows, r => r.taxableTotal ?? 0),
      igst: sum(rows, r => r.igstTotal ?? 0),
      cgst: sum(rows, r => r.cgstTotal ?? 0),
      sgst: sum(rows, r => r.sgstTotal ?? 0)
    });
    const out = tax(outward);
    const less = tax(cn);
    const liability = { igst: r2(out.igst - less.igst), cgst: r2(out.cgst - less.cgst), sgst: r2(out.sgst - less.sgst) };
    // expenses are intra-state input by default: split GST equally
    const expGst = sum(expenses, e => e.gstAmount ?? 0);
    const itcBills = tax(bills);
    const itcDn = tax(dn);
    const itc = { igst: r2(itcBills.igst - itcDn.igst), cgst: r2(itcBills.cgst - itcDn.cgst + expGst / 2), sgst: r2(itcBills.sgst - itcDn.sgst + expGst / 2) };

    // set-off order (simplified): IGST credit → IGST, CGST, SGST; CGST → CGST; SGST → SGST
    let igstCredit = itc.igst;
    const pay = { igst: liability.igst, cgst: liability.cgst, sgst: liability.sgst };
    for (const k of ['igst', 'cgst', 'sgst'] as const) {
      const use = Math.min(igstCredit, pay[k]);
      pay[k] = r2(pay[k] - use);
      igstCredit = r2(igstCredit - use);
    }
    const cgstUse = Math.min(itc.cgst, pay.cgst);
    const sgstUse = Math.min(itc.sgst, pay.sgst);
    pay.cgst = r2(pay.cgst - cgstUse);
    pay.sgst = r2(pay.sgst - sgstUse);

    res.json({
      period: label,
      table31a: out,
      creditNotes: less,
      reverseChargeInvoices: invoices.length - outward.length,
      table4: { fromPurchaseBills: itcBills, lessDebitNotes: itcDn, fromExpenses: expGst, eligible: itc },
      netLiability: liability,
      payableInCash: { ...pay, total: r2(pay.igst + pay.cgst + pay.sgst) },
      carryForward: { igst: igstCredit, cgst: r2(itc.cgst - cgstUse), sgst: r2(itc.sgst - sgstUse) },
      note: 'Match ITC with GSTR-2B / IMS before claiming. Cash ledger figures exclude interest and late fees.'
    });
  })
);

/** Profit & loss: net sales − cost of goods sold (at purchase price) − expenses. */
reportsRouter.get(
  '/pnl',
  allow(...BOOKS),
  ah(async (req, res) => {
    const { from, to } = span(req.query);
    const b = req.business!._id;
    const inRange = { $gte: from, $lte: to };
    const [invoices, notes, expenses, products, bills] = await Promise.all([
      Invoice.find({ businessId: b, status: { $ne: 'CANCELLED' }, date: inRange }).lean(),
      TradeDocument.find({ businessId: b, docType: 'CREDIT_NOTE', status: { $ne: 'CANCELLED' }, date: inRange }).lean(),
      Expense.find({ businessId: b, date: inRange }).lean(),
      Product.find({ businessId: b }, { purchasePrice: 1 }).lean(),
      TradeDocument.find({ businessId: b, docType: 'PURCHASE_BILL', status: { $ne: 'CANCELLED' }, date: inRange }).lean()
    ]);
    const cost = new Map(products.map(p => [String(p._id), p.purchasePrice ?? 0]));
    const cogsOf = (items: { productId?: unknown; quantity: number }[]) => items.reduce((a, it) => a + it.quantity * (cost.get(String(it.productId)) ?? 0), 0);
    const sales = sum(invoices, i => i.taxableTotal ?? 0);
    const returns = sum(notes, n => n.taxableTotal ?? 0);
    const cogs = r2(invoices.reduce((a, i) => a + cogsOf(i.items), 0) - notes.filter(n => n.restock).reduce((a, n) => a + cogsOf(n.items), 0));
    const byCategory: Record<string, number> = {};
    // GST on an expense is a cost only when ITC is not claimed
    for (const e of expenses) byCategory[e.category] = r2((byCategory[e.category] ?? 0) + e.amount + (e.itcEligible ? 0 : e.gstAmount ?? 0));
    const totalExpenses = r2(Object.values(byCategory).reduce((a, v) => a + v, 0));
    const netSales = r2(sales - returns);
    const grossProfit = r2(netSales - cogs);
    res.json({ from, to, sales, returns, netSales, cogs, grossProfit, expenses: byCategory, totalExpenses, netProfit: r2(grossProfit - totalExpenses), purchases: sum(bills, x => x.taxableTotal ?? 0) });
  })
);

/** Receivables (invoices) or payables (purchase bills) by days overdue. */
reportsRouter.get(
  '/ageing',
  allow(...BOOKS),
  ah(async (req, res) => {
    const kind = z.enum(['receivables', 'payables']).parse(req.query.kind ?? 'receivables');
    const today = todayIST();
    const b = req.business!._id;
    const rows =
      kind === 'receivables'
        ? (await Invoice.find({ businessId: b, status: { $in: ['UNPAID', 'PARTIALLY_PAID'] }, balanceDue: { $gt: 0 } }).lean()).map(i => ({ id: i._id, partyId: i.partyId, party: i.partyName, phone: i.partyPhone, number: i.number, date: i.date, due: i.dueDate ?? i.date, amount: i.balanceDue }))
        : (await TradeDocument.find({ businessId: b, docType: 'PURCHASE_BILL', status: { $in: ['UNPAID', 'PARTIALLY_PAID'] } }).lean()).map(d => ({ id: d._id, partyId: d.partyId, party: d.partyName, phone: d.partyPhone, number: d.reference || d.number, date: d.date, due: d.dueDate ?? d.date, amount: r2(d.grandTotal - d.amountPaid - (d.adjustedAmount ?? 0)) }));
    const bucket = (due: string) => {
      const late = daysBetween(due, today);
      return late <= 0 ? 'NOT_DUE' : late <= 30 ? '1_30' : late <= 60 ? '31_60' : late <= 90 ? '61_90' : '90_PLUS';
    };
    const withBucket = rows.filter(r => r.amount > 0).map(r => ({ ...r, daysOverdue: Math.max(0, daysBetween(r.due, today)), bucket: bucket(r.due) }));
    const totals: Record<string, number> = { NOT_DUE: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_PLUS': 0 };
    for (const r of withBucket) totals[r.bucket] = r2(totals[r.bucket] + r.amount);
    res.json({ kind, asOn: today, totals, total: sum(withBucket, r => r.amount), rows: withBucket.sort((a, b) => b.daysOverdue - a.daysOverdue) });
  })
);

reportsRouter.get(
  '/daybook',
  allow(...BOOKS),
  ah(async (req, res) => {
    const day = z.string().regex(isoDate).parse(req.query.date ?? todayIST());
    const b = req.business!._id;
    const [invoices, docs, payments, expenses] = await Promise.all([
      Invoice.find({ businessId: b, date: day }).lean(),
      TradeDocument.find({ businessId: b, date: day }).lean(),
      Payment.find({ businessId: b, date: day }).lean(),
      Expense.find({ businessId: b, date: day }).lean()
    ]);
    const rows = [
      ...invoices.map(i => ({ type: i.status === 'CANCELLED' ? 'Invoice (cancelled)' : 'Sales invoice', number: i.number, party: i.partyName, value: i.grandTotal, moneyIn: 0, moneyOut: 0 })),
      ...docs.map(d => ({ type: d.docType, number: d.number, party: d.partyName, value: d.grandTotal, moneyIn: 0, moneyOut: 0 })),
      ...payments.map(p => ({ type: p.type, number: p.reference || p.refNumber || '', party: p.partyName ?? '', value: p.amount, moneyIn: p.type === 'PAYMENT_IN' ? p.amount : 0, moneyOut: p.type === 'PAYMENT_OUT' ? p.amount : 0 })),
      ...expenses.map(e => ({ type: `EXPENSE · ${e.category}`, number: e.number, party: e.vendorName, value: e.total, moneyIn: 0, moneyOut: e.total }))
    ];
    res.json({ date: day, rows, moneyIn: sum(rows, r => r.moneyIn), moneyOut: sum(rows, r => r.moneyOut) });
  })
);

/** Home screen numbers for the app. */
reportsRouter.get(
  '/dashboard',
  allow(...READ),
  ah(async (req, res) => {
    const b = req.business!._id;
    const today = todayIST();
    const month = today.slice(0, 7);
    const [monthSales, receivable, payable, lowStock, pendingIrn] = await Promise.all([
      Invoice.aggregate([{ $match: { businessId: b, status: { $ne: 'CANCELLED' }, date: { $gte: `${month}-01` } } }, { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }]),
      Party.aggregate([{ $match: { businessId: b, balance: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$balance' } } }]),
      Party.aggregate([{ $match: { businessId: b, balance: { $lt: 0 } } }, { $group: { _id: null, total: { $sum: '$balance' } } }]),
      Product.countDocuments({ businessId: b, isService: { $ne: true }, $expr: { $lte: ['$stock', '$minStock'] } }),
      Invoice.countDocuments({ businessId: b, status: { $ne: 'CANCELLED' }, partyGstin: { $gt: '' }, 'eInvoice.status': 'NOT_GENERATED' })
    ]);
    res.json({
      month,
      salesThisMonth: r2(monthSales[0]?.total ?? 0),
      invoicesThisMonth: monthSales[0]?.count ?? 0,
      toCollect: r2(receivable[0]?.total ?? 0),
      toPay: r2(-(payable[0]?.total ?? 0)),
      lowStockItems: lowStock,
      b2bInvoicesWithoutIrn: pendingIrn
    });
  })
);
