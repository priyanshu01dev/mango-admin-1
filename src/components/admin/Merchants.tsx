import React, { useMemo, useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { PLAN_COLORS } from '../../data/adminData';
import { Merchant, MerchantStatus, PlanId, BillingCycle } from '../../types/admin';
import { formatDate, formatINR } from '../../utils/formatters';
import { Card, PageHeader, Badge, SegmentedTabs, GhostButton, PrimaryButton, inputCls, Field, UsageBar, Drawer, EmptyState, fmtNum } from './ui';
import { Store, Search, Download, Ban, PlayCircle, CalendarPlus, MessageCircle, Phone, Mail, Smartphone, Globe, ShieldAlert } from 'lucide-react';

const STATUS_TONE: Record<MerchantStatus, 'leaf' | 'mango' | 'rose' | 'stone' | 'amber'> = {
  ACTIVE: 'leaf',
  TRIAL: 'mango',
  PAST_DUE: 'amber',
  SUSPENDED: 'rose',
  CHURNED: 'stone'
};

const CYCLE_LABEL: Record<BillingCycle, string> = { TRIAL: 'Trial', '1Y': '1 year', '2Y': '2 years', '3Y': '3 years', LIFETIME: 'Lifetime' };

function exportCsv(rows: Merchant[]) {
  const header = ['ID', 'Business', 'Owner', 'Phone', 'Email', 'GSTIN', 'State', 'Plan', 'Cycle', 'Status', 'Signup', 'Valid until', 'Invoices (month)'];
  const body = rows.map(m => [m.id, m.businessName, m.ownerName, m.phone, m.email, m.gstin, m.state, m.planId, m.cycle, m.status, m.signupDate, m.planValidUntil, m.usage.invoicesThisMonth]);
  const csv = [header, ...body].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `mango-merchants-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const Merchants: React.FC = () => {
  const { merchants, plans, subscriptions, tickets, setMerchantStatus, extendTrial, changeMerchantPlan, updateMerchantNotes, today } = useAdmin();
  const [statusFilter, setStatusFilter] = useState<'ALL' | MerchantStatus>('ALL');
  const [planFilter, setPlanFilter] = useState<'ALL' | PlanId>('ALL');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merchants.filter(
      m =>
        (statusFilter === 'ALL' || m.status === statusFilter) &&
        (planFilter === 'ALL' || m.planId === planFilter) &&
        (!q || [m.businessName, m.ownerName, m.phone, m.gstin, m.city, m.email].some(v => v.toLowerCase().includes(q)))
    );
  }, [merchants, statusFilter, planFilter, query]);

  const count = (s: MerchantStatus) => merchants.filter(m => m.status === s).length;
  const selected = merchants.find(m => m.id === selectedId) ?? null;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={Store}
        title="Merchants"
        subtitle="Every business registered on Mango Invoice: plan, usage against limits, trials, suspensions and support history"
        actions={
          <GhostButton onClick={() => exportCsv(filtered)}>
            <Download className="w-3.5 h-3.5" /> Export CSV ({filtered.length})
          </GhostButton>
        }
      />

      <Card className="p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <SegmentedTabs
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { id: 'ALL', label: 'All', count: merchants.length },
              { id: 'ACTIVE', label: 'Active', count: count('ACTIVE') },
              { id: 'TRIAL', label: 'Trial', count: count('TRIAL') },
              { id: 'PAST_DUE', label: 'Past due', count: count('PAST_DUE') },
              { id: 'SUSPENDED', label: 'Suspended', count: count('SUSPENDED') },
              { id: 'CHURNED', label: 'Churned', count: count('CHURNED') }
            ]}
          />
          <div className="flex gap-2">
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value as 'ALL' | PlanId)} className={`${inputCls} w-36`}>
              <option value="ALL">All plans</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Business, phone, GSTIN, city…" className={`${inputCls} pl-8 w-64`} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-mango-50/60 text-stone-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Business</th>
                <th className="p-3">GSTIN / Type</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Invoices (Nov)</th>
                <th className="p-3">Valid until</th>
                <th className="p-3">Last active</th>
                <th className="p-3">Apps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mango-100">
              {filtered.map(m => {
                const plan = plans.find(p => p.id === m.planId)!;
                return (
                  <tr key={m.id} onClick={() => setSelectedId(m.id)} className="hover:bg-mango-50/60 cursor-pointer transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-ink">{m.businessName}</div>
                      <div className="text-[10px] text-stone-500">{m.ownerName} · {m.city}, {m.state}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-[11px] text-ink">{m.gstin || '—'}</div>
                      <div className="text-[10px] text-stone-500">{m.gstType.toLowerCase()}</div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <span className="w-2 h-2 rounded-full" style={{ background: PLAN_COLORS[m.planId] }} />
                        {plan.name}
                      </span>
                      <div className="text-[10px] text-stone-500">{CYCLE_LABEL[m.cycle]}</div>
                    </td>
                    <td className="p-3"><Badge tone={STATUS_TONE[m.status]}>{m.status.replace('_', ' ')}</Badge></td>
                    <td className="p-3 text-right font-mono font-bold text-ink">{fmtNum(m.usage.invoicesThisMonth)}</td>
                    <td className="p-3 whitespace-nowrap">
                      {m.planValidUntil >= '2099-01-01' ? 'Lifetime' : formatDate(m.planValidUntil)}
                      {m.planValidUntil < today && m.planValidUntil < '2099-01-01' && <span className="text-rose-600 font-bold ml-1">expired</span>}
                    </td>
                    <td className="p-3 whitespace-nowrap text-stone-500">{m.lastActive === today ? 'Today' : formatDate(m.lastActive)}</td>
                    <td className="p-3 text-[10px] text-stone-500">{m.platforms.join(' · ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState text="No merchants match these filters." />}
        </div>
      </Card>

      <Drawer open={!!selected} onClose={() => setSelectedId(null)} title={selected?.businessName ?? ''} width="max-w-2xl">
        {selected && (
          <MerchantDetail
            key={selected.id}
            merchant={selected}
            onSuspend={reason => setMerchantStatus(selected.id, 'SUSPENDED', reason)}
            onActivate={() => setMerchantStatus(selected.id, 'ACTIVE')}
            onExtendTrial={days => extendTrial(selected.id, days)}
            onChangePlan={(p, c) => changeMerchantPlan(selected.id, p, c)}
            onSaveNotes={n => updateMerchantNotes(selected.id, n)}
            subscriptionCount={subscriptions.filter(s => s.merchantId === selected.id).length}
            lastPaid={subscriptions.find(s => s.merchantId === selected.id)?.totalAmount}
            ticketCount={tickets.filter(t => t.merchantId === selected.id).length}
          />
        )}
      </Drawer>
    </div>
  );
};

const MerchantDetail: React.FC<{
  merchant: Merchant;
  onSuspend: (reason: string) => void;
  onActivate: () => void;
  onExtendTrial: (days: number) => void;
  onChangePlan: (p: PlanId, c: BillingCycle) => void;
  onSaveNotes: (n: string) => void;
  subscriptionCount: number;
  lastPaid?: number;
  ticketCount: number;
}> = ({ merchant: m, onSuspend, onActivate, onExtendTrial, onChangePlan, onSaveNotes, subscriptionCount, lastPaid, ticketCount }) => {
  const { plans } = useAdmin();
  const plan = plans.find(p => p.id === m.planId)!;
  const [newPlan, setNewPlan] = useState<PlanId>(m.planId);
  const [newCycle, setNewCycle] = useState<BillingCycle>(m.cycle === 'TRIAL' ? '1Y' : m.cycle);
  const [notes, setNotes] = useState(m.notes ?? '');
  const [suspendReason, setSuspendReason] = useState('');

  const waText = encodeURIComponent(`Namaste ${m.ownerName} ji, Mango Invoice support here regarding ${m.businessName}.`);

  return (
    <div className="space-y-5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[m.status]}>{m.status.replace('_', ' ')}</Badge>
        <Badge tone="stone">{plan.name} · {CYCLE_LABEL[m.cycle]}</Badge>
        <Badge tone="wave">AATO {m.aatoBand}</Badge>
        <Badge tone="stone">{m.language}</Badge>
        {m.trialEndsOn && <Badge tone="mango">Trial ends {formatDate(m.trialEndsOn)}</Badge>}
      </div>

      <Card className="p-4 grid grid-cols-2 gap-3">
        <div><div className="text-[10px] text-stone-500">Owner</div><div className="font-bold text-ink">{m.ownerName}</div></div>
        <div><div className="text-[10px] text-stone-500">GSTIN</div><div className="font-mono font-bold text-ink">{m.gstin || 'Unregistered'}</div></div>
        <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-stone-400" />{m.phone}</div>
        <div className="flex items-center gap-1.5 truncate"><Mail className="w-3.5 h-3.5 text-stone-400" />{m.email}</div>
        <div><div className="text-[10px] text-stone-500">Industry</div>{m.industry}</div>
        <div><div className="text-[10px] text-stone-500">Signed up</div>{formatDate(m.signupDate)}</div>
        <div className="flex items-center gap-1.5">
          {m.platforms.includes('Web') ? <Globe className="w-3.5 h-3.5 text-stone-400" /> : <Smartphone className="w-3.5 h-3.5 text-stone-400" />}
          {m.platforms.join(', ')}
        </div>
        <div><div className="text-[10px] text-stone-500">Lifetime revenue</div><span className="font-mono font-bold text-ink">{formatINR(m.lifetimeRevenue)}</span></div>
      </Card>

      <Card className="p-4 space-y-3">
        <h4 className="font-extrabold text-ink">Usage vs {plan.name} limits</h4>
        <UsageBar label="Invoices this month" used={m.usage.invoicesThisMonth} limit={plan.limits.invoicesPerMonth} />
        <UsageBar label="User logins" used={m.usage.users} limit={plan.limits.users} />
        <UsageBar label="Businesses (GSTINs)" used={m.usage.businesses} limit={plan.limits.businesses} />
        <UsageBar label="e-Way bills this year" used={m.usage.eWayBillsThisYear} limit={plan.limits.eWayBillsPerYear} />
        <UsageBar label="e-Invoices (IRN) this year" used={m.usage.eInvoicesThisYear} limit={plan.limits.eInvoicesPerYear} />
        {m.aatoBand !== '< ₹5 Cr' && plan.limits.eInvoicesPerYear === 0 && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            AATO above ₹5 Cr — e-invoicing is mandatory but not included in this plan. Recommend Platinum.
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h4 className="font-extrabold text-ink">Change plan (manual / offline payment)</h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plan">
            <select value={newPlan} onChange={e => setNewPlan(e.target.value as PlanId)} className={inputCls}>
              {plans.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.name} — ₹{fmtNum(p.priceYearly)}/yr</option>)}
            </select>
          </Field>
          <Field label="Billing cycle">
            <select value={newCycle} onChange={e => setNewCycle(e.target.value as BillingCycle)} className={inputCls}>
              {(['1Y', '2Y', '3Y', 'LIFETIME'] as BillingCycle[]).map(c => <option key={c} value={c}>{CYCLE_LABEL[c]}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton onClick={() => onChangePlan(newPlan, newCycle)} disabled={newPlan === m.planId && newCycle === m.cycle}>
            Apply plan & issue GST invoice
          </PrimaryButton>
          <GhostButton onClick={() => onExtendTrial(7)}><CalendarPlus className="w-3.5 h-3.5" /> Extend trial +7d</GhostButton>
          <GhostButton onClick={() => onExtendTrial(30)}><CalendarPlus className="w-3.5 h-3.5" /> +30d</GhostButton>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h4 className="font-extrabold text-ink">Account actions</h4>
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://wa.me/${m.phone.replace(/[^0-9]/g, '')}?text=${waText}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-mango-50 text-stone-700 border border-mango-200/70 font-semibold px-3 py-1.5 rounded-xl text-xs"
          >
            <MessageCircle className="w-3.5 h-3.5 text-leaf-600" /> WhatsApp owner
          </a>
          {m.status === 'SUSPENDED' || m.status === 'CHURNED' ? (
            <PrimaryButton onClick={onActivate}><PlayCircle className="w-3.5 h-3.5" /> Re-activate account</PrimaryButton>
          ) : (
            <div className="flex gap-2 flex-1 min-w-[260px]">
              <input value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="Reason (e.g. fraud / chargeback)" className={inputCls} />
              <button
                disabled={!suspendReason.trim()}
                onClick={() => { onSuspend(suspendReason.trim()); setSuspendReason(''); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 shrink-0"
              >
                <Ban className="w-3.5 h-3.5" /> Suspend
              </button>
            </div>
          )}
        </div>
        <div className="text-[11px] text-stone-500">
          {subscriptionCount} subscription invoice(s){lastPaid ? ` · last ${formatINR(lastPaid)}` : ''} · {ticketCount} support ticket(s)
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <h4 className="font-extrabold text-ink">Internal notes</h4>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputCls} placeholder="Visible only to admins" />
        <GhostButton onClick={() => onSaveNotes(notes)}>Save note</GhostButton>
      </Card>
    </div>
  );
};
