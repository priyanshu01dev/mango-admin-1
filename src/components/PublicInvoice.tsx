import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { formatINR, formatDate, numberToWordsINR, getStateNameByCode } from '../utils/formatters';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = { business: Record<string, any>; invoice: Record<string, any> };

/** Customer-facing invoice page at /i/:token (no login): view, pay by UPI, print. */
export const PublicInvoice: React.FC<{ token: string }> = ({ token }) => {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');

  useEffect(() => {
    fetch(`/api/public/invoices/${encodeURIComponent(token)}`)
      .then(async r => (r.ok ? r.json() : Promise.reject(new Error(r.status === 404 ? 'This invoice link is not valid.' : 'Could not load the invoice.'))))
      .then(setData)
      .catch(e => setError(e.message));
  }, [token]);

  const upi = data && data.business.upiId && data.invoice.balanceDue > 0
    ? `upi://pay?${new URLSearchParams({ pa: data.business.upiId, pn: data.business.tradeName || data.business.name, am: Number(data.invoice.balanceDue).toFixed(2), cu: 'INR', tn: `Invoice ${data.invoice.number}` })}`
    : '';
  useEffect(() => {
    if (upi) QRCode.toDataURL(upi, { margin: 1, width: 220 }).then(setQr).catch(() => setQr(''));
  }, [upi]);

  if (error) return <div className="min-h-screen bg-cream flex items-center justify-center text-sm text-stone-600">{error}</div>;
  if (!data) return <div className="min-h-screen bg-cream flex items-center justify-center text-xs text-stone-500">Loading invoice…</div>;
  const { business: b, invoice: i } = data;

  return (
    <div className="min-h-screen bg-cream py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white border border-mango-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-amber-400 via-mango-500 to-orange-600 text-white p-5 flex justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest font-bold text-white/85">{i.kind === 'BILL_OF_SUPPLY' ? 'Bill of supply' : 'Tax invoice'}</div>
            <div className="text-2xl font-black font-mono">{i.number}</div>
            <div className="text-xs text-white/90">{formatDate(i.date)}{i.dueDate ? ` · due ${formatDate(i.dueDate)}` : ''}</div>
          </div>
          <div className="text-right text-xs">
            <div className="font-black text-base">{b.tradeName || b.name}</div>
            <div className="text-white/90">{b.address}{b.city ? `, ${b.city}` : ''}</div>
            {b.gstin && <div className="font-mono">GSTIN {b.gstin}</div>}
          </div>
        </div>

        {i.status === 'CANCELLED' && <div className="bg-rose-50 text-rose-700 text-xs font-bold text-center py-2 border-b border-rose-200">This invoice has been cancelled.</div>}
        {i.irnMock && <div className="bg-rose-50 text-rose-700 text-xs font-bold text-center py-2 border-b border-rose-200">Test IRN (not a valid e-invoice)</div>}

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-[10px] uppercase font-bold text-stone-500">Billed to</div>
            <div className="font-bold text-ink text-sm">{i.partyName}</div>
            <div className="text-stone-600">{i.partyAddress}</div>
            {i.partyGstin && <div className="font-mono text-stone-600">GSTIN {i.partyGstin}</div>}
            <div className="text-stone-500 mt-1">Place of supply: {getStateNameByCode(i.placeOfSupply)} ({i.placeOfSupply})</div>
          </div>
          <div className="md:text-right">
            <div className="text-[10px] uppercase font-bold text-stone-500">{i.balanceDue > 0 ? 'Amount due' : 'Paid in full'}</div>
            <div className="text-3xl font-black font-mono text-ink">{formatINR(i.balanceDue > 0 ? i.balanceDue : i.grandTotal)}</div>
            {i.amountPaid > 0 && i.balanceDue > 0 && <div className="text-stone-500">of {formatINR(i.grandTotal)} · {formatINR(i.amountPaid)} paid</div>}
          </div>
        </div>

        <div className="px-5 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-mango-50/60 text-stone-500 uppercase text-[10px]">
              <tr><th className="p-2">Item</th><th className="p-2">HSN</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">GST</th><th className="p-2 text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-mango-100">
              {i.items.map((it: Record<string, any>, k: number) => (
                <tr key={k}><td className="p-2 font-semibold text-ink">{it.name}</td><td className="p-2 font-mono">{it.hsnCode}</td><td className="p-2 text-right">{it.quantity} {it.unit}</td><td className="p-2 text-right font-mono">{formatINR(it.price)}</td><td className="p-2 text-right">{it.gstRate}%</td><td className="p-2 text-right font-mono font-bold">{formatINR(it.totalAmount)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-2">
            {qr && (
              <div className="text-center md:text-left">
                <img src={qr} alt="UPI QR code" className="w-40 h-40 inline-block border border-mango-100 rounded-lg" />
                <div className="text-stone-600 mt-1">Scan with any UPI app</div>
                <a href={upi} className="inline-block mt-2 bg-mango-500 hover:bg-mango-600 text-white font-bold px-4 py-2 rounded-xl md:hidden">Pay {formatINR(i.balanceDue)} with UPI</a>
              </div>
            )}
            <p className="text-stone-500 italic">{numberToWordsINR(i.grandTotal)}</p>
            {i.notes && <p className="text-stone-500">{i.notes}</p>}
          </div>
          <div className="space-y-1 font-mono">
            {!!i.billDiscount && <Row k="Bill discount" v={-i.billDiscount} />}
            {(i.charges ?? []).map((c: Record<string, any>) => <Row key={c.label} k={c.label} v={c.amount} />)}
            <Row k="Taxable value" v={i.taxableTotal} />
            {i.isInterState ? <Row k="IGST" v={i.igstTotal} /> : (<><Row k="CGST" v={i.cgstTotal} /><Row k="SGST" v={i.sgstTotal} /></>)}
            {!!i.tcsAmount && <Row k="TCS" v={i.tcsAmount} />}
            {!!i.roundOff && <Row k="Round off" v={i.roundOff} />}
            <div className="flex justify-between border-t-2 border-ink pt-1.5 text-sm font-black text-ink font-sans"><span>Total</span><span className="font-mono">{formatINR(i.grandTotal)}</span></div>
          </div>
        </div>

        <div className="px-5 pb-5 flex justify-between items-center text-[11px] text-stone-400">
          <span>Sent via Mango Invoice · Powered by First Wave</span>
          <button onClick={() => window.print()} className="text-mango-700 font-semibold">Print / save PDF</button>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ k: string; v: number }> = ({ k, v }) => (
  <div className="flex justify-between text-stone-600"><span className="font-sans">{k}</span><span>{formatINR(v)}</span></div>
);
