import { InvoiceItem, Product } from '../types';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Recompute taxable value and CGST/SGST or IGST for one line. */
export function recalcItem(item: InvoiceItem, isInterState: boolean): InvoiceItem {
  const gross = item.price * item.quantity;
  const taxable = Math.max(0, gross - (gross * (item.discountPercent || 0)) / 100);
  const tax = (taxable * item.gstRate) / 100;
  const cgst = isInterState ? 0 : tax / 2;
  const sgst = isInterState ? 0 : tax / 2;
  const igst = isInterState ? tax : 0;
  return {
    ...item,
    taxableAmount: r2(taxable),
    cgstAmount: r2(cgst),
    sgstAmount: r2(sgst),
    igstAmount: r2(igst),
    totalAmount: r2(taxable + tax)
  };
}

export function docTotals(items: InvoiceItem[], roundOff = true) {
  const sum = (k: keyof InvoiceItem) => r2(items.reduce((a, i) => a + (i[k] as number), 0));
  const taxableTotal = sum('taxableAmount');
  const cgstTotal = sum('cgstAmount');
  const sgstTotal = sum('sgstAmount');
  const igstTotal = sum('igstAmount');
  const totalGst = r2(cgstTotal + sgstTotal + igstTotal);
  const exact = r2(taxableTotal + totalGst);
  const grandTotal = roundOff ? Math.round(exact) : exact;
  return {
    subTotal: r2(items.reduce((a, i) => a + i.price * i.quantity, 0)),
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

export function itemFromProduct(p: Product, isInterState: boolean, priceField: 'sellingPrice' | 'purchasePrice' = 'sellingPrice', quantity = 1): InvoiceItem {
  return recalcItem(
    {
      id: 'item-' + Math.random().toString(36).slice(2, 9),
      productId: p.id,
      name: p.name,
      hsnCode: p.hsnCode,
      quantity,
      unit: p.unit,
      price: p[priceField],
      discountPercent: 0,
      gstRate: p.taxRate,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0
    },
    isInterState
  );
}

/** Indian financial year label for a date, e.g. 2026-11-04 → "26-27". */
export function fyLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

/** Rule 46: max 16 chars, only letters, digits, "-" and "/". */
export function isValidDocNumber(n: string, maxLen = 16) {
  return n.length > 0 && n.length <= maxLen && /^[A-Za-z0-9/-]+$/.test(n);
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((new Date(toIso + 'T00:00:00').getTime() - new Date(fromIso + 'T00:00:00').getTime()) / 86400000);
}

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Today's date (or a date offset by `addDays`) as YYYY-MM-DD in the user's local time zone (IST), not UTC. */
export function localDate(addDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
