/**
 * GST maths and Indian compliance helpers shared by the web app and the API server.
 * Pure functions only: no DOM, no Node APIs.
 */

export interface GstLine {
  id: string;
  productId?: string;
  name: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  price: number; // unit price before tax
  discountPercent: number;
  gstRate: number; // 0, 0.25, 3, 5, 12, 18, 28
  priceIncludesTax?: boolean; // price is GST-inclusive (MRP-style billing)
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Recompute taxable value and CGST+SGST (intra-state) or IGST (inter-state) for one line. */
export function recalcItem<T extends GstLine>(item: T, isInterState: boolean): T {
  // tax-inclusive price: back out GST to get the taxable unit price
  const unit = item.priceIncludesTax ? item.price / (1 + item.gstRate / 100) : item.price;
  const gross = unit * item.quantity;
  const taxable = Math.max(0, gross - (gross * (item.discountPercent || 0)) / 100);
  const tax = (taxable * item.gstRate) / 100;
  const half = r2(tax / 2);
  return {
    ...item,
    taxableAmount: r2(taxable),
    cgstAmount: isInterState ? 0 : half,
    sgstAmount: isInterState ? 0 : half,
    igstAmount: isInterState ? r2(tax) : 0,
    totalAmount: r2(taxable + (isInterState ? r2(tax) : half * 2))
  };
}

export function docTotals(items: GstLine[], roundOff = true) {
  const sum = (k: keyof GstLine) => r2(items.reduce((a, i) => a + (i[k] as number), 0));
  const taxableTotal = sum('taxableAmount');
  const cgstTotal = sum('cgstAmount');
  const sgstTotal = sum('sgstAmount');
  const igstTotal = sum('igstAmount');
  const totalGst = r2(cgstTotal + sgstTotal + igstTotal);
  const exact = r2(taxableTotal + totalGst);
  const grandTotal = roundOff ? Math.round(exact) : exact;
  return {
    subTotal: r2(items.reduce((a, i) => a + (i.priceIncludesTax ? i.price / (1 + i.gstRate / 100) : i.price) * i.quantity, 0)),
    totalDiscount: r2(items.reduce((a, i) => a + (i.price * i.quantity * (i.discountPercent || 0)) / 100, 0)),
    taxableTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    totalGst,
    roundOff: r2(grandTotal - exact),
    grandTotal
  };
}

export interface Charge {
  label: string; // Freight, Packing, Insurance…
  amount: number; // before GST
  gstRate: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalAmount?: number;
}

export interface InvoiceExtras {
  billDiscount?: number; // flat ₹ off the whole bill, before GST (reduces taxable value)
  charges?: Charge[]; // part of the value of supply (Sec 15), taxed
  tcsRate?: number; // % collected on the invoice value, outside GST
  roundOff?: boolean;
}

/**
 * Full invoice computation: line items, then a bill-level discount spread over the lines in proportion
 * to their taxable value, then taxed charges, then TCS, then round-off.
 */
export function invoiceTotals<T extends GstLine>(rawLines: T[], isInterState: boolean, extras: InvoiceExtras = {}) {
  let lines = rawLines.map(l => recalcItem(l, isInterState));
  const lineTaxable = lines.reduce((a, l) => a + l.taxableAmount, 0);
  const billDiscount = r2(Math.min(Math.max(0, extras.billDiscount ?? 0), lineTaxable));
  if (billDiscount > 0 && lineTaxable > 0) {
    const factor = (lineTaxable - billDiscount) / lineTaxable;
    lines = lines.map(l => {
      const taxable = r2(l.taxableAmount * factor);
      const tax = (taxable * l.gstRate) / 100;
      const half = r2(tax / 2);
      return {
        ...l,
        taxableAmount: taxable,
        cgstAmount: isInterState ? 0 : half,
        sgstAmount: isInterState ? 0 : half,
        igstAmount: isInterState ? r2(tax) : 0,
        totalAmount: r2(taxable + (isInterState ? r2(tax) : half * 2))
      };
    });
  }
  const charges: Charge[] = (extras.charges ?? [])
    .filter(c => c.amount > 0)
    .map(c => {
      const tax = (c.amount * c.gstRate) / 100;
      const half = r2(tax / 2);
      return {
        ...c,
        taxableAmount: r2(c.amount),
        cgstAmount: isInterState ? 0 : half,
        sgstAmount: isInterState ? 0 : half,
        igstAmount: isInterState ? r2(tax) : 0,
        totalAmount: r2(c.amount + (isInterState ? r2(tax) : half * 2))
      };
    });
  const all = [...lines, ...charges.map(c => ({ ...c, price: c.amount, quantity: 1, discountPercent: 0 }) as unknown as GstLine)];
  const sum = (k: keyof GstLine) => r2(all.reduce((a, i) => a + ((i[k] as number) || 0), 0));
  const taxableTotal = sum('taxableAmount');
  const cgstTotal = sum('cgstAmount');
  const sgstTotal = sum('sgstAmount');
  const igstTotal = sum('igstAmount');
  const totalGst = r2(cgstTotal + sgstTotal + igstTotal);
  const tcsRate = Math.max(0, extras.tcsRate ?? 0);
  const tcsAmount = r2(((taxableTotal + totalGst) * tcsRate) / 100);
  const exact = r2(taxableTotal + totalGst + tcsAmount);
  const grandTotal = extras.roundOff === false ? exact : Math.round(exact);
  return {
    lines,
    charges,
    subTotal: r2(rawLines.reduce((a, i) => a + (i.priceIncludesTax ? i.price / (1 + i.gstRate / 100) : i.price) * i.quantity, 0)),
    totalDiscount: r2(billDiscount + rawLines.reduce((a, i) => a + ((i.priceIncludesTax ? i.price / (1 + i.gstRate / 100) : i.price) * i.quantity * (i.discountPercent || 0)) / 100, 0)),
    billDiscount,
    chargesTotal: r2(charges.reduce((a, c) => a + (c.taxableAmount ?? 0), 0)),
    taxableTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    totalGst,
    tcsRate,
    tcsAmount,
    roundOff: r2(grandTotal - exact),
    grandTotal
  };
}

/** Indian financial year label for a YYYY-MM-DD date, e.g. 2026-11-04 → "26-27". */
export function fyLabel(iso: string) {
  const [y, m] = iso.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

/** Rule 46: unique, consecutive, max 16 chars, only letters, digits, "-" and "/". */
export function isValidDocNumber(n: string, maxLen = 16) {
  return n.length > 0 && n.length <= maxLen && /^[A-Za-z0-9/-]+$/.test(n);
}

export function daysBetween(fromIso: string, toIso: string) {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d(toIso) - d(fromIso)) / 86400000);
}

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** GSTIN check character (mod-36 Luhn variant used by GSTN). */
export function gstinCheckChar(first14: string) {
  let factor = 2;
  let sum = 0;
  for (let i = first14.length - 1; i >= 0; i--) {
    const cp = GSTIN_CHARS.indexOf(first14[i]);
    let addend = factor * cp;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / 36) + (addend % 36);
    sum += addend;
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36];
}

/** Format + checksum validation. Does not check that the GSTIN is active (that needs the GSTN API). */
export function isValidGstin(gstin: string) {
  const g = gstin.trim().toUpperCase();
  return GSTIN_RE.test(g) && gstinCheckChar(g.slice(0, 14)) === g[14];
}

export const isValidPan = (pan: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase());

/** Two-digit GST state code → state name (as used for place of supply). */
export const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '96': 'Other Country (export)', '97': 'Other Territory'
};
