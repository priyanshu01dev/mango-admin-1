import React, { useState } from 'react';
import { useBilling } from '../../context/BillingContext';
import { useDocuments, DOC_LABEL } from '../../context/DocumentsContext';
import { DocType, DocStatus, TradeDocument } from '../../types/documents';
import { PaymentMode } from '../../types';
import { formatINR, formatDate } from '../../utils/formatters';
import { downloadCsv } from '../../utils/gst';
import { Card, Badge, PrimaryButton, GhostButton, inputCls, Field, Drawer, EmptyState } from '../admin/ui';
import { DocumentForm } from './DocumentForm';
import { printDocument } from './printDocument';
import { Plus, Printer, XCircle, ArrowRightCircle, Wallet, Truck, Search, Download, Share2 } from 'lucide-react';

const STATUS_TONE: Record<DocStatus, 'stone' | 'mango' | 'leaf' | 'wave' | 'rose' | 'amber'> = {
  DRAFT: 'stone',
  OPEN: 'mango',
  CONVERTED: 'leaf',
  DELIVERED: 'wave',
  UNPAID: 'rose',
  PARTIALLY_PAID: 'amber',
  PAID: 'leaf',
  ISSUED: 'wave',
  CANCELLED: 'stone'
};

export const DocumentList: React.FC<{ docType: DocType; description: string }> = ({ docType, description }) => {
  const { activeBusiness, parties } = useBilling();
  const { documents, cancelDocument, convertToInvoice, convertPoToBill, payPurchaseBill, markDelivered } = useDocuments();
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<TradeDocument | null>(null);
  const [query, setQuery] = useState('');

  const rows = documents
    .filter(d => d.docType === docType && d.businessId === activeBusiness.id)
    .filter(d => !query || [d.number, d.partyName, d.reference ?? ''].some(v => v.toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));

  const live = rows.filter(d => d.status !== 'CANCELLED');
  const total = live.reduce((a, d) => a + d.grandTotal, 0);
  const outstanding = docType === 'PURCHASE_BILL' ? live.reduce((a, d) => a + (d.grandTotal - d.amountPaid), 0) : 0;
  const canConvertToInvoice = docType === 'PROFORMA' || docType === 'SALES_ORDER' || docType === 'DELIVERY_CHALLAN';

  const onCancel = (d: TradeDocument) => {
    const reason = window.prompt(`Cancel ${d.number}? Enter a reason (kept in the audit trail, number is not reused):`);
    if (reason && reason.trim()) cancelDocument(d.id, reason.trim());
  };

  const onConvertPo = (d: TradeDocument) => {
    const bill = window.prompt(`Goods received for ${d.number}. Enter the supplier's bill number:`);
    if (bill && bill.trim()) convertPoToBill(d.id, bill.trim());
  };

  const share = (d: TradeDocument) => {
    const phone = parties.find(p => p.id === d.partyId)?.phone.replace(/[^0-9]/g, '') ?? '';
    const text = `${DOC_LABEL[d.docType]} ${d.number} dated ${formatDate(d.date)} for ${formatINR(d.grandTotal)} from ${activeBusiness.tradeName || activeBusiness.name}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const exportRows = () =>
    downloadCsv(
      `${docType.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Number', 'Date', 'Party', 'GSTIN', 'Reference', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Paid', 'Status'],
      rows.map(d => [d.number, d.date, d.partyName, d.partyGstin ?? '', d.reference ?? '', d.taxableTotal, d.cgstTotal, d.sgstTotal, d.igstTotal, d.grandTotal, d.amountPaid, d.status])
    );

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-stone-500">{description}</p>
          <div className="text-[11px] mt-1 text-stone-600">
            {live.length} active · total <b className="font-mono text-ink">{formatINR(total)}</b>
            {docType === 'PURCHASE_BILL' && <> · payable <b className="font-mono text-rose-600">{formatINR(outstanding)}</b></>}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Number, party, ref…" className={`${inputCls} pl-8 w-52`} />
          </div>
          <GhostButton onClick={exportRows}><Download className="w-3.5 h-3.5" /> CSV</GhostButton>
          <PrimaryButton onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5" /> New</PrimaryButton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-stone-700">
          <thead className="bg-mango-50/60 text-stone-500 uppercase font-semibold text-[10px] tracking-wider">
            <tr>
              <th className="p-3">Number</th>
              <th className="p-3">Date</th>
              <th className="p-3">Party</th>
              <th className="p-3">{docType === 'DELIVERY_CHALLAN' ? 'Purpose' : 'Reference'}</th>
              <th className="p-3 text-right">Taxable</th>
              <th className="p-3 text-right">GST</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mango-100">
            {rows.map(d => (
              <tr key={d.id} className={`hover:bg-mango-50/50 ${d.status === 'CANCELLED' ? 'opacity-55' : ''}`}>
                <td className="p-3 font-mono font-bold text-ink whitespace-nowrap">{d.number}</td>
                <td className="p-3 whitespace-nowrap">{formatDate(d.date)}</td>
                <td className="p-3">
                  <div className="font-semibold text-ink">{d.partyName}</div>
                  <div className="text-[10px] font-mono text-stone-500">{d.partyGstin || 'Unregistered'} · {d.isInterState ? 'IGST' : 'CGST+SGST'}</div>
                </td>
                <td className="p-3 text-[11px]">
                  {docType === 'DELIVERY_CHALLAN' ? d.reason : d.reference ?? '—'}
                  {(docType === 'CREDIT_NOTE' || docType === 'DEBIT_NOTE') && <div className="text-[10px] text-stone-500">{d.reason}</div>}
                  {d.convertedTo && <div className="text-[10px] text-leaf-700 font-semibold">→ {d.convertedTo}</div>}
                </td>
                <td className="p-3 text-right font-mono">{formatINR(d.taxableTotal)}</td>
                <td className="p-3 text-right font-mono text-stone-500">{formatINR(d.totalGst)}</td>
                <td className="p-3 text-right font-mono font-bold text-ink">
                  {formatINR(d.grandTotal)}
                  {docType === 'PURCHASE_BILL' && d.amountPaid > 0 && d.amountPaid < d.grandTotal && (
                    <div className="text-[10px] text-rose-600 font-semibold">due {formatINR(d.grandTotal - d.amountPaid)}</div>
                  )}
                </td>
                <td className="p-3">
                  <Badge tone={STATUS_TONE[d.status]}>{d.status.replace('_', ' ')}</Badge>
                  {docType === 'PURCHASE_BILL' && d.itcEligible === false && <div className="text-[10px] text-stone-500 mt-0.5">no ITC</div>}
                </td>
                <td className="p-3 text-right whitespace-nowrap space-x-1">
                  <IconBtn title="Print / PDF" onClick={() => printDocument(d, activeBusiness)}><Printer className="w-3.5 h-3.5" /></IconBtn>
                  {d.status !== 'CANCELLED' && <IconBtn title="Share on WhatsApp" onClick={() => share(d)}><Share2 className="w-3.5 h-3.5" /></IconBtn>}
                  {canConvertToInvoice && d.status !== 'CONVERTED' && d.status !== 'CANCELLED' && (
                    <IconBtn title="Convert to tax invoice" tone="leaf" onClick={() => window.confirm(`Create a tax invoice from ${d.number}?`) && convertToInvoice(d.id)}>
                      <ArrowRightCircle className="w-3.5 h-3.5" />
                    </IconBtn>
                  )}
                  {docType === 'SALES_ORDER' && d.status === 'OPEN' && (
                    <IconBtn title="Mark delivered" onClick={() => markDelivered(d.id)}><Truck className="w-3.5 h-3.5" /></IconBtn>
                  )}
                  {docType === 'PURCHASE_ORDER' && d.status === 'OPEN' && (
                    <IconBtn title="Goods received → purchase bill" tone="leaf" onClick={() => onConvertPo(d)}><ArrowRightCircle className="w-3.5 h-3.5" /></IconBtn>
                  )}
                  {docType === 'PURCHASE_BILL' && (d.status === 'UNPAID' || d.status === 'PARTIALLY_PAID') && (
                    <IconBtn title="Record payment out" tone="leaf" onClick={() => setPaying(d)}><Wallet className="w-3.5 h-3.5" /></IconBtn>
                  )}
                  {d.status !== 'CANCELLED' && d.status !== 'CONVERTED' && (
                    <IconBtn title="Cancel" tone="rose" onClick={() => onCancel(d)}><XCircle className="w-3.5 h-3.5" /></IconBtn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState text={`No ${DOC_LABEL[docType].toLowerCase()}s yet.`} />}
      </div>

      <Drawer open={creating} onClose={() => setCreating(false)} title={`New ${DOC_LABEL[docType]}`} width="max-w-3xl">
        {creating && <DocumentForm docType={docType} onDone={() => setCreating(false)} />}
      </Drawer>

      <Drawer open={!!paying} onClose={() => setPaying(null)} title={`Pay supplier · ${paying?.number ?? ''}`}>
        {paying && <PayForm doc={paying} onPay={(amt, mode, ref) => { payPurchaseBill(paying.id, amt, mode, ref); setPaying(null); }} />}
      </Drawer>
    </Card>
  );
};

const IconBtn: React.FC<{ title: string; onClick: () => void; tone?: 'leaf' | 'rose'; children: React.ReactNode }> = ({ title, onClick, tone, children }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`p-1.5 rounded-lg transition-colors ${
      tone === 'leaf' ? 'text-leaf-600 hover:bg-leaf-50' : tone === 'rose' ? 'text-rose-600 hover:bg-rose-50' : 'text-stone-600 hover:bg-mango-100'
    }`}
  >
    {children}
  </button>
);

const PayForm: React.FC<{ doc: TradeDocument; onPay: (amount: number, mode: PaymentMode, ref: string) => void }> = ({ doc, onPay }) => {
  const due = doc.grandTotal - doc.amountPaid;
  const [amount, setAmount] = useState(due);
  const [mode, setMode] = useState<PaymentMode>('NEFT_RTGS');
  const [ref, setRef] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); if (amount > 0 && amount <= due) onPay(amount, mode, ref); }} className="space-y-3 text-xs">
      <div className="bg-mango-50 border border-mango-100 rounded-xl p-3">
        <div className="font-bold text-ink">{doc.partyName}</div>
        <div className="text-stone-500">Bill {doc.reference ?? doc.number} · Total {formatINR(doc.grandTotal)} · Paid {formatINR(doc.amountPaid)}</div>
        <div className="text-rose-600 font-bold mt-1">Balance due {formatINR(due)}</div>
      </div>
      <Field label="Amount (₹)"><input type="number" min={1} max={due} step="0.01" className={`${inputCls} font-mono`} value={amount} onChange={e => setAmount(Number(e.target.value))} /></Field>
      <Field label="Mode">
        <select className={inputCls} value={mode} onChange={e => setMode(e.target.value as PaymentMode)}>
          {(['NEFT_RTGS', 'UPI', 'CHEQUE', 'CASH', 'CARD'] as PaymentMode[]).map(m => <option key={m} value={m}>{m.replace('_', ' / ')}</option>)}
        </select>
      </Field>
      <Field label="UTR / cheque / UPI ref"><input className={`${inputCls} font-mono`} value={ref} onChange={e => setRef(e.target.value)} /></Field>
      {mode === 'CASH' && amount > 10000 && (
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">Cash payments above ₹10,000 to one person in a day are disallowed as an expense under Sec 40A(3) of the Income Tax Act.</div>
      )}
      <PrimaryButton type="submit" disabled={amount <= 0 || amount > due}>Record payment out</PrimaryButton>
    </form>
  );
};
