import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { errMsg } from '../../api/client';
import { isValidGstin, GST_STATES } from '../../../shared/gst';
import { Card, Field, inputCls, PrimaryButton } from '../admin/ui';
import { Building2 } from 'lucide-react';

/** Shown in the merchant workspace when the logged-in user has no business yet. */
export const CreateBusiness: React.FC = () => {
  const { createBusiness, user } = useAuth();
  const [f, setF] = useState({ name: '', gstin: '', gstType: 'REGULAR', stateCode: '07', address: '', city: '', phone: user?.phone ?? '', aatoBand: 'UPTO_5CR' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const gstin = f.gstin.trim().toUpperCase();
  const gstinOk = !gstin || isValidGstin(gstin);
  // the GSTIN carries the state code
  const stateCode = gstin.length >= 2 && gstinOk ? gstin.slice(0, 2) : f.stateCode;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createBusiness({
        name: f.name.trim(),
        gstType: gstin ? f.gstType : 'UNREGISTERED',
        gstin: gstin || undefined,
        stateCode,
        address: f.address || undefined,
        city: f.city || undefined,
        phone: f.phone || undefined,
        aatoBand: f.aatoBand
      });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-mango-50 text-mango-600 flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
        <div>
          <h2 className="text-lg font-black text-ink">Set up your business</h2>
          <p className="text-[11px] text-stone-500">Needed for invoices, stock and GST reports. You get a free trial of a paid plan.</p>
        </div>
      </div>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-xs">
        <div className="col-span-2"><Field label="Business legal name"><input className={inputCls} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required minLength={2} /></Field></div>
        <Field label="GSTIN (leave empty if unregistered)" hint={gstinOk ? undefined : 'GSTIN format or checksum is wrong'}>
          <input className={`${inputCls} font-mono uppercase ${gstinOk ? '' : 'border-rose-400'}`} maxLength={15} value={f.gstin} onChange={e => setF({ ...f, gstin: e.target.value.toUpperCase().trim() })} />
        </Field>
        <Field label="GST registration type">
          <select className={inputCls} value={gstin ? f.gstType : 'UNREGISTERED'} disabled={!gstin} onChange={e => setF({ ...f, gstType: e.target.value })}>
            <option value="REGULAR">Regular</option>
            <option value="COMPOSITION">Composition (bill of supply)</option>
            <option value="UNREGISTERED">Unregistered</option>
          </select>
        </Field>
        <Field label="State">
          <select className={inputCls} value={stateCode} disabled={!!gstin && gstinOk} onChange={e => setF({ ...f, stateCode: e.target.value })}>
            {Object.entries(GST_STATES).map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
          </select>
        </Field>
        <Field label="Annual turnover (AATO)">
          <select className={inputCls} value={f.aatoBand} onChange={e => setF({ ...f, aatoBand: e.target.value })}>
            <option value="UPTO_5CR">Up to ₹5 Cr</option>
            <option value="5_TO_10CR">₹5–10 Cr (e-invoice mandatory)</option>
            <option value="ABOVE_10CR">Above ₹10 Cr (30-day IRP window)</option>
          </select>
        </Field>
        <div className="col-span-2"><Field label="Address"><input className={inputCls} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></Field></div>
        <Field label="City"><input className={inputCls} value={f.city} onChange={e => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="Business phone"><input className={inputCls} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
        {error && <div className="col-span-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</div>}
        <div className="col-span-2"><PrimaryButton type="submit" disabled={busy || !gstinOk || f.name.trim().length < 2}>{busy ? 'Creating…' : 'Create business'}</PrimaryButton></div>
      </form>
    </Card>
  );
};
