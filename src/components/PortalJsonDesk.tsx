import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { get, post, errMsg, ApiError } from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { Card, Badge, GhostButton, PrimaryButton, Field, inputCls, Drawer, EmptyState } from './admin/ui';
import { Download, FileCheck2, Truck, ExternalLink } from 'lucide-react';
import type { Invoice } from '../types';

const saveJson = (data: unknown, name: string) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * e-Invoice / e-Way bill without a GSP (spec §8.6): download the official JSON, upload it on the
 * government portal's bulk tool, then record the IRN / EWB number here.
 */
export const PortalJsonDesk: React.FC = () => {
  const { invoices, showToast, reload, role } = useBilling();
  const [recordIrn, setRecordIrn] = useState<Invoice | null>(null);
  const [recordEwb, setRecordEwb] = useState<Invoice | null>(null);
  const [ewbFor, setEwbFor] = useState<Invoice | null>(null);
  const canRecord = role === 'OWNER' || role === 'ADMIN';

  const needIrn = invoices.filter(i => i.status !== 'CANCELLED' && i.customerGstin && i.eInvoiceStatus !== 'GENERATED');
  const needEwb = invoices.filter(i => i.status !== 'CANCELLED' && i.grandTotal > 50000 && i.eWayBillStatus !== 'GENERATED');

  const issuesToast = (e: unknown) => {
    if (e instanceof ApiError && Array.isArray(e.details)) showToast(`${e.message}: ${(e.details as { message: string }[]).map(d => d.message).join(' · ')}`);
    else showToast(errMsg(e));
  };

  const irnJson = async (inv: Invoice) => {
    try {
      saveJson(await get(`/api/invoices/${inv.id}/einvoice/json`), `einvoice-${inv.invoiceNumber.replace(/\//g, '-')}.json`);
    } catch (e) {
      issuesToast(e);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 text-xs text-stone-600 space-y-1">
        <p><b className="text-ink">No GSP yet? Use the government portals directly.</b> Download the JSON, upload it, and record the number you get back:</p>
        <p>
          e-Invoice: <a className="text-mango-700 font-semibold inline-flex items-center gap-0.5" href="https://einvoice1.gst.gov.in" target="_blank" rel="noreferrer">IRP portal <ExternalLink className="w-3 h-3" /></a> → Bulk Generation Tool ·
          e-Way bill: <a className="text-mango-700 font-semibold inline-flex items-center gap-0.5" href="https://ewaybillgst.gov.in" target="_blank" rel="noreferrer">EWB portal <ExternalLink className="w-3 h-3" /></a> → e-Waybill → Generate Bulk
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-2">
          <h3 className="font-extrabold text-sm text-ink flex items-center gap-2"><FileCheck2 className="w-4 h-4 text-mango-500" /> B2B invoices without IRN ({needIrn.length})</h3>
          {needIrn.map(i => (
            <div key={i.id} className="flex items-center justify-between gap-2 text-xs border border-mango-100 rounded-xl p-2.5">
              <div><div className="font-mono font-bold text-ink">{i.invoiceNumber}</div><div className="text-[10px] text-stone-500">{i.customerName} · {formatDate(i.invoiceDate)} · {formatINR(i.grandTotal)}</div></div>
              <div className="flex gap-1.5">
                <GhostButton onClick={() => irnJson(i)}><Download className="w-3 h-3" /> JSON</GhostButton>
                {canRecord && <GhostButton onClick={() => setRecordIrn(i)}>Record IRN</GhostButton>}
              </div>
            </div>
          ))}
          {needIrn.length === 0 && <EmptyState text="All B2B invoices have an IRN." />}
        </Card>

        <Card className="p-4 space-y-2">
          <h3 className="font-extrabold text-sm text-ink flex items-center gap-2"><Truck className="w-4 h-4 text-mango-500" /> Above ₹50,000 without e-way bill ({needEwb.length})</h3>
          {needEwb.map(i => (
            <div key={i.id} className="flex items-center justify-between gap-2 text-xs border border-mango-100 rounded-xl p-2.5">
              <div><div className="font-mono font-bold text-ink">{i.invoiceNumber}</div><div className="text-[10px] text-stone-500">{i.customerName} · {formatINR(i.grandTotal)}</div></div>
              <div className="flex gap-1.5">
                <GhostButton onClick={() => setEwbFor(i)}><Download className="w-3 h-3" /> JSON</GhostButton>
                {canRecord && <GhostButton onClick={() => setRecordEwb(i)}>Record EWB</GhostButton>}
              </div>
            </div>
          ))}
          {needEwb.length === 0 && <EmptyState text="No pending e-way bills." />}
        </Card>
      </div>

      <Drawer open={!!ewbFor} onClose={() => setEwbFor(null)} title={`e-Way bill JSON · ${ewbFor?.invoiceNumber ?? ''}`}>
        {ewbFor && <EwbJsonForm inv={ewbFor} onDone={() => setEwbFor(null)} onError={issuesToast} />}
      </Drawer>
      <Drawer open={!!recordIrn} onClose={() => setRecordIrn(null)} title={`Record IRN · ${recordIrn?.invoiceNumber ?? ''}`}>
        {recordIrn && (
          <RecordForm
            fields={[{ key: 'irn', label: 'IRN (64 characters)', mono: true }, { key: 'ackNo', label: 'Ack no.', mono: true }, { key: 'ackDate', label: 'Ack date (as shown)', placeholder: '2026-11-04 10:15:00' }, { key: 'signedQr', label: 'Signed QR code (optional)' }]}
            onSubmit={async v => {
              await post(`/api/invoices/${recordIrn.id}/einvoice/manual`, { ...v, signedQr: v.signedQr || undefined });
              showToast('IRN recorded');
              setRecordIrn(null);
              reload();
            }}
            onError={issuesToast}
          />
        )}
      </Drawer>
      <Drawer open={!!recordEwb} onClose={() => setRecordEwb(null)} title={`Record e-way bill · ${recordEwb?.invoiceNumber ?? ''}`}>
        {recordEwb && (
          <RecordForm
            fields={[{ key: 'number', label: 'E-way bill no. (12 digits)', mono: true }, { key: 'validUpto', label: 'Valid until', placeholder: '06/11/2026 11:59 PM' }, { key: 'vehicleNumber', label: 'Vehicle no.', mono: true }]}
            onSubmit={async v => {
              await post(`/api/invoices/${recordEwb.id}/ewaybill/manual`, { ...v, vehicleNumber: v.vehicleNumber || undefined });
              showToast('E-way bill recorded');
              setRecordEwb(null);
              reload();
            }}
            onError={issuesToast}
          />
        )}
      </Drawer>
    </div>
  );
};

const EwbJsonForm: React.FC<{ inv: Invoice; onDone: () => void; onError: (e: unknown) => void }> = ({ inv, onDone, onError }) => {
  const [f, setF] = useState({ distanceKm: 50, vehicleNumber: inv.transport?.vehicleNumber ?? '', transporterId: '', transporterName: inv.transport?.transporterName ?? '' });
  return (
    <form
      className="space-y-3 text-xs"
      onSubmit={async e => {
        e.preventDefault();
        try {
          const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '').map(([k, v]) => [k, String(v)]));
          saveJson(await get(`/api/invoices/${inv.id}/ewaybill/json?${q}`), `ewaybill-${inv.invoiceNumber.replace(/\//g, '-')}.json`);
          onDone();
        } catch (err) {
          onError(err);
        }
      }}
    >
      <Field label="Distance (km)"><input type="number" min={1} max={4000} className={inputCls} value={f.distanceKm} onChange={e => setF({ ...f, distanceKm: Number(e.target.value) })} /></Field>
      <Field label="Vehicle no."><input className={`${inputCls} font-mono uppercase`} value={f.vehicleNumber} onChange={e => setF({ ...f, vehicleNumber: e.target.value.toUpperCase() })} /></Field>
      <Field label="Transporter ID (GSTIN / TRANSIN, optional)"><input className={`${inputCls} font-mono uppercase`} value={f.transporterId} onChange={e => setF({ ...f, transporterId: e.target.value.toUpperCase() })} /></Field>
      <Field label="Transporter name"><input className={inputCls} value={f.transporterName} onChange={e => setF({ ...f, transporterName: e.target.value })} /></Field>
      <PrimaryButton type="submit"><Download className="w-3.5 h-3.5" /> Download JSON</PrimaryButton>
    </form>
  );
};

const RecordForm: React.FC<{ fields: { key: string; label: string; mono?: boolean; placeholder?: string }[]; onSubmit: (v: Record<string, string>) => Promise<void>; onError: (e: unknown) => void }> = ({ fields, onSubmit, onError }) => {
  const [v, setV] = useState<Record<string, string>>({});
  return (
    <form
      className="space-y-3 text-xs"
      onSubmit={async e => {
        e.preventDefault();
        try {
          await onSubmit(v);
        } catch (err) {
          onError(err);
        }
      }}
    >
      {fields.map(f => (
        <Field key={f.key} label={f.label}>
          <input className={`${inputCls} ${f.mono ? 'font-mono' : ''}`} placeholder={f.placeholder} value={v[f.key] ?? ''} onChange={e => setV({ ...v, [f.key]: e.target.value.trim() })} />
        </Field>
      ))}
      <Badge tone="leaf">Real number from the government portal (not mock)</Badge>
      <PrimaryButton type="submit">Save</PrimaryButton>
    </form>
  );
};
