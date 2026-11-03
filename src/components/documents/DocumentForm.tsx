import React, { useMemo, useState } from 'react';
import { useBilling } from '../../context/BillingContext';
import { useDocuments, DOC_LABEL, isPurchaseDoc, NewDocument } from '../../context/DocumentsContext';
import { DocType } from '../../types/documents';
import { InvoiceItem } from '../../types';
import { recalcItem, docTotals, itemFromProduct, localDate } from '../../utils/gst';
import { formatINR, getStateNameByCode } from '../../utils/formatters';
import { Field, inputCls, PrimaryButton, GhostButton, Toggle } from '../admin/ui';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';

const GST_RATES = [0, 5, 12, 18, 28];
const CREDIT_REASONS = ['Sales return — defective units', 'Sales return — wrong item', 'Post-sale discount', 'Rate difference', 'Deficiency in service'];
const DEBIT_REASONS = ['Damaged in transit', 'Short supply', 'Quality rejected', 'Rate difference'];
const CHALLAN_PURPOSES = ['Supply on approval', 'Job work', 'Stock transfer to branch', 'Sale (invoice to follow)', 'Exhibition / demo'];

export const DocumentForm: React.FC<{ docType: DocType; onDone: () => void }> = ({ docType, onDone }) => {
  const { activeBusiness, parties, products, invoices } = useBilling();
  const { createDocument, nextDocNumber, documents, settings } = useDocuments();
  const purchase = isPurchaseDoc(docType);
  const partyType = purchase ? 'SUPPLIER' : 'CUSTOMER';
  const bizParties = parties.filter(p => p.businessId === activeBusiness.id && p.type === partyType && p.status === 'ACTIVE');
  const bizProducts = products.filter(p => p.businessId === activeBusiness.id && p.status === 'ACTIVE');

  const today = localDate();
  const plus = (d: number) => localDate(d);

  const [partyId, setPartyId] = useState(bizParties[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState(plus(docType === 'PURCHASE_BILL' ? 30 : settings.defaultDueDays));
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState(docType === 'CREDIT_NOTE' ? CREDIT_REASONS[0] : docType === 'DEBIT_NOTE' ? DEBIT_REASONS[0] : docType === 'DELIVERY_CHALLAN' ? CHALLAN_PURPOSES[0] : '');
  const [restock, setRestock] = useState(true);
  const [itcEligible, setItcEligible] = useState(true);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState('');

  const party = bizParties.find(p => p.id === partyId);
  const isInterState = party ? party.stateCode !== activeBusiness.stateCode : false;

  const [items, setItems] = useState<InvoiceItem[]>(() =>
    bizProducts[0] ? [itemFromProduct(bizProducts[0], isInterState, purchase ? 'purchasePrice' : 'sellingPrice')] : []
  );

  // re-split tax whenever the party's state changes
  const lines = useMemo(() => items.map(i => recalcItem(i, isInterState)), [items, isInterState]);
  const totals = docTotals(lines, settings.roundOff);

  const updateLine = (idx: number, patch: Partial<InvoiceItem>) => setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const pickProduct = (idx: number, productId: string) => {
    const p = bizProducts.find(x => x.id === productId);
    if (!p) return;
    setItems(prev => prev.map((it, i) => (i === idx ? itemFromProduct(p, isInterState, purchase ? 'purchasePrice' : 'sellingPrice', it.quantity) : it)));
  };

  // references the user can link this note to
  const refOptions =
    docType === 'CREDIT_NOTE'
      ? invoices.filter(i => i.customerId === partyId && i.status !== 'CANCELLED').map(i => i.invoiceNumber)
      : docType === 'DEBIT_NOTE'
      ? documents.filter(d => d.docType === 'PURCHASE_BILL' && d.partyId === partyId && d.status !== 'CANCELLED').map(d => d.number)
      : [];

  const eWayWarning = (docType === 'DELIVERY_CHALLAN' || docType === 'PURCHASE_BILL') && totals.grandTotal > 50000;
  const invalid = !party || lines.length === 0 || lines.some(l => l.quantity <= 0 || l.price < 0) || ((docType === 'CREDIT_NOTE' || docType === 'DEBIT_NOTE') && !reference);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid || !party) return;
    const doc: NewDocument = {
      docType,
      partyId: party.id,
      partyName: party.name,
      partyGstin: party.gstin,
      partyStateCode: party.stateCode,
      date,
      dueDate: ['PURCHASE_BILL', 'PROFORMA', 'SALES_ORDER', 'PURCHASE_ORDER'].includes(docType) ? dueDate : undefined,
      isInterState,
      items: lines,
      taxableTotal: totals.taxableTotal,
      cgstTotal: totals.cgstTotal,
      sgstTotal: totals.sgstTotal,
      igstTotal: totals.igstTotal,
      totalGst: totals.totalGst,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      amountPaid: docType === 'PURCHASE_BILL' ? Math.min(amountPaid, totals.grandTotal) : 0,
      reference: reference || undefined,
      reason: reason || undefined,
      restock: docType === 'CREDIT_NOTE' ? restock : undefined,
      itcEligible: docType === 'PURCHASE_BILL' ? itcEligible : undefined,
      vehicleNumber: vehicleNumber || undefined,
      notes: notes || undefined
    };
    createDocument(doc);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-xs">
      <div className="flex items-center justify-between bg-mango-50 border border-mango-100 rounded-xl px-3 py-2">
        <span className="font-bold text-ink">{DOC_LABEL[docType]}</span>
        <span className="font-mono font-bold text-mango-700">{nextDocNumber(docType)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label={purchase ? 'Supplier' : 'Customer'}>
            <select className={inputCls} value={partyId} onChange={e => { setPartyId(e.target.value); setReference(''); }} required>
              {bizParties.length === 0 && <option value="">No {partyType.toLowerCase()}s — add one in Parties</option>}
              {bizParties.map(p => (
                <option key={p.id} value={p.id}>{p.name} {p.gstin ? `· ${p.gstin}` : ''}</option>
              ))}
            </select>
          </Field>
          {party && (
            <div className="text-[10px] text-stone-500 mt-1">
              Place of supply: {getStateNameByCode(party.stateCode)} ({party.stateCode}) ·{' '}
              <b className="text-ink">{isInterState ? 'Inter-state → IGST' : 'Intra-state → CGST + SGST'}</b>
            </div>
          )}
        </div>
        <Field label="Date"><input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} required /></Field>
        {['PURCHASE_BILL', 'PROFORMA', 'SALES_ORDER', 'PURCHASE_ORDER'].includes(docType) && (
          <Field label={docType === 'PURCHASE_BILL' ? 'Payment due' : docType === 'PROFORMA' ? 'Valid until' : 'Expected delivery'}>
            <input type="date" className={inputCls} value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </Field>
        )}
        {docType === 'PURCHASE_BILL' && (
          <Field label="Supplier bill no."><input className={`${inputCls} font-mono`} value={reference} onChange={e => setReference(e.target.value)} placeholder="As printed on supplier invoice" /></Field>
        )}
        {(docType === 'CREDIT_NOTE' || docType === 'DEBIT_NOTE') && (
          <>
            <Field label={docType === 'CREDIT_NOTE' ? 'Against invoice' : 'Against purchase bill'}>
              <select className={inputCls} value={reference} onChange={e => setReference(e.target.value)} required>
                <option value="">Select…</option>
                {refOptions.map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Reason">
              <select className={inputCls} value={reason} onChange={e => setReason(e.target.value)}>
                {(docType === 'CREDIT_NOTE' ? CREDIT_REASONS : DEBIT_REASONS).map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
          </>
        )}
        {docType === 'DELIVERY_CHALLAN' && (
          <>
            <Field label="Purpose">
              <select className={inputCls} value={reason} onChange={e => setReason(e.target.value)}>
                {CHALLAN_PURPOSES.map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Vehicle no."><input className={`${inputCls} font-mono uppercase`} value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value.toUpperCase())} placeholder="DL01AB1234" /></Field>
          </>
        )}
      </div>

      {/* Line items */}
      <div className="border border-mango-100 rounded-xl overflow-hidden">
        <table className="w-full text-[11px]">
          <thead className="bg-mango-50/60 text-stone-500 uppercase text-[9px] tracking-wider">
            <tr>
              <th className="p-2 text-left">Item</th>
              <th className="p-2 w-16">Qty</th>
              <th className="p-2 w-24">Rate ₹</th>
              <th className="p-2 w-14">Disc %</th>
              <th className="p-2 w-16">GST</th>
              <th className="p-2 text-right w-24">Amount</th>
              <th className="w-7" />
            </tr>
          </thead>
          <tbody className="divide-y divide-mango-100">
            {lines.map((l, idx) => (
              <tr key={l.id}>
                <td className="p-1.5">
                  <select className={`${inputCls} py-1.5`} value={l.productId ?? ''} onChange={e => pickProduct(idx, e.target.value)}>
                    {bizProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="text-[9px] text-stone-400 mt-0.5 font-mono">HSN {l.hsnCode} · {l.unit}</div>
                </td>
                <td className="p-1.5"><input type="number" min={1} className={`${inputCls} py-1.5 font-mono`} value={l.quantity} onChange={e => updateLine(idx, { quantity: Math.max(0, Number(e.target.value)) })} /></td>
                <td className="p-1.5"><input type="number" min={0} step="0.01" className={`${inputCls} py-1.5 font-mono`} value={l.price} onChange={e => updateLine(idx, { price: Math.max(0, Number(e.target.value)) })} /></td>
                <td className="p-1.5"><input type="number" min={0} max={100} className={`${inputCls} py-1.5 font-mono`} value={l.discountPercent} onChange={e => updateLine(idx, { discountPercent: Math.min(100, Math.max(0, Number(e.target.value))) })} /></td>
                <td className="p-1.5">
                  <select className={`${inputCls} py-1.5`} value={l.gstRate} onChange={e => updateLine(idx, { gstRate: Number(e.target.value) })}>
                    {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </td>
                <td className="p-1.5 text-right font-mono font-bold text-ink">{formatINR(l.totalAmount)}</td>
                <td className="p-1.5">
                  <button type="button" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-stone-400 hover:text-rose-600" aria-label="Remove line">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-2 border-t border-mango-100">
          <GhostButton
            type="button"
            onClick={() => bizProducts[0] && setItems(prev => [...prev, itemFromProduct(bizProducts[0], isInterState, purchase ? 'purchasePrice' : 'sellingPrice')])}
          >
            <Plus className="w-3.5 h-3.5" /> Add item
          </GhostButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          {docType === 'CREDIT_NOTE' && (
            <label className="flex items-center justify-between gap-2"><span className="font-semibold text-stone-700">Put returned goods back in stock</span><Toggle checked={restock} onChange={setRestock} /></label>
          )}
          {docType === 'PURCHASE_BILL' && (
            <>
              <label className="flex items-center justify-between gap-2"><span className="font-semibold text-stone-700">GST input (ITC) eligible</span><Toggle checked={itcEligible} onChange={setItcEligible} /></label>
              <Field label="Paid now (₹)"><input type="number" min={0} className={`${inputCls} font-mono`} value={amountPaid} onChange={e => setAmountPaid(Math.max(0, Number(e.target.value)))} /></Field>
            </>
          )}
          <Field label="Notes"><textarea rows={2} className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
        </div>
        <div className="bg-cream border border-mango-100 rounded-xl p-3 space-y-1 font-mono text-[11px] h-fit">
          <Row k="Taxable value" v={formatINR(totals.taxableTotal)} />
          {isInterState ? <Row k="IGST" v={formatINR(totals.igstTotal)} /> : (<><Row k="CGST" v={formatINR(totals.cgstTotal)} /><Row k="SGST" v={formatINR(totals.sgstTotal)} /></>)}
          {totals.roundOff !== 0 && <Row k="Round off" v={formatINR(totals.roundOff)} />}
          <div className="flex justify-between pt-1.5 border-t border-mango-200 text-sm font-black text-ink font-sans"><span>Total</span><span className="font-mono">{formatINR(totals.grandTotal)}</span></div>
        </div>
      </div>

      {eWayWarning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Consignment value is above ₹50,000. An e-way bill is required before goods move.
        </div>
      )}

      <PrimaryButton type="submit" disabled={invalid}>Save {DOC_LABEL[docType]}</PrimaryButton>
    </form>
  );
};

const Row: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="flex justify-between text-stone-600"><span className="font-sans">{k}</span><span>{v}</span></div>
);
