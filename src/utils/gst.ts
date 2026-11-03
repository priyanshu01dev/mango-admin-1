import { InvoiceItem, Product } from '../types';
import { recalcItem } from '../../shared/gst';

// GST maths lives in /shared so the web app and the API server compute identical totals.
export { recalcItem, docTotals, invoiceTotals, fyLabel, isValidDocNumber, daysBetween, isValidGstin, isValidPan, r2 } from '../../shared/gst';

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
