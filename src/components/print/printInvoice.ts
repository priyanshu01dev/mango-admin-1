import QRCode from 'qrcode';
import type { Invoice, BusinessProfile } from '../../types';
import type { InvoiceTemplate } from '../../types/documents';
import { numberToWordsINR, getStateNameByCode } from '../../utils/formatters';

/**
 * Builds a printable invoice (Print → Save as PDF) for each template in Invoice Settings (spec §8.7):
 * A4 classic / modern, A5, thermal 80 mm (3") and 58 mm (2").
 */

export interface PrintOptions {
  template: InvoiceTemplate;
  showUpiQr: boolean;
  showBankDetails: boolean;
  showSignature: boolean;
  watermark: boolean; // Free plan: "Made with Mango Invoice"
  terms?: string;
}

const esc = (s: string | undefined | null) => (s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const money = (n: number | undefined) => (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : '');

/** UPI deep link with the balance due, scannable by any UPI app. */
export function upiLink(biz: BusinessProfile, inv: Invoice) {
  const amount = inv.balanceDue > 0 ? inv.balanceDue : inv.grandTotal;
  const p = new URLSearchParams({ pa: biz.upiId, pn: biz.tradeName || biz.name, am: amount.toFixed(2), cu: 'INR', tn: `Invoice ${inv.invoiceNumber}` });
  return `upi://pay?${p.toString()}`;
}

export const upiQrDataUrl = (biz: BusinessProfile, inv: Invoice, width = 160) =>
  QRCode.toDataURL(upiLink(biz, inv), { margin: 1, width, errorCorrectionLevel: 'M' });

function taxRows(inv: Invoice) {
  const rows: [string, number][] = [];
  if (inv.billDiscount) rows.push(['Bill discount', -inv.billDiscount]);
  for (const c of inv.charges ?? []) rows.push([`${c.label} (GST ${c.gstRate}%)`, c.amount]);
  rows.push(['Taxable value', inv.taxableTotal]);
  if (inv.isInterState) rows.push(['IGST', inv.igstTotal]);
  else rows.push(['CGST', inv.cgstTotal], ['SGST', inv.sgstTotal]);
  if (inv.tcsAmount) rows.push([`TCS @ ${inv.tcsRate}%`, inv.tcsAmount]);
  if (inv.roundOff) rows.push(['Round off', inv.roundOff]);
  return rows;
}

function irnBlock(inv: Invoice) {
  if (inv.eInvoiceStatus !== 'GENERATED') return '';
  return inv.irnMock
    ? `<div class="irn mock">MOCK IRN: NOT A VALID e-INVOICE<br/><span>${esc(inv.irnNumber)}</span></div>`
    : `<div class="irn">IRN: <span>${esc(inv.irnNumber)}</span></div>`;
}

function a4(inv: Invoice, biz: BusinessProfile, o: PrintOptions, qr: string) {
  const modern = o.template === 'A4_MODERN';
  const a5 = o.template === 'A5';
  const title = inv.status === 'CANCELLED' ? 'TAX INVOICE (CANCELLED)' : 'TAX INVOICE';
  const lines = inv.items
    .map(
      (it, i) => `<tr><td>${i + 1}</td><td>${esc(it.name)}</td><td>${esc(it.hsnCode)}</td><td class="r">${it.quantity} ${esc(it.unit)}</td>
<td class="r">${money(it.price)}${it.priceIncludesTax ? '*' : ''}</td><td class="r">${it.discountPercent || 0}%</td><td class="r">${money(it.taxableAmount)}</td>
<td class="r">${it.gstRate}%</td><td class="r">${money(inv.isInterState ? it.igstAmount : it.cgstAmount + it.sgstAmount)}</td><td class="r">${money(it.totalAmount)}</td></tr>`
    )
    .join('');
  const inclusiveNote = inv.items.some(i => i.priceIncludesTax) ? '<p class="muted">* Rate includes GST.</p>' : '';
  const transport = inv.transport && (inv.transport.vehicleNumber || inv.transport.transporterName || inv.transport.lrNumber)
    ? `<div><b>Transport:</b> ${esc(inv.transport.transporterName)} ${inv.transport.vehicleNumber ? '· Vehicle ' + esc(inv.transport.vehicleNumber) : ''} ${inv.transport.lrNumber ? '· LR ' + esc(inv.transport.lrNumber) : ''}</div>`
    : '';
  return `
<div class="${modern ? 'head modern' : 'head'}">
  <div><h1>${title}</h1><div class="muted">Original for recipient</div>${irnBlock(inv)}</div>
  <div class="r"><b class="biz">${esc(biz.name)}</b><br/>${esc(biz.address)}${biz.city ? ', ' + esc(biz.city) : ''}<br/>
  GSTIN: <b>${esc(biz.gstin) || 'Unregistered'}</b> · State: ${esc(biz.state)} (${esc(biz.stateCode)})<br/>${esc(biz.phone)} ${esc(biz.email)}</div>
</div>
<div class="grid">
  <div><b>Bill to</b><br/>${esc(inv.customerName)}<br/>${esc(inv.customerAddress)}<br/>GSTIN: ${esc(inv.customerGstin) || 'Unregistered'}<br/>${esc(inv.customerPhone)}
  ${inv.shippingAddress ? `<br/><br/><b>Ship to</b><br/>${esc(inv.shippingAddress)}` : ''}</div>
  <div class="r"><table class="meta">
    <tr><td>Invoice no.</td><td><b>${esc(inv.invoiceNumber)}</b></td></tr>
    <tr><td>Date</td><td>${dmy(inv.invoiceDate)}</td></tr>
    <tr><td>Due date</td><td>${dmy(inv.dueDate)}</td></tr>
    <tr><td>Place of supply</td><td>${esc(getStateNameByCode(inv.customerStateCode))} (${esc(inv.customerStateCode)})</td></tr>
    ${inv.poNumber ? `<tr><td>Buyer PO</td><td>${esc(inv.poNumber)}</td></tr>` : ''}
    <tr><td>Reverse charge</td><td>No</td></tr>
  </table></div>
</div>
${transport}
<table class="items"><thead><tr><th>#</th><th>Item</th><th>HSN/SAC</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Disc</th><th class="r">Taxable</th><th class="r">GST</th><th class="r">Tax</th><th class="r">Amount</th></tr></thead><tbody>${lines}</tbody></table>
${inclusiveNote}
<div class="grid">
  <div>
    <p><b>Amount in words:</b> ${esc(numberToWordsINR(inv.grandTotal))}</p>
    <div class="pay">
      ${o.showBankDetails && biz.bankAccountNumber ? `<div><b>Bank details</b><br/>${esc(biz.bankName)}<br/>A/c ${esc(biz.bankAccountNumber)}<br/>IFSC ${esc(biz.bankIfsc)}${biz.bankBranch ? '<br/>' + esc(biz.bankBranch) : ''}</div>` : ''}
      ${o.showUpiQr && qr ? `<div class="qr"><img src="${qr}" alt="UPI QR"/><br/>Scan to pay ₹${money(inv.balanceDue > 0 ? inv.balanceDue : inv.grandTotal)}<br/><span class="muted">${esc(biz.upiId)}</span></div>` : ''}
    </div>
    ${o.terms ? `<p class="muted"><b>Terms:</b> ${esc(o.terms)}</p>` : ''}
    ${inv.notes ? `<p class="muted"><b>Notes:</b> ${esc(inv.notes)}</p>` : ''}
  </div>
  <div>
    <table class="sum">${taxRows(inv).map(([k, v]) => `<tr><td>${k}</td><td class="r">${money(v)}</td></tr>`).join('')}
      <tr class="total"><td>Grand total</td><td class="r">₹${money(inv.grandTotal)}</td></tr>
      ${inv.amountPaid ? `<tr><td>Paid</td><td class="r">${money(inv.amountPaid)}</td></tr>` : ''}
      ${inv.tdsDeducted ? `<tr><td>TDS deducted by buyer</td><td class="r">${money(inv.tdsDeducted)}</td></tr>` : ''}
      <tr><td><b>Balance due</b></td><td class="r"><b>₹${money(inv.balanceDue)}</b></td></tr>
    </table>
    ${o.showSignature ? `<div class="sign">${esc(biz.signatureText || 'For ' + biz.name)}<br/><br/><br/>Authorised signatory</div>` : ''}
  </div>
</div>
<p class="foot">This is a computer generated invoice.</p>
<style>
  @page { size: ${a5 ? 'A5' : 'A4'}; margin: ${a5 ? '8mm' : '12mm'}; }
  body { font-size: ${a5 ? '9.5px' : '11.5px'}; }
  .head { display:flex; justify-content:space-between; gap:16px; border-bottom:3px solid #f7781b; padding-bottom:10px; margin-bottom:10px; }
  .head.modern { background:linear-gradient(90deg,#fbbf24,#f7781b,#e25e0e); color:#fff; border:0; border-radius:10px; padding:14px 16px; }
  .head.modern .muted { color:rgba(255,255,255,.85); }
  h1 { font-size:${a5 ? '14px' : '18px'}; margin:0; letter-spacing:.5px; }
  .biz { font-size:${a5 ? '11px' : '14px'}; }
  .grid { display:flex; justify-content:space-between; gap:20px; margin:10px 0; }
  .grid > div { flex:1; }
  table { width:100%; border-collapse:collapse; }
  .items th, .items td { border:1px solid #e7d9c7; padding:${a5 ? '3px' : '6px'}; }
  .items th { background:#fff7ed; text-align:left; }
  .meta td { padding:2px 6px; } .meta td:first-child { color:#78716c; }
  .sum td { padding:3px 6px; border-bottom:1px solid #f1e6d8; }
  .sum .total td { font-weight:800; font-size:1.15em; border-top:2px solid #2a1f17; }
  .pay { display:flex; gap:16px; align-items:flex-start; margin:8px 0; }
  .qr { text-align:center; } .qr img { width:${a5 ? '84px' : '110px'}; }
  .sign { text-align:right; margin-top:24px; }
  .irn { margin-top:6px; font-size:9px; border:1px solid #86efac; background:#f0fdf4; padding:3px 6px; border-radius:4px; word-break:break-all; }
  .irn.mock { border-color:#e11d48; background:#fff1f2; color:#be123c; font-weight:800; }
  .foot { text-align:center; color:#a8a29e; margin-top:16px; }
</style>`;
}

function thermal(inv: Invoice, biz: BusinessProfile, o: PrintOptions, qr: string) {
  const w = o.template === 'THERMAL_2IN' ? 58 : 80;
  const lines = inv.items
    .map(it => `<tr><td colspan="3">${esc(it.name)}</td></tr><tr><td>${it.quantity} × ${money(it.price)}</td><td>${it.gstRate}%</td><td class="r">${money(it.totalAmount)}</td></tr>`)
    .join('');
  return `
<div class="c"><b class="biz">${esc(biz.tradeName || biz.name)}</b><br/>${esc(biz.address)}<br/>GSTIN ${esc(biz.gstin) || '—'}<br/>${esc(biz.phone)}</div>
<div class="c b">TAX INVOICE${inv.status === 'CANCELLED' ? ' (CANCELLED)' : ''}</div>
<div>No: ${esc(inv.invoiceNumber)}<br/>Date: ${dmy(inv.invoiceDate)}<br/>To: ${esc(inv.customerName)}${inv.customerGstin ? '<br/>GSTIN ' + esc(inv.customerGstin) : ''}</div>
${irnBlock(inv)}
<hr/><table>${lines}</table><hr/>
<table>${taxRows(inv).map(([k, v]) => `<tr><td>${k}</td><td class="r">${money(v)}</td></tr>`).join('')}
<tr class="b"><td>TOTAL</td><td class="r">₹${money(inv.grandTotal)}</td></tr></table>
${o.showUpiQr && qr ? `<div class="c"><img src="${qr}" alt="UPI QR"/><br/>Scan to pay via UPI</div>` : ''}
<div class="c">Thank you! Visit again.</div>
<style>
  @page { size: ${w}mm auto; margin: 2mm; }
  body { width:${w - 4}mm; margin:0 auto; font-family: 'Courier New', monospace; font-size:${w === 58 ? '9px' : '11px'}; }
  table { width:100%; border-collapse:collapse; } td { padding:1px 0; vertical-align:top; }
  .c { text-align:center; margin:4px 0; } .b { font-weight:800; } .biz { font-size:1.2em; }
  hr { border:0; border-top:1px dashed #000; }
  img { width:${w === 58 ? '30mm' : '38mm'}; }
  .irn { font-size:8px; word-break:break-all; } .irn.mock { font-weight:800; }
</style>`;
}

export async function printInvoice(inv: Invoice, biz: BusinessProfile, o: PrintOptions) {
  // open synchronously (pop-up blockers allow it inside the click), fill in after the QR is ready
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) throw new Error('Allow pop-ups for this site to print invoices');
  w.document.write('<p style="font-family:sans-serif">Preparing invoice…</p>');
  const qr = o.showUpiQr && biz.upiId ? await upiQrDataUrl(biz, inv, 320) : '';
  const body = o.template.startsWith('THERMAL') ? thermal(inv, biz, o, qr) : a4(inv, biz, o, qr);
  const watermark = o.watermark
    ? `<div style="position:fixed;bottom:6mm;left:0;right:0;text-align:center;color:#f7781b;font-weight:700;font-size:10px;opacity:.85">Made with Mango Invoice · Free plan</div>`
    : '';
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${esc(inv.invoiceNumber)}</title>
<style>body{font-family:system-ui,'Noto Sans Devanagari',sans-serif;color:#2a1f17;margin:0;padding:8px} .r{text-align:right} .muted{color:#78716c}</style>
</head><body>${body}${watermark}</body></html>`);
  w.document.close();
  // printed from the opener: the page's Content-Security-Policy blocks inline scripts in this window
  setTimeout(() => { w.focus(); w.print(); }, 350);
}
