import React, { useEffect, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { get, post, patch, errMsg } from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { Card, Badge, PrimaryButton, GhostButton, Field, inputCls, Toggle, UsageBar } from './admin/ui';
import { Check, CreditCard, Bell, Mail } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Plan = { _id: string; name: string; tagline: string; priceYearly: number; price2Years: number; price3Years: number; priceLifetime: number; features: string[]; limits: Record<string, number | null>; highlight?: string };
type Cycle = '1Y' | '2Y' | '3Y' | 'LIFETIME';

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, fn: (r: any) => void) => void };
  }
}

const loadCheckout = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay Checkout'));
    document.body.appendChild(s);
  });

/** Merchant's own plan, usage and self-serve upgrade (spec §8.14, §11: transparent pricing + checkout). */
export const PlanBilling: React.FC = () => {
  const { current, showToast, reload, role, activeBusiness } = useBilling();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<Cycle>('1Y');
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState('');
  const canBuy = role === 'OWNER' || role === 'ADMIN';

  useEffect(() => {
    get<Plan[]>('/api/plans').then(setPlans).catch(e => showToast(errMsg(e)));
  }, [showToast]);

  const price = (p: Plan) => (cycle === '2Y' ? p.price2Years : cycle === '3Y' ? p.price3Years : cycle === 'LIFETIME' ? p.priceLifetime : p.priceYearly);

  const buy = async (p: Plan) => {
    setBusy(p._id);
    try {
      const co = await post<any>('/api/billing/checkout', { planId: p._id, cycle, couponCode: coupon || undefined });
      await loadCheckout();
      const rz = new window.Razorpay!({
        key: co.keyId,
        order_id: co.orderId,
        amount: co.amount,
        currency: 'INR',
        name: 'Mango Invoice',
        description: co.description,
        prefill: co.prefill,
        theme: { color: '#f7781b' },
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await post('/api/billing/checkout/verify', { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
            showToast(`${p.name} activated. GST invoice sent to your account.`);
            reload();
          } catch (e) {
            showToast(`Payment received but activation is pending: ${errMsg(e)}. It will complete automatically.`);
          }
        }
      });
      rz.on('payment.failed', (r: any) => showToast(`Payment failed: ${r?.error?.description ?? 'try again'}`));
      rz.open();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusy('');
    }
  };

  const plan = current?.plan as any;
  const usage = current?.usage ?? {};

  return (
    <div className="space-y-4">
      <Card className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <div className="text-[10px] uppercase font-bold text-stone-500">Current plan</div>
          <div className="text-2xl font-black text-ink">{plan?.name ?? '—'} {plan?.onTrial && <Badge tone="mango">trial</Badge>}</div>
          <div className="text-stone-500">
            {plan?.onTrial ? `Trial ends ${formatDate(current?.business.trialEndsOn)}` : current?.business.planValidUntil ? `Valid until ${formatDate(current.business.planValidUntil)}` : 'Free forever'}
          </div>
        </div>
        <div className="md:col-span-2 space-y-2">
          <UsageBar label="Invoices this month" used={usage.invoicesThisMonth ?? 0} limit={plan?.limits?.invoicesPerMonth ?? null} />
          <UsageBar label="Users" used={usage.users ?? 0} limit={plan?.limits?.users ?? 1} />
          <UsageBar label="e-Way bills this year" used={usage.eWayBillsThisYear ?? 0} limit={plan?.limits?.eWayBillsPerYear ?? null} />
          <UsageBar label="e-Invoices this year" used={usage.eInvoicesThisYear ?? 0} limit={plan?.limits?.eInvoicesPerYear ?? null} />
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(['1Y', '2Y', '3Y', 'LIFETIME'] as Cycle[]).map(c => (
          <button key={c} onClick={() => setCycle(c)} className={`px-3 py-1.5 rounded-lg font-bold border ${cycle === c ? 'bg-mango-500 text-white border-mango-500' : 'bg-white border-mango-200 text-stone-600'}`}>{c === 'LIFETIME' ? 'Lifetime' : `${c[0]} year${c[0] === '1' ? '' : 's'}`}</button>
        ))}
        <input className={`${inputCls} w-40 font-mono uppercase ml-auto`} placeholder="Coupon code" value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.filter(p => p.priceYearly > 0).map(p => (
          <Card key={p._id} className={`p-5 flex flex-col justify-between ${plan?._id === p._id && !plan?.onTrial ? 'ring-2 ring-mango-500' : ''}`}>
            <div>
              <div className="flex items-center justify-between"><h3 className="font-extrabold text-base text-ink">{p.name}</h3>{p.highlight && <Badge tone="mango">{p.highlight}</Badge>}</div>
              <p className="text-[11px] text-stone-500">{p.tagline}</p>
              <div className="text-3xl font-black text-ink mt-3">{formatINR(price(p)).replace('.00', '')}</div>
              <div className="text-[10px] text-stone-500">+ 18% GST · {cycle === 'LIFETIME' ? 'one time' : `for ${cycle[0]} year${cycle[0] === '1' ? '' : 's'}`}</div>
              <ul className="mt-3 space-y-1 text-[11px] text-stone-700">{p.features.map(f => <li key={f} className="flex gap-1.5"><Check className="w-3.5 h-3.5 text-leaf-600 shrink-0" />{f}</li>)}</ul>
            </div>
            {canBuy && (
              <PrimaryButton className="mt-4 justify-center" disabled={!!busy || !price(p)} onClick={() => buy(p)}>
                <CreditCard className="w-3.5 h-3.5" /> {busy === p._id ? 'Opening…' : plan?._id === p._id && !plan?.onTrial ? 'Renew / extend' : 'Buy now'}
              </PrimaryButton>
            )}
          </Card>
        ))}
      </div>
      <p className="text-[10px] text-stone-500">Payments by Razorpay (UPI, cards, netbanking). A GST invoice from {activeBusiness ? 'Mango Invoice' : ''} is issued for every purchase.</p>
    </div>
  );
};

/** Automatic WhatsApp / SMS / email reminders and the monthly CA summary (spec §8.8, §8.9 P1). */
export const AutomationSettings: React.FC = () => {
  const { current, showToast, reload } = useBilling();
  const b = current?.business as any;
  const [ar, setAr] = useState({ enabled: !!b?.invoiceSettings?.autoReminders?.enabled, days: (b?.invoiceSettings?.autoReminders?.days ?? [1, 7, 15]).join(', '), channels: (b?.invoiceSettings?.autoReminders?.channels ?? ['WHATSAPP', 'EMAIL']) as string[] });
  const [ca, setCa] = useState({ caEmail: b?.caEmail ?? '', autoEmailCa: !!b?.autoEmailCa });

  const save = async () => {
    try {
      const days = ar.days.split(/[\s,]+/).map(Number).filter((n: number) => Number.isInteger(n) && n >= 0).slice(0, 6);
      await patch('/api/businesses/current/settings', { autoReminders: { enabled: ar.enabled, days, channels: ar.channels.length ? ar.channels : ['EMAIL'] } });
      await patch('/api/businesses/current', { caEmail: ca.caEmail, autoEmailCa: ca.autoEmailCa });
      showToast('Automation settings saved');
      reload();
    } catch (e) {
      showToast(errMsg(e));
    }
  };

  const sendCaNow = async () => {
    try {
      const r = await post<{ period: string }>('/api/reports/email-ca', { to: ca.caEmail || undefined });
      showToast(`${r.period} summary emailed to your CA`);
    } catch (e) {
      showToast(errMsg(e));
    }
  };

  return (
    <Card className="p-6 space-y-5 text-xs">
      <div>
        <h3 className="font-extrabold text-sm text-ink flex items-center gap-2"><Bell className="w-4 h-4 text-mango-500" /> Automatic payment reminders</h3>
        <p className="text-stone-500 mt-0.5">Sent at 9 am on the chosen days after the due date, on the first channel that works. Each includes a view-and-pay link.</p>
      </div>
      <label className="flex items-center justify-between max-w-xl"><span className="font-semibold text-stone-700">Send reminders automatically</span><Toggle checked={ar.enabled} onChange={v => setAr({ ...ar, enabled: v })} /></label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
        <Field label="Days after due date" hint="e.g. 1, 7, 15"><input className={inputCls} value={ar.days} onChange={e => setAr({ ...ar, days: e.target.value })} /></Field>
        <div>
          <span className="block text-[11px] font-semibold text-stone-500 mb-1">Channels (in order)</span>
          <div className="flex gap-2">
            {['WHATSAPP', 'SMS', 'EMAIL'].map(c => (
              <label key={c} className="flex items-center gap-1"><input type="checkbox" checked={ar.channels.includes(c)} onChange={e => setAr({ ...ar, channels: e.target.checked ? [...ar.channels, c] : ar.channels.filter(x => x !== c) })} />{c}</label>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-mango-100 pt-4">
        <h3 className="font-extrabold text-sm text-ink flex items-center gap-2"><Mail className="w-4 h-4 text-mango-500" /> Monthly summary to your CA</h3>
        <p className="text-stone-500 mt-0.5">On the 2nd of every month: sales, output GST, ITC and expenses for the previous month, with the invoice list attached.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl items-end">
        <Field label="CA's email"><input type="email" className={inputCls} value={ca.caEmail} onChange={e => setCa({ ...ca, caEmail: e.target.value })} /></Field>
        <label className="flex items-center justify-between"><span className="font-semibold text-stone-700">Email it every month</span><Toggle checked={ca.autoEmailCa} onChange={v => setCa({ ...ca, autoEmailCa: v })} /></label>
      </div>
      <div className="flex gap-2">
        <PrimaryButton onClick={save}>Save</PrimaryButton>
        <GhostButton onClick={sendCaNow} disabled={!ca.caEmail}>Send last month now</GhostButton>
      </div>
    </Card>
  );
};
