import React, { useState } from 'react';
import { useDocuments, DOC_LABEL } from '../context/DocumentsContext';
import { InvoiceSettings, InvoiceTemplate, DocType } from '../types/documents';
import { isValidDocNumber } from '../utils/gst';
import { Card, Field, inputCls, PrimaryButton, GhostButton, Toggle } from './admin/ui';
import { FileCog } from 'lucide-react';

const TEMPLATES: { id: InvoiceTemplate; label: string; note: string }[] = [
  { id: 'A4_CLASSIC', label: 'A4 Classic', note: 'GST Rule 46 table layout' },
  { id: 'A4_MODERN', label: 'A4 Modern', note: 'Mango colour header' },
  { id: 'A5', label: 'A5 Half page', note: 'Retail counters' },
  { id: 'THERMAL_3IN', label: 'Thermal 3" (80mm)', note: 'ESC/POS printers' },
  { id: 'THERMAL_2IN', label: 'Thermal 2" (58mm)', note: 'Pocket printers' }
];

export const InvoiceSettingsPanel: React.FC = () => {
  const { settings, updateSettings, nextInvoiceNumber } = useDocuments();
  const [s, setS] = useState<InvoiceSettings>(settings);
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);

  const preview = s.prefix + String(s.nextNumber).padStart(s.padding, '0');
  const previewOk = isValidDocNumber(preview);
  const prefixesOk = (Object.values(s.docPrefixes) as string[]).every(p => isValidDocNumber(p + '0'.repeat(s.padding)));

  return (
    <Card className="p-6 space-y-6 text-xs">
      <div className="flex items-center justify-between border-b border-mango-100 pb-3">
        <div className="flex items-center gap-2">
          <FileCog className="w-4 h-4 text-mango-500" />
          <h3 className="font-extrabold text-sm text-ink">Invoice numbering, template & defaults</h3>
        </div>
        <div className="flex gap-2">
          <GhostButton onClick={() => setS(settings)} disabled={!dirty}>Discard</GhostButton>
          <PrimaryButton onClick={() => updateSettings(s)} disabled={!dirty || !previewOk || !prefixesOk}>Save settings</PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="Invoice prefix" hint="Letters, digits, - and / only">
          <input className={`${inputCls} font-mono uppercase`} value={s.prefix} onChange={e => setS({ ...s, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9/-]/g, '') })} />
        </Field>
        <Field label="Starting / next number" hint={`Actual next: ${nextInvoiceNumber()}`}>
          <input type="number" min={1} className={`${inputCls} font-mono`} value={s.nextNumber} onChange={e => setS({ ...s, nextNumber: Math.max(1, Number(e.target.value)) })} />
        </Field>
        <Field label="Digits (zero padding)">
          <select className={inputCls} value={s.padding} onChange={e => setS({ ...s, padding: Number(e.target.value) })}>
            {[3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <div>
          <span className="block text-[11px] font-semibold text-stone-500 mb-1">Preview</span>
          <div className={`font-mono font-black text-sm px-3 py-2 rounded-lg border ${previewOk ? 'bg-mango-50 border-mango-200 text-ink' : 'bg-rose-50 border-rose-300 text-rose-700'}`}>{preview}</div>
          <span className={`text-[10px] ${previewOk ? 'text-stone-400' : 'text-rose-600 font-semibold'}`}>{preview.length}/16 characters (Rule 46)</span>
        </div>
      </div>

      <label className="flex items-center justify-between max-w-xl">
        <span>
          <span className="font-semibold text-stone-700 block">Restart numbering every financial year (1 April)</span>
          <span className="text-[10px] text-stone-500">Prefix should carry the FY, e.g. INV/26-27/. Numbers are never reused, even after cancellation.</span>
        </span>
        <Toggle checked={s.financialYearReset} onChange={v => setS({ ...s, financialYearReset: v })} />
      </label>

      <div>
        <h4 className="font-extrabold text-ink mb-2">Other document prefixes</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(s.docPrefixes) as DocType[]).map(k => (
            <Field key={k} label={DOC_LABEL[k]}>
              <input className={`${inputCls} font-mono uppercase`} value={s.docPrefixes[k]} onChange={e => setS({ ...s, docPrefixes: { ...s.docPrefixes, [k]: e.target.value.toUpperCase().replace(/[^A-Z0-9/-]/g, '') } })} />
            </Field>
          ))}
        </div>
        {!prefixesOk && <div className="text-[11px] text-rose-600 font-semibold mt-1">A prefix plus number would exceed 16 characters.</div>}
      </div>

      <div>
        <h4 className="font-extrabold text-ink mb-2">Print template</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setS({ ...s, template: t.id })}
              className={`p-3 rounded-xl border text-left ${s.template === t.id ? 'border-mango-500 bg-mango-50 ring-1 ring-mango-500' : 'border-mango-100 hover:bg-mango-50/50'}`}
            >
              <div className="font-bold text-ink">{t.label}</div>
              <div className="text-[10px] text-stone-500">{t.note}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 max-w-3xl">
        {([
          ['showUpiQr', 'Print UPI QR with amount'],
          ['showBankDetails', 'Print bank details (NEFT / RTGS)'],
          ['showSignature', 'Print authorised signatory'],
          ['roundOff', 'Round off grand total to nearest rupee']
        ] as const).map(([k, label]) => (
          <label key={k} className="flex items-center justify-between">
            <span className="font-semibold text-stone-700">{label}</span>
            <Toggle checked={s[k]} onChange={v => setS({ ...s, [k]: v })} />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Default payment terms (days)">
          <input type="number" min={0} className={`${inputCls} font-mono`} value={s.defaultDueDays} onChange={e => setS({ ...s, defaultDueDays: Math.max(0, Number(e.target.value)) })} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Default note on invoices">
            <input className={inputCls} value={s.defaultNotes} onChange={e => setS({ ...s, defaultNotes: e.target.value })} />
          </Field>
        </div>
      </div>
    </Card>
  );
};
