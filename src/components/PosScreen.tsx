import React, { useMemo, useRef, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { useDocuments } from '../context/DocumentsContext';
import { get, post, errMsg } from '../api/client';
import { invoiceTotals, itemFromProduct } from '../utils/gst';
import { formatINR } from '../utils/formatters';
import { printInvoice } from './print/printInvoice';
import { toInvoice, toProduct } from '../api/mappers';
import { Card, PrimaryButton, inputCls } from './admin/ui';
import { ScanBarcode, Minus, Plus, Trash2, Printer, Search } from 'lucide-react';
import type { InvoiceItem, Product } from '../types';

type Mode = 'CASH' | 'UPI' | 'CARD';

/**
 * POS quick-bill counter (spec §8.4 P1): scan with a USB/Bluetooth barcode scanner (it types the code + Enter),
 * or search; bills a walk-in customer, collects payment and prints a thermal receipt.
 */
export const PosScreen: React.FC = () => {
  const { products, activeBusiness, showToast, reload, current } = useBilling();
  const { settings } = useDocuments();
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('CASH');
  const [tendered, setTendered] = useState(0);
  const [buyer, setBuyer] = useState({ name: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  // counter sales are intra-state walk-ins by default
  const totals = useMemo(() => invoiceTotals(cart, false, { roundOff: true }), [cart]);
  const matches = query.length >= 2 ? products.filter(p => p.status === 'ACTIVE' && [p.name, p.sku, p.barcode ?? ''].some(v => v.toLowerCase().includes(query.toLowerCase()))).slice(0, 8) : [];

  const add = (p: Product) => {
    setCart(c => {
      const i = c.findIndex(x => x.productId === p.id);
      if (i >= 0) return c.map((x, k) => (k === i ? { ...x, quantity: x.quantity + 1 } : x));
      return [...c, itemFromProduct(p, false)];
    });
    setQuery('');
    scanRef.current?.focus();
  };

  const onScan = async (code: string) => {
    const local = products.find(p => p.barcode === code || p.sku === code);
    if (local) return add(local);
    try {
      add(toProduct(await get(`/api/products/by-barcode/${encodeURIComponent(code)}`)));
    } catch {
      if (matches.length === 1) add(matches[0]);
      else showToast(`No item with barcode ${code}`);
    }
  };

  const setQty = (idx: number, q: number) => setCart(c => (q <= 0 ? c.filter((_, i) => i !== idx) : c.map((x, i) => (i === idx ? { ...x, quantity: q } : x))));

  const checkout = async () => {
    if (!cart.length) return;
    setBusy(true);
    try {
      const inv = await post<Record<string, unknown>>('/api/invoices', {
        walkIn: { name: buyer.name || 'Walk-in customer', phone: buyer.phone || undefined, stateCode: activeBusiness.stateCode },
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price, discountPercent: i.discountPercent || 0 })),
        amountPaid: totals.grandTotal,
        paymentMode: mode,
        notes: mode === 'CASH' && tendered > totals.grandTotal ? `Cash tendered ₹${tendered}, change ₹${tendered - totals.grandTotal}` : undefined
      });
      const printable = toInvoice(inv);
      await printInvoice(printable, activeBusiness, {
        template: settings.template.startsWith('THERMAL') ? settings.template : 'THERMAL_3IN',
        showUpiQr: false,
        showBankDetails: false,
        showSignature: false,
        watermark: !!current?.plan?.watermark
      }).catch(e => showToast(e.message));
      showToast(`${printable.invoiceNumber} · ${formatINR(printable.grandTotal)} paid by ${mode}`);
      setCart([]);
      setTendered(0);
      setBuyer({ name: '', phone: '' });
      reload();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusy(false);
      scanRef.current?.focus();
    }
  };

  const change = mode === 'CASH' && tendered > totals.grandTotal ? tendered - totals.grandTotal : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 pb-12">
      <Card className="lg:col-span-3 p-4 space-y-3">
        <div className="relative">
          <ScanBarcode className="w-4 h-4 text-mango-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={scanRef}
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && query.trim()) {
                e.preventDefault();
                onScan(query.trim());
              }
            }}
            placeholder="Scan barcode or type item name / SKU"
            className={`${inputCls} pl-9 py-3 text-sm`}
          />
          {matches.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-mango-100 rounded-xl shadow-lg overflow-hidden">
              {matches.map(p => (
                <button key={p.id} onClick={() => add(p)} className="w-full text-left px-3 py-2 text-xs hover:bg-mango-50 flex justify-between">
                  <span className="font-semibold text-ink">{p.name} <span className="text-stone-400 font-mono">{p.sku}</span></span>
                  <span className="font-mono">{formatINR(p.sellingPrice)} · {p.currentStock} left</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-stone-500 bg-mango-50/60"><tr><th className="text-left p-2">Item</th><th className="p-2">Qty</th><th className="text-right p-2">Rate</th><th className="text-right p-2">Amount</th><th /></tr></thead>
          <tbody className="divide-y divide-mango-100">
            {totals.lines.map((l, idx) => (
              <tr key={l.id}>
                <td className="p-2 font-semibold text-ink">{l.name}<div className="text-[10px] text-stone-400">GST {l.gstRate}%</div></td>
                <td className="p-2">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setQty(idx, l.quantity - 1)} className="p-1 rounded bg-mango-50 hover:bg-mango-100" aria-label="Less"><Minus className="w-3 h-3" /></button>
                    <input type="number" min={1} value={l.quantity} onChange={e => setQty(idx, Number(e.target.value))} className="w-14 text-center border border-mango-200 rounded p-1 font-mono" />
                    <button onClick={() => setQty(idx, l.quantity + 1)} className="p-1 rounded bg-mango-50 hover:bg-mango-100" aria-label="More"><Plus className="w-3 h-3" /></button>
                  </div>
                </td>
                <td className="p-2 text-right font-mono">{formatINR(l.price)}</td>
                <td className="p-2 text-right font-mono font-bold text-ink">{formatINR(l.totalAmount)}</td>
                <td className="p-2 text-right"><button onClick={() => setQty(idx, 0)} className="text-stone-400 hover:text-rose-600" aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {cart.length === 0 && <div className="text-center text-stone-400 text-xs py-12 flex flex-col items-center gap-2"><Search className="w-6 h-6" />Scan an item to start the bill</div>}
      </Card>

      <Card className="lg:col-span-2 p-4 space-y-4 h-fit text-xs">
        <div className="space-y-1 font-mono">
          <Row k="Taxable" v={totals.taxableTotal} />
          <Row k="CGST" v={totals.cgstTotal} />
          <Row k="SGST" v={totals.sgstTotal} />
          {!!totals.roundOff && <Row k="Round off" v={totals.roundOff} />}
          <div className="flex justify-between border-t-2 border-ink pt-2 text-2xl font-black text-ink font-sans"><span>Total</span><span className="font-mono">{formatINR(totals.grandTotal)}</span></div>
          <div className="text-[10px] text-stone-500 font-sans">{cart.reduce((a, i) => a + i.quantity, 0)} items</div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['CASH', 'UPI', 'CARD'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`py-2.5 rounded-xl font-bold border ${mode === m ? 'bg-mango-500 text-white border-mango-500' : 'bg-white border-mango-200 text-stone-700'}`}>{m}</button>
          ))}
        </div>

        {mode === 'CASH' && (
          <div className="grid grid-cols-2 gap-2 items-end">
            <label className="text-[11px] text-stone-500">Cash received<input type="number" min={0} value={tendered || ''} onChange={e => setTendered(Number(e.target.value))} className={`${inputCls} font-mono text-base`} /></label>
            <div className="text-right"><div className="text-[10px] text-stone-500">Return</div><div className="text-xl font-black font-mono text-leaf-700">{formatINR(change)}</div></div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} placeholder="Customer name (optional)" value={buyer.name} onChange={e => setBuyer({ ...buyer, name: e.target.value })} />
          <input className={inputCls} placeholder="Mobile (optional)" value={buyer.phone} onChange={e => setBuyer({ ...buyer, phone: e.target.value })} />
        </div>

        <PrimaryButton onClick={checkout} disabled={!cart.length || busy || (mode === 'CASH' && tendered > 0 && tendered < totals.grandTotal)} className="w-full justify-center py-3 text-sm">
          <Printer className="w-4 h-4" /> {busy ? 'Billing…' : `Bill ${formatINR(totals.grandTotal)} & print`}
        </PrimaryButton>
        <p className="text-[10px] text-stone-500">Prints on the thermal template from Invoice Settings (3" by default). Walk-in sales are billed as B2C, intra-state.</p>
      </Card>
    </div>
  );
};

const Row: React.FC<{ k: string; v: number }> = ({ k, v }) => (
  <div className="flex justify-between text-stone-600"><span className="font-sans">{k}</span><span>{formatINR(v)}</span></div>
);
