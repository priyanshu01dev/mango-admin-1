import { TradeDocument, Expense, InvoiceSettings, DocType, DocStatus } from '../types/documents';
import { INITIAL_PRODUCTS, INITIAL_PARTIES } from './mockData';
import { itemFromProduct, docTotals } from '../utils/gst';

const BIZ_STATE = '07';

function makeDoc(
  id: string,
  docType: DocType,
  number: string,
  partyId: string,
  date: string,
  lines: [string, number, number?][], // productId, qty, price override
  status: DocStatus,
  extra: Partial<TradeDocument> = {}
): TradeDocument {
  const party = INITIAL_PARTIES.find(p => p.id === partyId)!;
  const isInterState = party.stateCode !== BIZ_STATE;
  const isPurchase = docType === 'PURCHASE_BILL' || docType === 'PURCHASE_ORDER' || docType === 'DEBIT_NOTE';
  const items = lines.map(([pid, qty, price]) => {
    const p = INITIAL_PRODUCTS.find(x => x.id === pid)!;
    const base = itemFromProduct(p, isInterState, isPurchase ? 'purchasePrice' : 'sellingPrice', qty);
    return price ? itemFromProduct({ ...p, sellingPrice: price, purchasePrice: price }, isInterState, 'sellingPrice', qty) : base;
  });
  const t = docTotals(items);
  return {
    id,
    docType,
    number,
    businessId: 'biz-1',
    partyId,
    partyName: party.name,
    partyGstin: party.gstin,
    partyStateCode: party.stateCode,
    date,
    isInterState,
    items,
    taxableTotal: t.taxableTotal,
    cgstTotal: t.cgstTotal,
    sgstTotal: t.sgstTotal,
    igstTotal: t.igstTotal,
    totalGst: t.totalGst,
    roundOff: t.roundOff,
    grandTotal: t.grandTotal,
    amountPaid: 0,
    status,
    createdAt: date + 'T10:00:00.000Z',
    ...extra
  };
}

export const INITIAL_DOCUMENTS: TradeDocument[] = [
  // Purchases
  makeDoc('doc-pb-1', 'PURCHASE_BILL', 'PB/26-27/0041', 'party-4', '2026-10-18', [['prod-1', 40], ['prod-2', 300]], 'PARTIALLY_PAID', {
    reference: 'HVL/DL/88213', dueDate: '2026-11-17', itcEligible: true, amountPaid: 40000
  }),
  makeDoc('doc-pb-2', 'PURCHASE_BILL', 'PB/26-27/0042', 'party-5', '2026-10-29', [['prod-5', 8]], 'UNPAID', {
    reference: 'LUM/GJ/55102', dueDate: '2026-11-28', itcEligible: true
  }),
  makeDoc('doc-pb-3', 'PURCHASE_BILL', 'PB/26-27/0039', 'party-4', '2026-09-30', [['prod-6', 60]], 'PAID', {
    reference: 'HVL/DL/87120', dueDate: '2026-10-30', itcEligible: true
  }),
  makeDoc('doc-po-1', 'PURCHASE_ORDER', 'PO/26-27/0012', 'party-5', '2026-11-02', [['prod-5', 10], ['prod-4', 15, 1600]], 'OPEN', {
    dueDate: '2026-11-12', notes: 'Deliver before Chhath rush'
  }),
  makeDoc('doc-dn-1', 'DEBIT_NOTE', 'DN/26-27/0003', 'party-4', '2026-10-22', [['prod-2', 20]], 'ISSUED', {
    reference: 'PB/26-27/0041', reason: 'Damaged in transit'
  }),
  // Sales
  makeDoc('doc-pf-1', 'PROFORMA', 'PF/26-27/0008', 'party-2', '2026-11-01', [['prod-4', 25], ['prod-3', 60]], 'OPEN', {
    dueDate: '2026-11-15', notes: 'Advance 50% required before dispatch'
  }),
  makeDoc('doc-so-1', 'SALES_ORDER', 'SO/26-27/0015', 'party-1', '2026-11-03', [['prod-1', 12], ['prod-6', 20]], 'OPEN', {
    dueDate: '2026-11-10'
  }),
  makeDoc('doc-dc-1', 'DELIVERY_CHALLAN', 'DC/26-27/0021', 'party-3', '2026-11-02', [['prod-2', 150], ['prod-6', 10]], 'DELIVERED', {
    reason: 'Supply on approval', vehicleNumber: 'DL01LAB4521'
  }),
  makeDoc('doc-cn-1', 'CREDIT_NOTE', 'CN/26-27/0005', 'party-1', '2026-10-28', [['prod-3', 6]], 'ISSUED', {
    reference: 'INV/2026/00143', reason: 'Sales return — defective units', restock: true
  })
];

export const INITIAL_EXPENSES: Expense[] = [
  { id: 'exp-1', businessId: 'biz-1', number: 'EXP/26-27/0101', date: '2026-11-01', category: 'Rent', vendorName: 'Nehru Place Estates', vendorGstin: '07AAGFN1234K1Z3', description: 'Shop rent — November', amount: 45000, gstRate: 18, gstAmount: 8100, total: 53100, mode: 'NEFT_RTGS', itcEligible: true, reference: 'UTR 4521889' },
  { id: 'exp-2', businessId: 'biz-1', number: 'EXP/26-27/0102', date: '2026-11-02', category: 'Electricity', vendorName: 'BSES Rajdhani', description: 'Electricity bill Oct', amount: 7820, gstRate: 0, gstAmount: 0, total: 7820, mode: 'UPI', itcEligible: false, reference: 'UPI 88123' },
  { id: 'exp-3', businessId: 'biz-1', number: 'EXP/26-27/0103', date: '2026-11-03', category: 'Transport & Freight', vendorName: 'Shree Ganesh Roadlines', vendorGstin: '07AAKFS7788L1Z1', description: 'Freight to Noida site', amount: 3500, gstRate: 5, gstAmount: 175, total: 3675, mode: 'CASH', itcEligible: true },
  { id: 'exp-4', businessId: 'biz-1', number: 'EXP/26-27/0104', date: '2026-10-31', category: 'Salaries & Wages', vendorName: 'Staff payroll', description: 'October salaries (4 staff)', amount: 82000, gstRate: 0, gstAmount: 0, total: 82000, mode: 'NEFT_RTGS', itcEligible: false },
  { id: 'exp-5', businessId: 'biz-1', number: 'EXP/26-27/0105', date: '2026-10-25', category: 'Professional Fees (CA / Legal)', vendorName: 'CA Nikhil & Associates', vendorGstin: '22AAFFN4455Q1Z9', description: 'GST return filing — Q2', amount: 6000, gstRate: 18, gstAmount: 1080, total: 7080, mode: 'UPI', itcEligible: true }
];

export const INITIAL_INVOICE_SETTINGS: InvoiceSettings = {
  prefix: 'INV/26-27/',
  nextNumber: 146,
  padding: 4,
  financialYearReset: true,
  template: 'A4_CLASSIC',
  showUpiQr: true,
  showBankDetails: true,
  showSignature: true,
  defaultDueDays: 15,
  defaultNotes: 'Thank you for your business!',
  roundOff: true,
  docPrefixes: {
    PROFORMA: 'PF/26-27/',
    SALES_ORDER: 'SO/26-27/',
    DELIVERY_CHALLAN: 'DC/26-27/',
    CREDIT_NOTE: 'CN/26-27/',
    PURCHASE_ORDER: 'PO/26-27/',
    PURCHASE_BILL: 'PB/26-27/',
    DEBIT_NOTE: 'DN/26-27/'
  }
};
