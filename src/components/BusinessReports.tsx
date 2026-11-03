import React, { useMemo, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { useDocuments } from '../context/DocumentsContext';
import { formatINR, formatDate } from '../utils/formatters';
import { downloadCsv, daysBetween, localDate } from '../utils/gst';
import { Card, PageHeader, SegmentedTabs, StatTile, GhostButton, Badge, inputCls, EmptyState } from './admin/ui';
import { BooksOfAccount } from './BooksOfAccount';
import { BarChart3, Download, MessageCircle, TrendingUp, TrendingDown, Scale, Wallet } from 'lucide-react';

type Tab = 'PNL' | 'DAYBOOK' | 'RECEIVABLES' | 'PAYABLES' | 'ITEMS' | 'BOOKS';
type Period = 'THIS_MONTH' | 'LAST_MONTH' | 'FY' | 'ALL';

const todayIso = () => localDate();

function periodRange(p: Period): [string, string] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p === 'THIS_MONTH') return [iso(new Date(Date.UTC(y, m, 1))), todayIso()];
  if (p === 'LAST_MONTH') return [iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))];
  if (p === 'FY') return [`${m >= 3 ? y : y - 1}-04-01`, todayIso()];
  return ['2000-01-01', '2999-12-31'];
}

const BUCKETS = ['Not due', '1–30 days', '31–60 days', '61–90 days', '90+ days'] as const;
const bucketOf = (due: string, today: string) => {
  const late = daysBetween(due, today);
  if (late <= 0) return 0;
  if (late <= 30) return 1;
  if (late <= 60) return 2;
  if (late <= 90) return 3;
  return 4;
};

export const BusinessReports: React.FC = () => {
  const { activeBusiness, invoices, products, payments, parties } = useBilling();
  const { documents, expenses } = useDocuments();
  const [tab, setTab] = useState<Tab>('PNL');
  const [period, setPeriod] = useState<Period>('FY');
  const [day, setDay] = useState(todayIso());
  const today = todayIso();

  const [from, to] = periodRange(period);
  const inRange = (d: string) => d >= from && d <= to;
  const biz = activeBusiness.id;

  const sales = invoices.filter(i => i.businessId === biz && i.status !== 'CANCELLED');
  const docs = documents.filter(d => d.businessId === biz && d.status !== 'CANCELLED');
  const exps = expenses.filter(e => e.businessId === biz);
  const costOf = (productId: string | undefined, name: string) => products.find(p => p.id === productId || p.name === name)?.purchasePrice ?? 0;

  // ---------- P&L ----------
  const pnl = useMemo(() => {
    const periodSales = sales.filter(i => inRange(i.invoiceDate));
    const grossSales = periodSales.reduce((a, i) => a + i.taxableTotal, 0);
    const returns = docs.filter(d => d.docType === 'CREDIT_NOTE' && inRange(d.date)).reduce((a, d) => a + d.taxableTotal, 0);
    const cogs = periodSales.reduce((a, i) => a + i.items.reduce((s, it) => s + it.quantity * costOf(it.productId, it.name), 0), 0);
    const returnedCost = docs
      .filter(d => d.docType === 'CREDIT_NOTE' && d.restock && inRange(d.date))
      .reduce((a, d) => a + d.items.reduce((s, it) => s + it.quantity * costOf(it.productId, it.name), 0), 0);
    const periodExp = exps.filter(e => inRange(e.date));
    // GST on expenses is a cost only when ITC is not claimed
    const expenseByCat: Record<string, number> = {};
    periodExp.forEach(e => {
      expenseByCat[e.category] = (expenseByCat[e.category] ?? 0) + e.amount + (e.itcEligible ? 0 : e.gstAmount);
    });
    const totalExp = Object.values(expenseByCat).reduce((a, v) => a + v, 0);
    const netSales = grossSales - returns;
    const grossProfit = netSales - (cogs - returnedCost);
    const purchases = docs.filter(d => d.docType === 'PURCHASE_BILL' && inRange(d.date)).reduce((a, d) => a + d.taxableTotal, 0);
    return { grossSales, returns, netSales, cogs: cogs - returnedCost, grossProfit, expenseByCat, totalExp, netProfit: grossProfit - totalExp, purchases };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, docs, exps, from, to, products]);

  // ---------- receivables / payables ----------
  const receivables = sales
    .filter(i => i.balanceDue > 0)
    .map(i => ({ id: i.id, party: i.customerName, partyId: i.customerId, phone: i.customerPhone, number: i.invoiceNumber, date: i.invoiceDate, due: i.dueDate, amount: i.balanceDue, bucket: bucketOf(i.dueDate, today) }));
  const payables = docs
    .filter(d => d.docType === 'PURCHASE_BILL' && d.grandTotal - d.amountPaid > 0)
    .map(d => ({ id: d.id, party: d.partyName, partyId: d.partyId, phone: parties.find(p => p.id === d.partyId)?.phone ?? '', number: d.reference ?? d.number, date: d.date, due: d.dueDate ?? d.date, amount: d.grandTotal - d.amountPaid, bucket: bucketOf(d.dueDate ?? d.date, today) }));

  // ---------- day book ----------
  const dayEntries = [
    ...sales.filter(i => i.invoiceDate === day).map(i => ({ type: 'Sales invoice', no: i.invoiceNumber, party: i.customerName, inAmt: 0, outAmt: 0, value: i.grandTotal })),
    ...docs.filter(d => d.date === day).map(d => ({ type: d.docType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()), no: d.number, party: d.partyName, inAmt: 0, outAmt: 0, value: d.grandTotal })),
    ...payments.filter(p => p.businessId === biz && p.paymentDate === day).map(p => ({ type: p.type === 'PAYMENT_IN' ? 'Payment in' : 'Payment out', no: p.referenceNumber, party: p.partyName, inAmt: p.type === 'PAYMENT_IN' ? p.amount : 0, outAmt: p.type === 'PAYMENT_OUT' ? p.amount : 0, value: p.amount })),
    ...exps.filter(e => e.date === day).map(e => ({ type: `Expense · ${e.category}`, no: e.number, party: e.vendorName, inAmt: 0, outAmt: e.total, value: e.total }))
  ];

  // ---------- item-wise profit ----------
  const items = useMemo(() => {
    const map: Record<string, { name: string; hsn: string; qty: number; unit: string; revenue: number; cost: number }> = {};
    sales.filter(i => inRange(i.invoiceDate)).forEach(i =>
      i.items.forEach(it => {
        const k = it.productId ?? it.name;
        map[k] ??= { name: it.name, hsn: it.hsnCode, qty: 0, unit: it.unit, revenue: 0, cost: 0 };
        map[k].qty += it.quantity;
        map[k].revenue += it.taxableAmount;
        map[k].cost += it.quantity * costOf(it.productId, it.name);
      })
    );
    return Object.values(map).sort((a, b) => b.revenue - b.cost - (a.revenue - a.cost));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, from, to, products]);

  const remind = (r: (typeof receivables)[number]) => {
    const upi = activeBusiness.upiId ? ` Pay by UPI: upi://pay?pa=${activeBusiness.upiId}&pn=${encodeURIComponent(activeBusiness.tradeName || activeBusiness.name)}&am=${r.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(r.number)}` : '';
    const text = `Namaste ${r.party}, a gentle reminder that ${formatINR(r.amount)} is pending against invoice ${r.number} (due ${formatDate(r.due)}).${upi} — ${activeBusiness.tradeName || activeBusiness.name}`;
    window.open(`https://wa.me/${r.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const AgeingTable: React.FC<{ rows: typeof receivables; kind: 'receivable' | 'payable' }> = ({ rows, kind }) => {
    const totals = BUCKETS.map((_, b) => rows.filter(r => r.bucket === b).reduce((a, r) => a + r.amount, 0));
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {BUCKETS.map((b, i) => (
            <Card key={b} className={`p-3 ${i >= 3 && totals[i] > 0 ? 'border-rose-200' : ''}`}>
              <div className="text-[10px] font-bold uppercase text-stone-500">{b}</div>
              <div className={`text-sm font-black font-mono mt-1 ${i >= 3 && totals[i] > 0 ? 'text-rose-600' : 'text-ink'}`}>{formatINR(totals[i])}</div>
            </Card>
          ))}
        </div>
        <Card className="p-4">
          <div className="flex justify-end mb-2">
            <GhostButton onClick={() => downloadCsv(`${kind}s-ageing.csv`, ['Party', 'Document', 'Date', 'Due', 'Days overdue', 'Amount', 'Bucket'], rows.map(r => [r.party, r.number, r.date, r.due, Math.max(0, daysBetween(r.due, today)), r.amount, BUCKETS[r.bucket]]))}>
              <Download className="w-3.5 h-3.5" /> CSV
            </GhostButton>
          </div>
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-mango-50/60 text-stone-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Party</th>
                <th className="p-3">Document</th>
                <th className="p-3">Due date</th>
                <th className="p-3">Overdue</th>
                <th className="p-3 text-right">Balance</th>
                {kind === 'receivable' && <th className="p-3 text-right">Reminder</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-mango-100">
              {[...rows].sort((a, b) => b.bucket - a.bucket || b.amount - a.amount).map(r => {
                const late = daysBetween(r.due, today);
                return (
                  <tr key={r.id}>
                    <td className="p-3 font-semibold text-ink">{r.party}</td>
                    <td className="p-3 font-mono">{r.number}</td>
                    <td className="p-3">{formatDate(r.due)}</td>
                    <td className="p-3">{late > 0 ? <Badge tone={late > 60 ? 'rose' : 'amber'}>{late} days</Badge> : <Badge tone="leaf">not due</Badge>}</td>
                    <td className="p-3 text-right font-mono font-bold text-ink">{formatINR(r.amount)}</td>
                    {kind === 'receivable' && (
                      <td className="p-3 text-right">
                        <button onClick={() => remind(r)} className="inline-flex items-center gap-1 text-[11px] font-bold text-leaf-700 bg-leaf-50 border border-leaf-100 px-2 py-1 rounded-lg">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState text={`No outstanding ${kind}s.`} />}
        </Card>
      </div>
    );
  };

  const PnlRow: React.FC<{ label: string; value: number; strong?: boolean; indent?: boolean; negative?: boolean }> = ({ label, value, strong, indent, negative }) => (
    <div className={`flex justify-between py-2 ${strong ? 'border-t border-mango-200 font-black text-ink text-sm' : 'text-stone-700'} ${indent ? 'pl-4 text-[11px]' : ''}`}>
      <span>{label}</span>
      <span className={`font-mono ${value < 0 ? 'text-rose-600' : ''}`}>{negative ? `(${formatINR(value)})` : formatINR(value)}</span>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={BarChart3}
        title="Business reports"
        subtitle="Profit & loss, day book, receivables & payables ageing with WhatsApp reminders, and item-wise profit"
        actions={
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { id: 'PNL', label: 'Profit & loss' },
              { id: 'DAYBOOK', label: 'Day book' },
              { id: 'RECEIVABLES', label: 'Receivables', count: receivables.length },
              { id: 'PAYABLES', label: 'Payables', count: payables.length },
              { id: 'ITEMS', label: 'Item profit' },
              { id: 'BOOKS', label: 'Books & statements' }
            ]}
          />
        }
      />

      {(tab === 'PNL' || tab === 'ITEMS') && (
        <div className="flex items-center gap-2">
          <SegmentedTabs
            value={period}
            onChange={setPeriod}
            options={[
              { id: 'THIS_MONTH', label: 'This month' },
              { id: 'LAST_MONTH', label: 'Last month' },
              { id: 'FY', label: 'This FY' },
              { id: 'ALL', label: 'All time' }
            ]}
          />
          <span className="text-[11px] text-stone-500">{period === 'ALL' ? 'All records' : `${formatDate(from)} – ${formatDate(to)}`}</span>
        </div>
      )}

      {tab === 'PNL' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Net sales" value={formatINR(pnl.netSales)} sub="excl. GST, after returns" icon={TrendingUp} />
            <StatTile label="Gross profit" value={formatINR(pnl.grossProfit)} sub={pnl.netSales ? `${((pnl.grossProfit / pnl.netSales) * 100).toFixed(1)}% margin` : '—'} icon={Scale} />
            <StatTile label="Expenses" value={formatINR(pnl.totalExp)} sub="operating" icon={TrendingDown} />
            <StatTile label="Net profit" value={formatINR(pnl.netProfit)} sub={pnl.netProfit >= 0 ? 'profit' : 'loss'} icon={Wallet} />
          </div>
          <Card className="p-5 max-w-2xl text-xs">
            <h3 className="font-extrabold text-sm text-ink mb-2">Profit & loss statement</h3>
            <PnlRow label="Sales (taxable value)" value={pnl.grossSales} />
            <PnlRow label="Less: sales returns / credit notes" value={pnl.returns} negative />
            <PnlRow label="Net sales" value={pnl.netSales} strong />
            <PnlRow label="Less: cost of goods sold (at purchase price)" value={pnl.cogs} negative />
            <PnlRow label="Gross profit" value={pnl.grossProfit} strong />
            <div className="text-[10px] font-bold uppercase text-stone-500 mt-3">Operating expenses</div>
            {Object.entries(pnl.expenseByCat).map(([k, v]) => <PnlRow key={k} label={k} value={v} indent />)}
            {Object.keys(pnl.expenseByCat).length === 0 && <div className="text-[11px] text-stone-400 py-1 pl-4">No expenses in this period</div>}
            <PnlRow label="Total expenses" value={pnl.totalExp} negative />
            <PnlRow label="Net profit" value={pnl.netProfit} strong />
            <p className="text-[10px] text-stone-500 mt-3">
              COGS uses each item's purchase price from the item master. Purchases booked in period: {formatINR(pnl.purchases)}. GST on expenses is a cost only where ITC isn't claimed.
            </p>
          </Card>
        </>
      )}

      {tab === 'DAYBOOK' && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <input type="date" value={day} onChange={e => setDay(e.target.value)} className={`${inputCls} w-44`} />
            <div className="text-[11px] text-stone-600">
              Cash/bank in <b className="font-mono text-leaf-700">{formatINR(dayEntries.reduce((a, e) => a + e.inAmt, 0))}</b> · out{' '}
              <b className="font-mono text-rose-600">{formatINR(dayEntries.reduce((a, e) => a + e.outAmt, 0))}</b>
            </div>
          </div>
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-mango-50/60 text-stone-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Type</th>
                <th className="p-3">No. / ref</th>
                <th className="p-3">Party</th>
                <th className="p-3 text-right">Value</th>
                <th className="p-3 text-right">Money in</th>
                <th className="p-3 text-right">Money out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mango-100">
              {dayEntries.map((e, i) => (
                <tr key={i}>
                  <td className="p-3 font-semibold text-ink">{e.type}</td>
                  <td className="p-3 font-mono text-[11px]">{e.no}</td>
                  <td className="p-3">{e.party}</td>
                  <td className="p-3 text-right font-mono">{formatINR(e.value)}</td>
                  <td className="p-3 text-right font-mono text-leaf-700">{e.inAmt ? formatINR(e.inAmt) : ''}</td>
                  <td className="p-3 text-right font-mono text-rose-600">{e.outAmt ? formatINR(e.outAmt) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {dayEntries.length === 0 && <EmptyState text={`No transactions on ${formatDate(day)}.`} />}
        </Card>
      )}

      {tab === 'BOOKS' && <BooksOfAccount />}
      {tab === 'RECEIVABLES' && <AgeingTable rows={receivables} kind="receivable" />}
      {tab === 'PAYABLES' && <AgeingTable rows={payables} kind="payable" />}

      {tab === 'ITEMS' && (
        <Card className="p-4">
          <div className="flex justify-end mb-2">
            <GhostButton onClick={() => downloadCsv('item-profit.csv', ['Item', 'HSN', 'Qty', 'Unit', 'Revenue', 'Cost', 'Profit', 'Margin %'], items.map(i => [i.name, i.hsn, i.qty, i.unit, i.revenue.toFixed(2), i.cost.toFixed(2), (i.revenue - i.cost).toFixed(2), i.revenue ? (((i.revenue - i.cost) / i.revenue) * 100).toFixed(1) : '0']))}>
              <Download className="w-3.5 h-3.5" /> CSV
            </GhostButton>
          </div>
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-mango-50/60 text-stone-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Item</th>
                <th className="p-3 text-right">Qty sold</th>
                <th className="p-3 text-right">Revenue</th>
                <th className="p-3 text-right">Cost</th>
                <th className="p-3 text-right">Profit</th>
                <th className="p-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mango-100">
              {items.map(i => {
                const profit = i.revenue - i.cost;
                const margin = i.revenue ? (profit / i.revenue) * 100 : 0;
                return (
                  <tr key={i.name}>
                    <td className="p-3"><div className="font-semibold text-ink">{i.name}</div><div className="text-[10px] font-mono text-stone-500">HSN {i.hsn}</div></td>
                    <td className="p-3 text-right font-mono">{i.qty} {i.unit}</td>
                    <td className="p-3 text-right font-mono">{formatINR(i.revenue)}</td>
                    <td className="p-3 text-right font-mono text-stone-500">{formatINR(i.cost)}</td>
                    <td className={`p-3 text-right font-mono font-bold ${profit < 0 ? 'text-rose-600' : 'text-ink'}`}>{formatINR(profit)}</td>
                    <td className="p-3 text-right"><Badge tone={margin < 10 ? 'rose' : margin < 20 ? 'amber' : 'leaf'}>{margin.toFixed(1)}%</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && <EmptyState text="No sales in this period." />}
        </Card>
      )}
    </div>
  );
};
