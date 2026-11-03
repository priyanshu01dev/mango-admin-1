import { TradeDocument } from '../../types/documents';
import { BusinessProfile } from '../../types';
import { numberToWordsINR, getStateNameByCode } from '../../utils/formatters';

const TITLES: Record<TradeDocument['docType'], string> = {
  PROFORMA: 'PROFORMA INVOICE',
  SALES_ORDER: 'SALES ORDER',
  DELIVERY_CHALLAN: 'DELIVERY CHALLAN',
  CREDIT_NOTE: 'CREDIT NOTE',
  PURCHASE_ORDER: 'PURCHASE ORDER',
  PURCHASE_BILL: 'PURCHASE BILL (Inward)',
  DEBIT_NOTE: 'DEBIT NOTE'
};

const esc = (s: string | undefined) => (s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Opens a printable A4 copy (Print → Save as PDF). */
export function printDocument(doc: TradeDocument, biz: BusinessProfile) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return;
  const rows = doc.items
    .map(
      (i, idx) => `<tr><td>${idx + 1}</td><td>${esc(i.name)}</td><td>${esc(i.hsnCode)}</td><td class="r">${i.quantity} ${esc(i.unit)}</td>
<td class="r">${money(i.price)}</td><td class="r">${i.discountPercent || 0}%</td><td class="r">${money(i.taxableAmount)}</td><td class="r">${i.gstRate}%</td><td class="r">${money(i.totalAmount)}</td></tr>`
    )
    .join('');
  const taxRows = doc.isInterState
    ? `<tr><td>IGST</td><td class="r">${money(doc.igstTotal)}</td></tr>`
    : `<tr><td>CGST</td><td class="r">${money(doc.cgstTotal)}</td></tr><tr><td>SGST</td><td class="r">${money(doc.sgstTotal)}</td></tr>`;
  const challanNote =
    doc.docType === 'DELIVERY_CHALLAN' ? `<p><b>Purpose:</b> ${esc(doc.reason)} &nbsp; <b>Vehicle:</b> ${esc(doc.vehicleNumber) || '—'}<br/>Not a tax invoice. Goods sent for the purpose stated above.</p>` : '';
  const noteRef =
    doc.docType === 'CREDIT_NOTE' || doc.docType === 'DEBIT_NOTE'
      ? `<p><b>Against:</b> ${esc(doc.reference)} &nbsp; <b>Reason:</b> ${esc(doc.reason)}</p>`
      : doc.reference
      ? `<p><b>Reference:</b> ${esc(doc.reference)}</p>`
      : '';

  w.document.write(`<!doctype html><html><head><title>${esc(doc.number)}</title>
<style>
body{font-family:system-ui,'Noto Sans Devanagari',sans-serif;color:#2a1f17;margin:28px;font-size:11.5px}
h1{font-size:17px;margin:0;letter-spacing:.5px}.top{display:flex;justify-content:space-between;border-bottom:3px solid #f7781b;padding-bottom:10px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border:1px solid #e7d9c7;padding:6px}th{background:#fff7ed;text-align:left}
.r{text-align:right}.muted{color:#78716c}.grid{display:flex;justify-content:space-between;gap:24px}.sum{width:280px;margin-left:auto}
.cancel{color:#be123c;font-weight:800;border:2px solid #be123c;display:inline-block;padding:2px 8px;transform:rotate(-4deg)}
</style></head><body>
<div class="top"><div><h1>${TITLES[doc.docType]}</h1><div class="muted">${esc(doc.number)} · ${doc.date}</div>
${doc.status === 'CANCELLED' ? '<div class="cancel">CANCELLED</div>' : ''}</div>
<div class="r"><b>${esc(biz.name)}</b><br/>${esc(biz.address)}, ${esc(biz.city)}<br/>GSTIN: ${esc(biz.gstin)} · State: ${esc(biz.state)} (${biz.stateCode})</div></div>
<div class="grid"><div><b>${doc.docType.startsWith('PURCHASE') || doc.docType === 'DEBIT_NOTE' ? 'Supplier' : 'Bill to'}:</b><br/>${esc(doc.partyName)}<br/>GSTIN: ${esc(doc.partyGstin) || 'Unregistered'}</div>
<div class="r">Place of supply: ${getStateNameByCode(doc.partyStateCode)} (${doc.partyStateCode})${doc.dueDate ? `<br/>Due / valid till: ${doc.dueDate}` : ''}</div></div>
${noteRef}${challanNote}
<table><tr><th>#</th><th>Item</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Disc</th><th class="r">Taxable</th><th class="r">GST</th><th class="r">Amount</th></tr>${rows}</table>
<table class="sum"><tr><td>Taxable value</td><td class="r">${money(doc.taxableTotal)}</td></tr>${taxRows}
${doc.roundOff ? `<tr><td>Round off</td><td class="r">${money(doc.roundOff)}</td></tr>` : ''}
<tr><th>Total</th><th class="r">₹${money(doc.grandTotal)}</th></tr></table>
<p><b>Amount in words:</b> ${numberToWordsINR(doc.grandTotal)}</p>
${doc.notes ? `<p class="muted">${esc(doc.notes)}</p>` : ''}
<p class="r" style="margin-top:40px">${esc(biz.signatureText || 'Authorised signatory')}</p>
<p class="muted" style="text-align:center;margin-top:24px">Generated with Mango Invoice · Powered by First Wave</p>
</body></html>`);
  w.document.close();
  // printed from the opener: the page's Content-Security-Policy blocks inline scripts in this window
  setTimeout(() => { w.focus(); w.print(); }, 350);
}
