import React, { useMemo, useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { PLAN_COLORS } from '../../data/adminData';
import { localDate } from '../../utils/gst';
import { Card, StatTile, Badge, fmtNum, fmtCompactINR } from './ui';
import { DailyBarChart, MultiLineChart, SegmentBar, rampColor } from './charts';
import {
  Activity,
  Users,
  IndianRupee,
  Receipt,
  Sparkles,
  AlertTriangle,
  LifeBuoy,
  Clock,
  ChevronRight,
  Table2,
  BarChart3
} from 'lucide-react';
import type { NavTab } from '../Sidebar';

export const PlatformOverview: React.FC<{ onNavigate: (tab: NavTab) => void }> = ({ onNavigate }) => {
  const { merchants, subscriptions, tickets, plans, today, analytics, loading } = useAdmin();
  const [invoiceView, setInvoiceView] = useState<'chart' | 'table'>('chart');

  // last 30 days from the server, missing days filled with 0
  const DAILY_METRICS = useMemo(() => {
    const pick = <T extends { _id: string }>(rows: T[] | undefined, d: string) => rows?.find(r => r._id === d);
    return Array.from({ length: 30 }, (_, i) => {
      const date = localDate(i - 29);
      return {
        date,
        invoices: pick(analytics?.invoicesPerDay, date)?.invoices ?? 0,
        signups: pick(analytics?.signupsPerDay, date)?.signups ?? 0,
        activated: pick(analytics?.activatedPerDay, date)?.activated ?? 0,
        activeMerchants: pick(analytics?.activeMerchantsPerDay, date)?.activeMerchants ?? 0
      };
    });
  }, [analytics]);
  const RETENTION_COHORTS = analytics?.retention ?? [];
  const totals = analytics?.totals ?? { businesses: 0, paid: 0, trials: 0, suspended: 0, users: 0 };
  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'short' });

  const last = DAILY_METRICS[DAILY_METRICS.length - 1];
  const prev7 = DAILY_METRICS.slice(-14, -7);
  const last7 = DAILY_METRICS.slice(-7);
  const sum = (arr: typeof DAILY_METRICS, k: 'invoices' | 'signups' | 'activated') => arr.reduce((a, d) => a + d[k], 0);
  const prevInv = sum(prev7, 'invoices');
  const invTrend = prevInv ? ((sum(last7, 'invoices') - prevInv) / prevInv) * 100 : null;
  const signups30 = analytics?.activation.signups30 ?? 0;
  const activated30 = analytics?.activation.activated30 ?? 0;
  const activationRate = analytics?.activation.rate ?? 0;
  // month-1 retention of the most recent cohort that has a month 1
  const m1Cohort = [...RETENTION_COHORTS].reverse().find(c => c.retention.length > 1);
  const d30Retention = m1Cohort?.retention[1];

  const in7days = useMemo(() => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const trialsExpiring = merchants.filter(m => m.status === 'TRIAL' && m.trialEndsOn && m.trialEndsOn <= in7days);
  const pastDue = subscriptions.filter(s => s.status === 'PAST_DUE');
  const urgentTickets = tickets.filter(t => (t.priority === 'URGENT' || t.priority === 'HIGH') && (t.status === 'OPEN' || t.status === 'IN_PROGRESS'));
  const overLimit = merchants.filter(m => {
    const p = plans.find(x => x.id === m.planId)!;
    return m.usage.users > p.limits.users || (p.limits.eInvoicesPerYear !== null && p.limits.eInvoicesPerYear > 0 && m.usage.eInvoicesThisYear > p.limits.eInvoicesPerYear);
  });

  const planSegments = plans.map(p => ({ label: p.name, value: analytics?.planMix[p.id] ?? 0, color: PLAN_COLORS[p.id] }));
  const maxMonths = Math.max(1, ...RETENTION_COHORTS.map(c => c.retention.length));

  if (!analytics) {
    return <div className="text-center text-stone-500 text-xs py-20">{loading ? 'Loading platform analytics…' : 'No analytics available.'}</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-400 via-mango-500 to-orange-600 rounded-3xl p-6 sm:p-7 text-white shadow-xl shadow-mango-500/25 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/15 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 relative">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-white/85">Mango Invoice · Platform today</span>
            <div className="text-4xl font-black mt-1 font-mono tracking-tight">{fmtNum(last.invoices)}</div>
            <p className="text-xs font-semibold text-white/90 mt-1">
              invoices created today across {fmtNum(last.activeMerchants)} merchants
              {invTrend !== null && ` · ${invTrend >= 0 ? '+' : ''}${invTrend.toFixed(1)}% vs previous week`}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { k: 'MRR', v: fmtCompactINR(analytics.revenue.mrr) },
              { k: `e-Invoices (${monthLabel})`, v: fmtNum(analytics.thisMonth.eInvoices) },
              { k: `e-Way bills (${monthLabel})`, v: fmtNum(analytics.thisMonth.eWayBills) }
            ].map(x => (
              <div key={x.k} className="bg-white/15 backdrop-blur-sm rounded-2xl px-3 py-2.5 border border-white/20">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/85">{x.k}</div>
                <div className="text-sm font-black font-mono mt-0.5">{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total merchants" value={fmtNum(totals.businesses)} sub={`${fmtNum(totals.trials)} on trial · ${fmtNum(totals.suspended)} suspended`} icon={Users} />
        <StatTile label="Paid merchants" value={fmtNum(totals.paid)} sub={totals.businesses ? `${((totals.paid / totals.businesses) * 100).toFixed(1)}% conversion` : '—'} icon={IndianRupee} />
        <StatTile label="Activation (30d)" value={`${activationRate.toFixed(1)}%`} sub={`${fmtNum(activated30)} of ${fmtNum(signups30)} made an invoice within 7 days`} icon={Sparkles} />
        <StatTile label="Month-1 retention" value={d30Retention !== undefined ? `${d30Retention}%` : '—'} sub={m1Cohort ? `${m1Cohort.cohort} cohort` : 'needs a month of data'} icon={Activity} />
      </div>

      {/* Invoices per day */}
      <Card className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-extrabold text-sm text-ink">Invoices created per day</h3>
            <p className="text-[11px] text-stone-500">Last 30 days · all merchants · created in the app or web</p>
          </div>
          <button
            onClick={() => setInvoiceView(invoiceView === 'chart' ? 'table' : 'chart')}
            className="text-[11px] font-semibold text-stone-500 hover:text-ink flex items-center gap-1 border border-mango-100 rounded-lg px-2 py-1"
          >
            {invoiceView === 'chart' ? <Table2 className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />}
            {invoiceView === 'chart' ? 'Table view' : 'Chart view'}
          </button>
        </div>
        {invoiceView === 'chart' ? (
          <DailyBarChart data={DAILY_METRICS.map(d => ({ date: d.date, value: d.invoices }))} color="#f7781b" valueLabel="invoices" />
        ) : (
          <div className="max-h-56 overflow-y-auto text-xs">
            <table className="w-full">
              <thead className="text-[10px] uppercase text-stone-500 sticky top-0 bg-white">
                <tr>
                  <th className="text-left p-1.5">Date</th>
                  <th className="text-right p-1.5">Invoices</th>
                  <th className="text-right p-1.5">Active merchants</th>
                  <th className="text-right p-1.5">Signups</th>
                  <th className="text-right p-1.5">Activated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mango-100 font-mono">
                {[...DAILY_METRICS].reverse().map(d => (
                  <tr key={d.date}>
                    <td className="p-1.5">{d.date}</td>
                    <td className="p-1.5 text-right">{fmtNum(d.invoices)}</td>
                    <td className="p-1.5 text-right">{fmtNum(d.activeMerchants)}</td>
                    <td className="p-1.5 text-right">{fmtNum(d.signups)}</td>
                    <td className="p-1.5 text-right">{fmtNum(d.activated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-extrabold text-sm text-ink">Signups vs activated merchants</h3>
          <p className="text-[11px] text-stone-500 mb-2">
            Activated = created first GST invoice within 7 days · 30-day total {fmtNum(signups30)} signups → {fmtNum(activated30)} activated
          </p>
          <div className="flex gap-4 text-[11px] mb-1">
            <span className="flex items-center gap-1.5 text-stone-700"><span className="w-3 h-0.5 bg-[#1a5ba6]" />Signups</span>
            <span className="flex items-center gap-1.5 text-stone-700"><span className="w-3 h-0.5 bg-[#e25e0e]" />Activated</span>
          </div>
          <MultiLineChart
            dates={DAILY_METRICS.map(d => d.date)}
            series={[
              { name: 'Signups', color: '#1a5ba6', values: DAILY_METRICS.map(d => d.signups) },
              { name: 'Activated', color: '#e25e0e', values: DAILY_METRICS.map(d => d.activated) }
            ]}
          />
        </Card>

        <Card className="p-5">
          <h3 className="font-extrabold text-sm text-ink">Plan mix</h3>
          <p className="text-[11px] text-stone-500 mb-4">
            {fmtNum(totals.businesses)} businesses by plan (trials counted under their base plan)
          </p>
          <SegmentBar segments={planSegments} />
          <div className="mt-5 pt-4 border-t border-mango-100 space-y-1.5 text-[11px]">
            {plans.filter(p => p.priceYearly > 0).map(p => (
              <div key={p.id} className="flex justify-between">
                <span className="text-stone-600">{p.name} ARR</span>
                <span className="font-mono font-bold text-ink">{fmtCompactINR((analytics.planMix[p.id] ?? 0) * p.priceYearly)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Retention cohorts */}
      <Card className="p-5">
        <h3 className="font-extrabold text-sm text-ink">Monthly retention by signup cohort</h3>
        <p className="text-[11px] text-stone-500 mb-3">% of merchants who created at least one invoice in month N after signup. Darker = higher retention.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate" style={{ borderSpacing: 2 }}>
            <thead>
              <tr className="text-[10px] uppercase text-stone-500">
                <th className="text-left p-1.5 font-bold">Cohort</th>
                <th className="text-right p-1.5 font-bold">Merchants</th>
                {Array.from({ length: maxMonths }, (_, i) => (
                  <th key={i} className="p-1.5 font-bold text-center">M{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RETENTION_COHORTS.map(c => (
                <tr key={c.cohort}>
                  <td className="p-1.5 font-semibold text-stone-700 whitespace-nowrap">{c.cohort}</td>
                  <td className="p-1.5 text-right font-mono text-stone-500">{fmtNum(c.size)}</td>
                  {Array.from({ length: maxMonths }, (_, i) => {
                    const v = c.retention[i];
                    if (v === undefined) return <td key={i} />;
                    const col = rampColor(v);
                    return (
                      <td key={i} className="p-1.5 text-center font-mono font-bold rounded" style={{ background: col.bg, color: col.fg }} title={`${c.cohort} · month ${i}: ${v}%`}>
                        {v}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Needs attention */}
      <div>
        <h3 className="font-extrabold text-sm text-ink mb-3 px-1">Needs attention</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { icon: Clock, tone: 'mango' as const, title: `${trialsExpiring.length} trials expiring in 7 days`, sub: trialsExpiring.slice(0, 2).map(m => m.businessName).join(', ') || 'None', tab: 'merchants' as NavTab, cta: 'Review' },
            { icon: IndianRupee, tone: 'rose' as const, title: `${pastDue.length} past-due subscriptions`, sub: 'Payment failed on Razorpay / Play Billing', tab: 'subscriptions' as NavTab, cta: 'Retry' },
            { icon: LifeBuoy, tone: 'wave' as const, title: `${urgentTickets.length} urgent / high tickets open`, sub: urgentTickets[0]?.subject ?? 'Queue is clear', tab: 'support' as NavTab, cta: 'Open' },
            { icon: AlertTriangle, tone: 'amber' as const, title: `${overLimit.length} merchants over plan limits`, sub: 'Upsell users / e-invoice packs', tab: 'merchants' as NavTab, cta: 'Upsell' }
          ].map(item => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="p-4 flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mango-50 text-mango-600 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-ink">{item.title}</div>
                    <div className="text-[11px] text-stone-500 mt-0.5 line-clamp-2">{item.sub}</div>
                  </div>
                </div>
                <button onClick={() => onNavigate(item.tab)} className="self-start">
                  <Badge tone={item.tone}>
                    {item.cta} <ChevronRight className="w-3 h-3" />
                  </Badge>
                </button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent signups */}
      <Card className="p-5">
        <div className="flex items-center justify-between pb-3 border-b border-mango-100">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-mango-500" />
            <h3 className="font-extrabold text-sm text-ink">Most active merchants this month</h3>
          </div>
          <button onClick={() => onNavigate('merchants')} className="text-xs text-mango-600 hover:text-mango-700 font-semibold flex items-center">
            All merchants <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="divide-y divide-mango-100">
          {[...merchants]
            .sort((a, b) => b.usage.invoicesThisMonth - a.usage.invoicesThisMonth)
            .slice(0, 6)
            .map(m => (
              <div key={m.id} className="flex items-center justify-between py-2.5 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PLAN_COLORS[m.planId] }} />
                  <div className="min-w-0">
                    <div className="font-bold text-ink truncate">{m.businessName}</div>
                    <div className="text-[10px] text-stone-500">{m.city}, {m.state} · {m.industry}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge tone="stone">{plans.find(p => p.id === m.planId)?.name}</Badge>
                  <span className="font-mono font-bold text-ink w-24 text-right">{fmtNum(m.usage.invoicesThisMonth)} inv</span>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
};
