import React, { useRef, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { post, errMsg } from '../api/client';
import { downloadCsv } from '../utils/gst';
import { Drawer, GhostButton } from './admin/ui';
import { Upload } from 'lucide-react';

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). Excel: File → Save As → CSV UTF-8. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(v => v.trim() !== '')) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const TEMPLATES = {
  products: {
    header: ['Item Name', 'HSN', 'Unit', 'Selling Price', 'Purchase Price', 'MRP', 'GST %', 'Opening Stock', 'Min Stock', 'SKU', 'Category'],
    sample: [['Ceiling Fan 1200mm', '8414', 'PCS', '2299', '1650', '2799', '18', '25', '5', 'FAN-1200', 'Fans']]
  },
  parties: {
    header: ['Type', 'Name', 'Phone', 'Email', 'GSTIN', 'State Code', 'Address', 'Opening Balance', 'Credit Limit'],
    sample: [['Customer', 'Sunrise Buildcon', '9958011447', 'accounts@sunrise.in', '', '09', 'Sector 62, Noida', '0', '50000']]
  }
};

/** "Import CSV" for items or parties (spec §8.2 / §8.3), with a downloadable template and per-row errors. */
export const ImportButton: React.FC<{ kind: 'products' | 'parties'; defaultType?: 'CUSTOMER' | 'SUPPLIER' }> = ({ kind, defaultType }) => {
  const { showToast, reload, role } = useBilling();
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  if (role !== 'OWNER' && role !== 'ADMIN') return null;

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      let rows = parseCsv(await file.text());
      if (!rows.length) throw new Error('The file has no rows. The first line must be the column headers.');
      if (kind === 'parties' && defaultType) rows = rows.map(r => ({ Type: defaultType === 'SUPPLIER' ? 'Supplier' : 'Customer', ...r }));
      const out = await post<{ created: number; errors: { row: number; message: string }[] }>(`/api/${kind}/import`, { rows: rows.slice(0, 1000) });
      setResult(out);
      showToast(`${out.created} imported${out.errors.length ? `, ${out.errors.length} rows need fixing` : ''}`);
      await reload();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const t = TEMPLATES[kind];
  return (
    <>
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      <GhostButton onClick={() => input.current?.click()} disabled={busy}>
        <Upload className="w-3.5 h-3.5" /> {busy ? 'Importing…' : 'Import CSV'}
      </GhostButton>
      <button type="button" onClick={() => downloadCsv(`${kind}-import-template.csv`, t.header, t.sample)} className="text-[11px] text-mango-700 font-semibold underline-offset-2 hover:underline">
        template
      </button>
      <Drawer open={!!result} onClose={() => setResult(null)} title="Import result">
        {result && (
          <div className="space-y-3 text-xs">
            <p><b className="text-leaf-700">{result.created}</b> rows imported. {result.errors.length ? <><b className="text-rose-600">{result.errors.length}</b> rows were skipped:</> : 'No errors.'}</p>
            <ul className="space-y-1">
              {result.errors.map(e => (
                <li key={e.row} className="bg-rose-50 border border-rose-200 rounded-lg p-2"><b>Row {e.row}:</b> {e.message}</li>
              ))}
            </ul>
          </div>
        )}
      </Drawer>
    </>
  );
};
