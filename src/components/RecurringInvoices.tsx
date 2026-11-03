import React, { useCallback, useEffect, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { get, post, patch, errMsg } from '../api/client';
import { localDate } from '../utils/gst';
import { formatDate, formatINR } from '../utils/formatters';
import { Card, Badge, PrimaryButton, GhostButton, Field, inputCls, Toggle, Drawer, EmptyState } from './admin/ui';
import { Repeat, Plus, Play, Trash2 } from 'lucide-react';

interface Profile {
  _id: string;
  name: string;
  partyName: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  nextRunOn: string;
  endsOn: string;
  active: boolean;
  runs: number;
  lastInvoiceNumber: string;
  lastError: string;
  items: { name: string; quantity: number; price: number }[];
}

const FREQ: Record<Profile['frequency'], string> = { WEEKLY: 'Every week', MONTHLY: 'Every month', QUARTERLY: 'Every quarter', YEARLY: 'Every year' };

/** Recurring invoices (spec §8.4 P1): rent, AMC, subscriptions, retainers. The server raises them every hour. */
export const RecurringInvoices: React.FC = () => {
  const { parties, products, showToast, reload, role } = useBilling();
  const [rows, setRows] = useState<Profile[]>([]);
  const [creating, setCreating] = useState(false);
  const canManage = role === 'OWNER' || role === 'ADMIN';

  const load = useCallback(async () => {
    try {
      setRows(await get<Profile[]>('/api/recurring'));
    } catch (e) {
      showToast(errMsg(e));
    }
  }, [showToast]);
  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (p: Profile, active: boolean) => {
    try {
      await patch(`/api/recurring/${p._id}`, { active });
      load();
    } catch (e) {
      showToast(errMsg(e));
    }
  };

  const runNow = async () => {
    try {
      const r = await post<{ profile: string; invoice?: string; error?: string }[]>('/api/recurring/run');
      showToast(r.length ? r.map(x => x.invoice ? `${x.profile} → ${x.invoice}` : `${x.profile}: ${x.error}`).join(' · ') : 'Nothing due today');
      load();
      reload();
    } catch (e) {
      showToast(errMsg(e));
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-[11px] text-stone-500">Invoices raised automatically on schedule (rent, AMC, retainers). The server checks every hour; failed runs pause the profile and show the reason.</p>
        {canManage && (
          <div className="flex gap-2">
            <GhostButton onClick={runNow}><Play className="w-3.5 h-3.5" /> Run due now</GhostButton>
            <PrimaryButton onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5" /> New recurring invoice</PrimaryButton>
          </div>
        )}
      </div>
      <table className="w-full text-left text-xs text-stone-700">
        <thead className="bg-mango-50/60 text-stone-500 uppercase font-semibold text-[10px] tracking-wider">
          <tr>
            <th className="p-3">Profile</th>
            <th className="p-3">Customer</th>
            <th className="p-3">Schedule</th>
            <th className="p-3">Next invoice</th>
            <th className="p-3">Raised</th>
            <th className="p-3">Active</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mango-100">
          {rows.map(p => (
            <tr key={p._id}>
              <td className="p-3">
                <div className="font-bold text-ink">{p.name}</div>
                <div className="text-[10px] text-stone-500">{p.items.map(i => `${i.quantity} × ${i.name}`).join(', ')}</div>
                {p.lastError && <div className="text-[10px] text-rose-600 font-semibold mt-0.5">Paused: {p.lastError}</div>}
              </td>
              <td className="p-3">{p.partyName}</td>
              <td className="p-3">{FREQ[p.frequency]}{p.endsOn && <div className="text-[10px] text-stone-500">until {formatDate(p.endsOn)}</div>}</td>
              <td className="p-3 whitespace-nowrap">{p.active ? formatDate(p.nextRunOn) : '—'}</td>
              <td className="p-3">{p.runs}{p.lastInvoiceNumber && <div className="text-[10px] font-mono text-stone-500">last {p.lastInvoiceNumber}</div>}</td>
              <td className="p-3">{canManage ? <Toggle checked={p.active} onChange={v => toggle(p, v)} label="Active" /> : <Badge tone={p.active ? 'leaf' : 'stone'}>{p.active ? 'ON' : 'OFF'}</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <EmptyState text="No recurring invoices yet." />}

      <Drawer open={creating} onClose={() => setCreating(false)} title="New recurring invoice" width="max-w-2xl">
        {creating && (
          <RecurringForm
            customers={parties.filter(p => p.type === 'CUSTOMER' && p.status === 'ACTIVE')}
            products={products.filter(p => p.status === 'ACTIVE')}
            onSaved={() => { setCreating(false); load(); }}
            onError={m => showToast(m)}
          />
        )}
      </Drawer>
    </Card>
  );
};

const RecurringForm: React.FC<{
  customers: { id: string; name: string }[];
  products: { id: string; name: string; sellingPrice: number; taxRate: number }[];
  onSaved: () => void;
  onError: (m: string) => void;
}> = ({ customers, products, onSaved, onError }) => {
  const [f, setF] = useState({ name: '', partyId: customers[0]?.id ?? '', frequency: 'MONTHLY', startOn: localDate(), endsOn: '', dueDays: 15, notes: '' });
  const [items, setItems] = useState([{ productId: products[0]?.id ?? '', quantity: 1, price: products[0]?.sellingPrice ?? 0 }]);
  const total = items.reduce((a, i) => {
    const p = products.find(x => x.id === i.productId);
    return a + i.quantity * i.price * (1 + (p?.taxRate ?? 0) / 100);
  }, 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post('/api/recurring', { ...f, endsOn: f.endsOn || undefined, items: items.filter(i => i.productId) });
      onSaved();
    } catch (err) {
      onError(errMsg(err));
    }
  };

  return (
    <form onSubmit={save} className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Profile name"><input className={inputCls} required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Shop rent / AMC" /></Field>
        <Field label="Customer">
          <select className={inputCls} value={f.partyId} onChange={e => setF({ ...f, partyId: e.target.value })}>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Repeat">
          <select className={inputCls} value={f.frequency} onChange={e => setF({ ...f, frequency: e.target.value })}>
            {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Payment due (days)"><input type="number" min={0} className={inputCls} value={f.dueDays} onChange={e => setF({ ...f, dueDays: Number(e.target.value) })} /></Field>
        <Field label="First invoice on"><input type="date" min={localDate()} className={inputCls} value={f.startOn} onChange={e => setF({ ...f, startOn: e.target.value })} /></Field>
        <Field label="Stop after (optional)"><input type="date" className={inputCls} value={f.endsOn} onChange={e => setF({ ...f, endsOn: e.target.value })} /></Field>
      </div>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <Field label="Item">
              <select className={inputCls} value={it.productId} onChange={e => { const p = products.find(x => x.id === e.target.value); setItems(items.map((x, i) => (i === idx ? { ...x, productId: e.target.value, price: p?.sellingPrice ?? 0 } : x))); }}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Qty"><input type="number" min={1} className={`${inputCls} w-20`} value={it.quantity} onChange={e => setItems(items.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))} /></Field>
            <Field label="Rate ₹"><input type="number" min={0} className={`${inputCls} w-28`} value={it.price} onChange={e => setItems(items.map((x, i) => (i === idx ? { ...x, price: Number(e.target.value) } : x)))} /></Field>
            <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="p-2 text-stone-400 hover:text-rose-600" aria-label="Remove item"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <GhostButton type="button" onClick={() => setItems([...items, { productId: products[0]?.id ?? '', quantity: 1, price: products[0]?.sellingPrice ?? 0 }])}><Plus className="w-3.5 h-3.5" /> Add item</GhostButton>
      </div>
      <Field label="Notes on each invoice"><input className={inputCls} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
      <div className="text-stone-600">Approx. {formatINR(total)} per invoice incl. GST</div>
      <PrimaryButton type="submit" disabled={!f.partyId || !items.length}><Repeat className="w-3.5 h-3.5" /> Save schedule</PrimaryButton>
    </form>
  );
};
