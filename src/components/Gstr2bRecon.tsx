import React, { useRef, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { post, errMsg } from '../api/client';
import { formatINR } from '../utils/formatters';
import { downloadCsv } from '../utils/gst';
import { Card, Badge, GhostButton, PrimaryButton, StatTile, SegmentedTabs, EmptyState } from './admin/ui';
import { Upload, Download, CheckCircle2, AlertTriangle, FileQuestion, ShieldAlert } from 'lucide-react';

type Status = 'MATCHED' | 'MISMATCH' | 'MISSING_IN_BOOKS' | 'MISSING_IN_2B';
interface Row { status: Status; supplierGstin: string; supplier: string; invoiceNo: string; date: string; value2b?: number; valueBooks?: number; tax2b?: number; taxBooks?: number; itcAvailable?: boolean }
interface Result { period: string; summary: { matched: number; mismatch: number; missingInBooks: number; missingIn2b: number; itcAtRisk: number }; rows: Row[] }

const TONE: Record<Status, 'leaf' | 'amber' | 'wave' | 'rose'> = { MATCHED: 'leaf', MISMATCH: 'amber', MISSING_IN_BOOKS: 'wave', MISSING_IN_2B: 'rose' };
const LABEL: Record<Status, string> = { MATCHED: 'Matched', MISMATCH: 'Value mismatch', MISSING_IN_BOOKS: 'Not in your books', MISSING_IN_2B: 'Not filed by supplier' };

/** GSTR-2B vs purchase register (spec §7, §8.9 P1): claim ITC only on invoices suppliers have reported. */
export const Gstr2bRecon: React.FC = () => {
  const { showToast } = useBilling();
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [filter, setFilter] = useState<'ALL' | Status>('ALL');
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const json = JSON.parse(await file.text());
      setResult(await post<Result>('/api/gstr2b/reconcile', json));
    } catch (e) {
      showToast(e instanceof SyntaxError ? 'That file is not valid JSON. Download GSTR-2B as JSON from the GST portal.' : errMsg(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const rows = result?.rows.filter(r => filter === 'ALL' || r.status === filter) ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div>
          <h3 className="font-extrabold text-sm text-ink">GSTR-2B reconciliation</h3>
          <p className="text-stone-500 mt-0.5">GST portal → Returns → GSTR-2B → Download JSON, then upload it here. Bills are matched on supplier GSTIN + invoice number.</p>
        </div>
        <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
        <PrimaryButton onClick={() => input.current?.click()} disabled={busy}><Upload className="w-3.5 h-3.5" /> {busy ? 'Matching…' : 'Upload GSTR-2B JSON'}</PrimaryButton>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Matched" value={String(result.summary.matched)} sub={`period ${result.period}`} icon={CheckCircle2} />
            <StatTile label="Value mismatch" value={String(result.summary.mismatch)} sub="check amounts with supplier" icon={AlertTriangle} />
            <StatTile label="Not in your books" value={String(result.summary.missingInBooks)} sub="enter these purchase bills" icon={FileQuestion} />
            <StatTile label="ITC at risk" value={formatINR(result.summary.itcAtRisk)} sub={`${result.summary.missingIn2b} bills not filed by supplier`} icon={ShieldAlert} />
          </div>
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SegmentedTabs
                value={filter}
                onChange={setFilter}
                options={[{ id: 'ALL', label: 'All', count: result.rows.length }, ...(['MATCHED', 'MISMATCH', 'MISSING_IN_BOOKS', 'MISSING_IN_2B'] as Status[]).map(s => ({ id: s, label: LABEL[s], count: result.rows.filter(r => r.status === s).length }))]}
              />
              <GhostButton onClick={() => downloadCsv(`gstr2b-recon-${result.period}.csv`, ['Status', 'Supplier GSTIN', 'Supplier', 'Invoice', 'Date', 'Value (2B)', 'Value (books)', 'Tax (2B)', 'Tax (books)'], result.rows.map(r => [LABEL[r.status], r.supplierGstin, r.supplier, r.invoiceNo, r.date, r.value2b ?? '', r.valueBooks ?? '', r.tax2b ?? '', r.taxBooks ?? '']))}>
                <Download className="w-3.5 h-3.5" /> CSV
              </GhostButton>
            </div>
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-mango-50/60 text-stone-500 uppercase font-semibold text-[10px] tracking-wider">
                <tr><th className="p-2.5">Status</th><th className="p-2.5">Supplier</th><th className="p-2.5">Invoice</th><th className="p-2.5 text-right">Value 2B / books</th><th className="p-2.5 text-right">Tax 2B / books</th></tr>
              </thead>
              <tbody className="divide-y divide-mango-100">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="p-2.5"><Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>{r.itcAvailable === false && <div className="text-[10px] text-rose-600 mt-0.5">ITC not available</div>}</td>
                    <td className="p-2.5"><div className="font-semibold text-ink">{r.supplier || '—'}</div><div className="text-[10px] font-mono text-stone-500">{r.supplierGstin}</div></td>
                    <td className="p-2.5 font-mono">{r.invoiceNo}<div className="text-[10px] text-stone-500">{r.date}</div></td>
                    <td className="p-2.5 text-right font-mono">{r.value2b !== undefined ? formatINR(r.value2b) : '—'} / {r.valueBooks !== undefined ? formatINR(r.valueBooks) : '—'}</td>
                    <td className="p-2.5 text-right font-mono">{r.tax2b !== undefined ? formatINR(r.tax2b) : '—'} / {r.taxBooks !== undefined ? formatINR(r.taxBooks) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <EmptyState text="Nothing in this category." />}
          </Card>
        </>
      )}
    </div>
  );
};
