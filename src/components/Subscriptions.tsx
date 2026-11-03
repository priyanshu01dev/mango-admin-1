import React, { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { useBilling } from '../context/BillingContext';
import { PLAN_COLORS, GST_ON_SUBSCRIPTION } from '../data/adminData';
import { PlanConfig, PlanId, Coupon, SubscriptionRecord, SubscriptionStatus } from '../types/admin';
import { formatINR, formatDate } from '../utils/formatters';
import { Card, PageHeader, Badge, SegmentedTabs, PrimaryButton, GhostButton, inputCls, Field, Toggle, Drawer, EmptyState, StatTile, fmtNum, fmtCompactINR } from './admin/ui';
import { CreditCard, Check, Pencil, Plus, Ticket, Package, FileText, RefreshCw, XCircle, Printer, IndianRupee, Repeat, TrendingDown } from 'lucide-react';

type SubTab = 'PLANS' | 'SUBSCRIPTIONS' | 'COUPONS' | 'ADDONS';

const STATUS_TONE: Record<SubscriptionStatus, 'leaf' | 'mango' | 'amber' | 'stone' | 'rose'> = {
  ACTIVE: 'leaf',
  TRIAL: 'mango',
  PAST_DUE: 'amber',
  CANCELLED: 'stone',
  EXPIRED: 'rose'
};

const limitText = (v: number | null, unit: string) => (v === null ? `Unlimited ${unit}` : v === 0 ? `No ${unit}` : `${fmtNum(v)} ${unit}`);

/** Opens a printable GST tax invoice for a subscription (platform → merchant). */
function printSubscriptionInvoice(s: SubscriptionRecord, planName: string) {
  const taxable = s.baseAmount - s.discount;
  const half = (s.gstAmount / 2).toFixed(2);
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${s.invoiceNo}</title>
<style>body{font-family:system-ui,sans-serif;color:#2a1f17;margin:32px;font-size:12px}h1{font-size:18px;margin:0}
table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #e7d9c7;padding:8px;text-align:left}
th{background:#fff7ed}.r{text-align:right}.muted{color:#78716c}.top{display:flex;justify-content:space-between;border-bottom:3px solid #f7781b;padding-bottom:12px}</style>
</head><body>
<div class="top"><div><h1>TAX INVOICE</h1><div class="muted">Original for recipient</div></div>
<div class="r"><b>Mango Invoice</b> · Powered by First Wave<br/>GSTIN: 22ABCFW1234M1Z5<br/>Raipur, Chhattisgarh (22)</div></div>
<p><b>Invoice No:</b> ${s.invoiceNo} &nbsp; <b>Date:</b> ${s.startDate} &nbsp; <b>Place of supply:</b> ${s.merchantGstin ? s.merchantGstin.slice(0, 2) : '22'}</p>
<p><b>Bill to:</b> ${s.merchantName}<br/>GSTIN: ${s.merchantGstin || 'Unregistered'}</p>
<table><tr><th>Description</th><th>SAC</th><th class="r">Amount (₹)</th></tr>
<tr><td>${planName} plan subscription (${s.cycle}) · ${s.startDate} to ${s.renewsOn}</td><td>998314</td><td class="r">${s.baseAmount.toFixed(2)}</td></tr>
${s.discount ? `<tr><td>Discount ${s.couponCode ?? ''}</td><td></td><td class="r">-${s.discount.toFixed(2)}</td></tr>` : ''}
<tr><td colspan="2" class="r">Taxable value</td><td class="r">${taxable.toFixed(2)}</td></tr>
${(s.merchantGstin || '22').startsWith('22')
  ? `<tr><td colspan="2" class="r">CGST 9%</td><td class="r">${half}</td></tr><tr><td colspan="2" class="r">SGST 9%</td><td class="r">${half}</td></tr>`
  : `<tr><td colspan="2" class="r">IGST ${GST_ON_SUBSCRIPTION}%</td><td class="r">${s.gstAmount.toFixed(2)}</td></tr>`}
<tr><th colspan="2" class="r">Total</th><th class="r">₹${s.totalAmount.toFixed(2)}</th></tr></table>
<p class="muted">Paid via ${s.gateway.replace('_', ' ')}. Reverse charge: No. This is a computer generated invoice.</p>
<script>window.print()</script></body></html>`);
  w.document.close();
}

export const Subscriptions: React.FC = () => {
  const { today, plans, subscriptions, coupons, addOns, updatePlan, setSubscriptionAutoRenew, cancelSubscription, retryPayment, addCoupon, toggleCoupon, updateAddOn } = useAdmin();
  const { language } = useBilling();
  const [tab, setTab] = useState<SubTab>('PLANS');
  const [editing, setEditing] = useState<PlanConfig | null>(null);
  const [subFilter, setSubFilter] = useState<'ALL' | SubscriptionStatus>('ALL');
  const [showCouponForm, setShowCouponForm] = useState(false);

  const active = subscriptions.filter(s => s.status === 'ACTIVE');
  const arr = active.reduce((a, s) => {
    const years = s.cycle === '2Y' ? 2 : s.cycle === '3Y' ? 3 : s.cycle === 'LIFETIME' ? 5 : 1;
    return a + (s.baseAmount - s.discount) / years;
  }, 0);
  const pastDue = subscriptions.filter(s => s.status === 'PAST_DUE');
  const gstCollected = subscriptions.filter(s => s.status !== 'TRIAL').reduce((a, s) => a + s.gstAmount, 0);
  const autoRenewPct = active.length ? (active.filter(s => s.autoRenew).length / active.length) * 100 : 0;

  const planName = (id: PlanId) => plans.find(p => p.id === id)?.name ?? id;
  const shownSubs = subscriptions.filter(s => subFilter === 'ALL' || s.status === subFilter);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={CreditCard}
        title={language === 'hi' ? 'सब्सक्रिप्शन, प्लान्स व कूपन' : 'Subscriptions & Plans'}
        subtitle="Transparent pricing, plan limits, multi-year & lifetime deals, coupons, add-ons and GST invoices for every subscription"
        actions={
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { id: 'PLANS', label: 'Plans & limits' },
              { id: 'SUBSCRIPTIONS', label: 'Subscriptions', count: subscriptions.length },
              { id: 'COUPONS', label: 'Coupons', count: coupons.filter(c => c.active).length },
              { id: 'ADDONS', label: 'Add-ons' }
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="ARR (sample)" value={fmtCompactINR(Math.round(arr))} sub={`${active.length} active subscriptions`} icon={IndianRupee} />
        <StatTile label="Past due" value={String(pastDue.length)} sub={formatINR(pastDue.reduce((a, s) => a + s.totalAmount, 0)) + ' at risk'} icon={TrendingDown} />
        <StatTile label="Auto-renew on" value={`${autoRenewPct.toFixed(0)}%`} sub="of active subscriptions" icon={Repeat} />
        <StatTile label="GST collected" value={formatINR(gstCollected)} sub={`${GST_ON_SUBSCRIPTION}% on subscription invoices`} icon={FileText} />
      </div>

      {tab === 'PLANS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {plans.map(plan => (
            <Card key={plan.id} className={`p-5 flex flex-col justify-between relative ${!plan.isActive ? 'opacity-60' : ''}`}>
              {plan.highlight && (
                <span className="absolute -top-2.5 left-5 bg-gradient-to-r from-amber-400 to-mango-500 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow">
                  {plan.highlight}
                </span>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-ink flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: PLAN_COLORS[plan.id] }} />
                    {plan.name}
                  </h3>
                  <button onClick={() => setEditing(plan)} className="p-1.5 rounded-lg hover:bg-mango-50 text-stone-500 hover:text-mango-600" aria-label={`Edit ${plan.name}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">{plan.tagline}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-ink">{plan.priceYearly ? formatINR(plan.priceYearly).replace('.00', '') : 'Free'}</span>
                  {plan.priceYearly > 0 && <span className="text-stone-500 text-xs">/year + GST</span>}
                </div>
                {plan.priceYearly > 0 && (
                  <div className="text-[10px] text-stone-500 mt-1 font-mono">
                    2 yr ₹{fmtNum(plan.price2Years)} · 3 yr ₹{fmtNum(plan.price3Years)} · lifetime ₹{fmtNum(plan.priceLifetime)}
                  </div>
                )}
                <div className="mt-4 pt-3 border-t border-mango-100 grid grid-cols-2 gap-1.5 text-[10px] text-stone-600">
                  <span>{limitText(plan.limits.invoicesPerMonth, 'invoices/mo')}</span>
                  <span>{plan.limits.users} user{plan.limits.users > 1 ? 's' : ''}</span>
                  <span>{plan.limits.businesses} business{plan.limits.businesses > 1 ? 'es' : ''}</span>
                  <span>{limitText(plan.limits.eWayBillsPerYear, 'EWB/yr')}</span>
                  <span className="col-span-2">{limitText(plan.limits.eInvoicesPerYear, 'e-invoices/yr')}</span>
                </div>
                <div className="space-y-1.5 mt-3 pt-3 border-t border-mango-100">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2 text-[11px] text-stone-700">
                      <Check className="w-3.5 h-3.5 text-leaf-600 shrink-0 mt-px" /> {f}
                    </div>
                  ))}
                  {plan.watermark && <div className="text-[10px] text-mango-700 font-semibold">Invoices carry "Made with Mango Invoice" watermark</div>}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-mango-100 text-[10px] text-stone-500 flex justify-between">
                <span>{subscriptions.filter(s => s.planId === plan.id && s.status === 'ACTIVE').length} active in sample</span>
                <span>{plan.isActive ? 'Visible on pricing page' : 'Hidden'}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'SUBSCRIPTIONS' && (
        <Card className="p-4 space-y-3">
          <SegmentedTabs
            value={subFilter}
            onChange={setSubFilter}
            options={(['ALL', 'ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] as const).map(s => ({
              id: s,
              label: s === 'ALL' ? 'All' : s.replace('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()),
              count: s === 'ALL' ? subscriptions.length : subscriptions.filter(x => x.status === s).length
            }))}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-mango-50/60 text-stone-500 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">GST invoice</th>
                  <th className="p-3">Merchant</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3 text-right">Taxable</th>
                  <th className="p-3 text-right">GST 18%</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3">Gateway</th>
                  <th className="p-3">Renews</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mango-100">
                {shownSubs.map(s => (
                  <tr key={s.id} className="hover:bg-mango-50/50">
                    <td className="p-3 font-mono text-[11px] text-ink">{s.invoiceNo}</td>
                    <td className="p-3">
                      <div className="font-semibold text-ink">{s.merchantName}</div>
                      <div className="text-[10px] font-mono text-stone-500">{s.merchantGstin || 'Unregistered'}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {planName(s.planId)} · {s.cycle}
                      {s.couponCode && <div><Badge tone="violet">{s.couponCode}</Badge></div>}
                    </td>
                    <td className="p-3 text-right font-mono">{formatINR(s.baseAmount - s.discount)}</td>
                    <td className="p-3 text-right font-mono text-stone-500">{formatINR(s.gstAmount)}</td>
                    <td className="p-3 text-right font-mono font-bold text-ink">{formatINR(s.totalAmount)}</td>
                    <td className="p-3 text-[10px]">{s.gateway.replace('_', ' ')}</td>
                    <td className="p-3 whitespace-nowrap">
                      {s.cycle === 'LIFETIME' ? 'Never' : formatDate(s.renewsOn)}
                      <div className="flex items-center gap-1.5 mt-1">
                        <Toggle checked={s.autoRenew} onChange={v => setSubscriptionAutoRenew(s.id, v)} label="Auto renew" />
                        <span className="text-[10px] text-stone-500">auto</span>
                      </div>
                    </td>
                    <td className="p-3"><Badge tone={STATUS_TONE[s.status]}>{s.status.replace('_', ' ')}</Badge></td>
                    <td className="p-3 text-right whitespace-nowrap space-x-1">
                      <button onClick={() => printSubscriptionInvoice(s, planName(s.planId))} className="p-1.5 rounded-lg hover:bg-mango-100 text-stone-600" title="Print GST invoice">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {s.status === 'PAST_DUE' && (
                        <button onClick={() => retryPayment(s.id)} className="p-1.5 rounded-lg hover:bg-leaf-50 text-leaf-600" title="Retry payment">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(s.status === 'ACTIVE' || s.status === 'PAST_DUE') && (
                        <button
                          onClick={() => window.confirm(`Cancel ${s.merchantName}'s subscription?`) && cancelSubscription(s.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600"
                          title="Cancel subscription"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shownSubs.length === 0 && <EmptyState text="No subscriptions in this state." />}
          </div>
        </Card>
      )}

      {tab === 'COUPONS' && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-ink flex items-center gap-2"><Ticket className="w-4 h-4 text-mango-500" /> Coupon codes</h3>
            <PrimaryButton onClick={() => setShowCouponForm(v => !v)}><Plus className="w-3.5 h-3.5" /> New coupon</PrimaryButton>
          </div>
          {showCouponForm && <CouponForm plans={plans} onSave={c => { addCoupon(c); setShowCouponForm(false); }} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {coupons.map(c => {
              const exhausted = c.redeemed >= c.maxRedemptions;
              return (
                <div key={c.id} className="border border-dashed border-mango-300 rounded-xl p-4 bg-mango-50/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono font-black text-base text-ink tracking-wider">{c.code}</div>
                      <div className="text-[11px] text-stone-500">{c.description}</div>
                    </div>
                    <Toggle checked={c.active} onChange={() => toggleCoupon(c.id)} label={`Toggle ${c.code}`} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Badge tone="mango">{c.type === 'PERCENT' ? `${c.value}% off` : `₹${fmtNum(c.value)} off`}</Badge>
                    {c.appliesTo.map(p => <Badge key={p} tone="stone">{planName(p)}</Badge>)}
                    <Badge tone={c.validUntil < today ? 'rose' : 'stone'}>till {formatDate(c.validUntil)}</Badge>
                    {exhausted && <Badge tone="rose">exhausted</Badge>}
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-stone-500 mb-1">
                      <span>Redeemed</span>
                      <span className="font-mono">{fmtNum(c.redeemed)} / {fmtNum(c.maxRedemptions)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white overflow-hidden">
                      <div className="h-full bg-mango-500 rounded-full" style={{ width: `${Math.min(100, (c.redeemed / c.maxRedemptions) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === 'ADDONS' && (
        <Card className="p-4">
          <h3 className="font-extrabold text-sm text-ink flex items-center gap-2 mb-3"><Package className="w-4 h-4 text-mango-500" /> Add-ons (sold on top of any paid plan)</h3>
          <div className="divide-y divide-mango-100">
            {addOns.map(a => (
              <div key={a.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-bold text-ink">{a.name}</div>
                  <div className="text-[11px] text-stone-500">{a.description}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-stone-500">{a.soldThisMonth} sold (Nov)</span>
                  <div className="flex items-center gap-1">
                    <span className="text-stone-500">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={a.price}
                      onChange={e => updateAddOn({ ...a, price: Number(e.target.value) })}
                      className={`${inputCls} w-24 font-mono`}
                    />
                  </div>
                  <span className="text-[10px] text-stone-500 w-28">{a.unit}</span>
                  <Toggle checked={a.active} onChange={v => updateAddOn({ ...a, active: v })} label={`Toggle ${a.name}`} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={`Edit plan · ${editing?.name ?? ''}`}>
        {editing && <PlanEditor key={editing.id} plan={editing} onSave={p => { updatePlan(p); setEditing(null); }} />}
      </Drawer>
    </div>
  );
};

const numOrNull = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v)));

const PlanEditor: React.FC<{ plan: PlanConfig; onSave: (p: PlanConfig) => void }> = ({ plan, onSave }) => {
  const [p, setP] = useState<PlanConfig>(plan);
  const [featuresText, setFeaturesText] = useState(plan.features.join('\n'));
  const setLimit = (k: keyof PlanConfig['limits'], v: number | null) => setP({ ...p, limits: { ...p.limits, [k]: v } });

  return (
    <form
      className="space-y-5 text-xs"
      onSubmit={e => {
        e.preventDefault();
        onSave({ ...p, features: featuresText.split('\n').map(f => f.trim()).filter(Boolean) });
      }}
    >
      <Card className="p-4 grid grid-cols-2 gap-3">
        <Field label="Plan name"><input className={inputCls} value={p.name} onChange={e => setP({ ...p, name: e.target.value })} required /></Field>
        <Field label="Badge (optional)"><input className={inputCls} value={p.highlight ?? ''} onChange={e => setP({ ...p, highlight: e.target.value || undefined })} /></Field>
        <div className="col-span-2"><Field label="Tagline"><input className={inputCls} value={p.tagline} onChange={e => setP({ ...p, tagline: e.target.value })} /></Field></div>
      </Card>

      <Card className="p-4">
        <h4 className="font-extrabold text-ink mb-3">Pricing (₹, excl. 18% GST)</h4>
        <div className="grid grid-cols-2 gap-3">
          {([
            ['priceYearly', '1 year'],
            ['price2Years', '2 years'],
            ['price3Years', '3 years'],
            ['priceLifetime', 'Lifetime']
          ] as const).map(([k, label]) => (
            <Field key={k} label={label}>
              <input type="number" min={0} className={`${inputCls} font-mono`} value={p[k]} onChange={e => setP({ ...p, [k]: Number(e.target.value) })} />
            </Field>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="font-extrabold text-ink mb-1">Usage limits</h4>
        <p className="text-[10px] text-stone-500 mb-3">Leave blank for unlimited, 0 to exclude the feature from this plan.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoices / month"><input type="number" min={0} className={`${inputCls} font-mono`} value={p.limits.invoicesPerMonth ?? ''} onChange={e => setLimit('invoicesPerMonth', numOrNull(e.target.value))} placeholder="Unlimited" /></Field>
          <Field label="User logins"><input type="number" min={1} className={`${inputCls} font-mono`} value={p.limits.users} onChange={e => setLimit('users', Math.max(1, Number(e.target.value)))} /></Field>
          <Field label="Businesses (GSTINs)"><input type="number" min={1} className={`${inputCls} font-mono`} value={p.limits.businesses} onChange={e => setLimit('businesses', Math.max(1, Number(e.target.value)))} /></Field>
          <Field label="e-Way bills / year"><input type="number" min={0} className={`${inputCls} font-mono`} value={p.limits.eWayBillsPerYear ?? ''} onChange={e => setLimit('eWayBillsPerYear', numOrNull(e.target.value))} placeholder="Unlimited" /></Field>
          <Field label="e-Invoices (IRN) / year"><input type="number" min={0} className={`${inputCls} font-mono`} value={p.limits.eInvoicesPerYear ?? ''} onChange={e => setLimit('eInvoicesPerYear', numOrNull(e.target.value))} placeholder="Unlimited" /></Field>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <Field label="Features shown on pricing page (one per line)">
          <textarea rows={6} className={inputCls} value={featuresText} onChange={e => setFeaturesText(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between">
          <span className="text-stone-700 font-semibold">App watermark on invoices</span>
          <Toggle checked={p.watermark} onChange={v => setP({ ...p, watermark: v })} label="Watermark" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-700 font-semibold">Visible on pricing page / purchasable</span>
          <Toggle checked={p.isActive} onChange={v => setP({ ...p, isActive: v })} label="Active" />
        </div>
      </Card>

      <PrimaryButton type="submit">Save plan</PrimaryButton>
    </form>
  );
};

const CouponForm: React.FC<{ plans: PlanConfig[]; onSave: (c: Omit<Coupon, 'id' | 'redeemed'>) => void }> = ({ plans, onSave }) => {
  const [c, setC] = useState<Omit<Coupon, 'id' | 'redeemed'>>({
    code: '',
    type: 'PERCENT',
    value: 20,
    appliesTo: ['silver', 'gold', 'platinum'],
    maxRedemptions: 500,
    validUntil: '2026-12-31',
    active: true,
    description: ''
  });
  const invalid = !/^[A-Z0-9]{4,16}$/.test(c.code) || c.value <= 0 || (c.type === 'PERCENT' && c.value > 90) || c.appliesTo.length === 0;
  return (
    <form
      onSubmit={e => { e.preventDefault(); if (!invalid) onSave(c); }}
      className="border border-mango-200 bg-mango-50/40 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs"
    >
      <Field label="Code" hint="4–16 letters/digits"><input className={`${inputCls} font-mono uppercase`} value={c.code} onChange={e => setC({ ...c, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} required /></Field>
      <Field label="Type">
        <select className={inputCls} value={c.type} onChange={e => setC({ ...c, type: e.target.value as Coupon['type'] })}>
          <option value="PERCENT">% off</option>
          <option value="FLAT">₹ flat off</option>
        </select>
      </Field>
      <Field label={c.type === 'PERCENT' ? 'Percent (max 90)' : 'Amount ₹'}><input type="number" min={1} className={`${inputCls} font-mono`} value={c.value} onChange={e => setC({ ...c, value: Number(e.target.value) })} /></Field>
      <Field label="Max redemptions"><input type="number" min={1} className={`${inputCls} font-mono`} value={c.maxRedemptions} onChange={e => setC({ ...c, maxRedemptions: Number(e.target.value) })} /></Field>
      <Field label="Valid until"><input type="date" className={inputCls} value={c.validUntil} onChange={e => setC({ ...c, validUntil: e.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Description"><input className={inputCls} value={c.description} onChange={e => setC({ ...c, description: e.target.value })} placeholder="e.g. Republic Day offer" /></Field></div>
      <div>
        <span className="block text-[11px] font-semibold text-stone-500 mb-1">Applies to</span>
        <div className="flex flex-wrap gap-1">
          {plans.filter(p => p.priceYearly > 0).map(p => {
            const on = c.appliesTo.includes(p.id);
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setC({ ...c, appliesTo: on ? c.appliesTo.filter(x => x !== p.id) : [...c.appliesTo, p.id] })}
                className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${on ? 'bg-mango-500 text-white border-mango-500' : 'bg-white text-stone-500 border-mango-200'}`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="col-span-2 md:col-span-4"><PrimaryButton type="submit" disabled={invalid}>Create coupon</PrimaryButton></div>
    </form>
  );
};
