import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { useDocuments } from '../context/DocumentsContext';
import { DocType, EXPENSE_CATEGORIES, ExpenseCategory, Expense } from '../types/documents';
import { PaymentMode } from '../types';
import { formatINR, formatDate } from '../utils/formatters';
import { downloadCsv, localDate } from '../utils/gst';
import { Card, PageHeader, SegmentedTabs, StatTile, PrimaryButton, GhostButton, Field, inputCls, Toggle, Drawer, Badge, EmptyState } from './admin/ui';
import { DocumentList } from './documents/DocumentList';
import { ShoppingCart, Plus, Trash2, Download, IndianRupee, Receipt, Landmark, PiggyBank } from 'lucide-react';

type Tab = 'PURCHASE_BILL' | 'PURCHASE_ORDER' | 'DEBIT_NOTE' | 'EXPENSES';

const DESCRIPTIONS: Record<Exclude<Tab, 'EXPENSES'>, string> = {
  PURCHASE_BILL: 'Supplier invoices: stock goes up, supplier payable is booked, and GST input (ITC) is tracked for GSTR-3B Table 4.',
  PURCHASE_ORDER: 'Orders placed with suppliers. When goods arrive, convert to a purchase bill in one click.',
  DEBIT_NOTE: 'Purchase returns / rate differences against a purchase bill. Stock goes down and the supplier payable reduces.'
};

export const Purchases: React.FC = () => {
  const { activeBusiness } = useBilling();
  const { documents, expenses } = useDocuments();
  const [tab, setTab] = useState<Tab>('PURCHASE_BILL');

  const bills = documents.filter(d => d.docType === 'PURCHASE_BILL' && d.businessId === activeBusiness.id && d.status !== 'CANCELLED');
  const notes = documents.filter(d => d.docType === 'DEBIT_NOTE' && d.businessId === activeBusiness.id && d.status !== 'CANCELLED');
  const bizExpenses = expenses.filter(e => e.businessId === activeBusiness.id);
  const monthKey = new Date().toISOString().slice(0, 7);

  const purchasesMonth = bills.filter(b => b.date.startsWith(monthKey)).reduce((a, b) => a + b.taxableTotal, 0);
  const payable = bills.reduce((a, b) => a + (b.grandTotal - b.amountPaid), 0);
  const itc =
    bills.filter(b => b.itcEligible !== false).reduce((a, b) => a + b.totalGst, 0) -
    notes.reduce((a, n) => a + n.totalGst, 0) +
    bizExpenses.filter(e => e.itcEligible).reduce((a, e) => a + e.gstAmount, 0);
  const expenseMonth = bizExpenses.filter(e => e.date.startsWith(monthKey)).reduce((a, e) => a + e.total, 0);
  const count = (t: DocType) => documents.filter(d => d.docType === t && d.businessId === activeBusiness.id && d.status !== 'CANCELLED').length;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={ShoppingCart}
        title="Purchases & expenses"
        subtitle="Purchase bills, purchase orders, purchase returns, payment-out to suppliers and business expenses with GST input"
        actions={
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { id: 'PURCHASE_BILL', label: 'Purchase bills', count: count('PURCHASE_BILL') },
              { id: 'PURCHASE_ORDER', label: 'Purchase orders', count: count('PURCHASE_ORDER') },
              { id: 'DEBIT_NOTE', label: 'Returns / debit notes', count: count('DEBIT_NOTE') },
              { id: 'EXPENSES', label: 'Expenses', count: bizExpenses.length }
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Purchases this month" value={formatINR(purchasesMonth)} sub="taxable value" icon={Receipt} />
        <StatTile label="Payable to suppliers" value={formatINR(payable)} sub={`${bills.filter(b => b.amountPaid < b.grandTotal).length} open bills`} icon={Landmark} />
        <StatTile label="Eligible ITC" value={formatINR(itc)} sub="bills + expenses − debit notes" icon={PiggyBank} />
        <StatTile label="Expenses this month" value={formatINR(expenseMonth)} sub="incl. GST" icon={IndianRupee} />
      </div>

      {tab === 'EXPENSES' ? <Expenses /> : <DocumentList key={tab} docType={tab} description={DESCRIPTIONS[tab]} />}
    </div>
  );
};

const Expenses: React.FC = () => {
  const { activeBusiness } = useBilling();
  const { expenses, addExpense, deleteExpense } = useDocuments();
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<'ALL' | ExpenseCategory>('ALL');

  const rows = expenses
    .filter(e => e.businessId === activeBusiness.id && (category === 'ALL' || e.category === category))
    .sort((a, b) => b.date.localeCompare(a.date));

  const byCategory = EXPENSE_CATEGORIES.map(c => ({ c, total: expenses.filter(e => e.businessId === activeBusiness.id && e.category === c).reduce((a, e) => a + e.total, 0) }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...byCategory.map(x => x.total));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-4 space-y-3 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <select value={category} onChange={e => setCategory(e.target.value as 'ALL' | ExpenseCategory)} className={`${inputCls} w-56`}>
            <option value="ALL">All categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <div className="flex gap-2">
            <GhostButton
              onClick={() =>
                downloadCsv('expenses.csv', ['Number', 'Date', 'Category', 'Vendor', 'GSTIN', 'Description', 'Amount', 'GST %', 'GST', 'Total', 'Mode', 'ITC'],
                  rows.map(e => [e.number, e.date, e.category, e.vendorName, e.vendorGstin ?? '', e.description, e.amount, e.gstRate, e.gstAmount, e.total, e.mode, e.itcEligible ? 'Yes' : 'No']))
              }
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </GhostButton>
            <PrimaryButton onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5" /> Add expense</PrimaryButton>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-mango-50/60 text-stone-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Category / vendor</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-right">GST</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Mode</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-mango-100">
              {rows.map(e => (
                <tr key={e.id} className="hover:bg-mango-50/50">
                  <td className="p-3 whitespace-nowrap">{formatDate(e.date)}<div className="text-[10px] font-mono text-stone-400">{e.number}</div></td>
                  <td className="p-3">
                    <div className="font-semibold text-ink">{e.category}</div>
                    <div className="text-[10px] text-stone-500">{e.vendorName} · {e.description}</div>
                  </td>
                  <td className="p-3 text-right font-mono">{formatINR(e.amount)}</td>
                  <td className="p-3 text-right font-mono text-stone-500">
                    {formatINR(e.gstAmount)}
                    {e.itcEligible && e.gstAmount > 0 && <div><Badge tone="leaf">ITC</Badge></div>}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-ink">{formatINR(e.total)}</td>
                  <td className="p-3 text-[10px]">{e.mode.replace('_', ' / ')}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => window.confirm(`Delete ${e.number}?`) && deleteExpense(e.id)} className="p-1.5 text-stone-400 hover:text-rose-600" aria-label="Delete expense">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState text="No expenses in this category." />}
        </div>
      </Card>

      <Card className="p-4 h-fit">
        <h3 className="font-extrabold text-sm text-ink mb-3">Spend by category</h3>
        <div className="space-y-2.5">
          {byCategory.map(x => (
            <div key={x.c}>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-stone-700 font-semibold">{x.c}</span>
                <span className="font-mono text-stone-500">{formatINR(x.total)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-mango-50">
                <div className="h-full rounded-full bg-mango-500" style={{ width: `${(x.total / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Drawer open={adding} onClose={() => setAdding(false)} title="Add expense">
        {adding && <ExpenseForm onSave={async e => { if (await addExpense(e)) setAdding(false); }} />}
      </Drawer>
    </div>
  );
};

const ExpenseForm: React.FC<{ onSave: (e: Omit<Expense, 'id' | 'number' | 'businessId'>) => void }> = ({ onSave }) => {
  const [f, setF] = useState({
    date: localDate(),
    category: 'Office Supplies' as ExpenseCategory,
    vendorName: '',
    vendorGstin: '',
    description: '',
    amount: 0,
    gstRate: 18,
    mode: 'UPI' as PaymentMode,
    itcEligible: true,
    reference: ''
  });
  const gstAmount = Math.round(f.amount * f.gstRate) / 100;
  const gstinOk = !f.vendorGstin || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(f.vendorGstin);
  // ITC needs a registered vendor and GST charged
  const itc = f.itcEligible && !!f.vendorGstin && gstAmount > 0;
  const valid = f.vendorName.trim() && f.amount > 0 && gstinOk;

  return (
    <form
      className="space-y-3 text-xs"
      onSubmit={e => {
        e.preventDefault();
        if (!valid) return;
        onSave({
          date: f.date,
          category: f.category,
          vendorName: f.vendorName.trim(),
          vendorGstin: f.vendorGstin || undefined,
          description: f.description.trim(),
          amount: f.amount,
          gstRate: f.gstRate,
          gstAmount,
          total: f.amount + gstAmount,
          mode: f.mode,
          itcEligible: itc,
          reference: f.reference || undefined
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Category">
          <select className={inputCls} value={f.category} onChange={e => setF({ ...f, category: e.target.value as ExpenseCategory })}>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Paid to (vendor)"><input className={inputCls} value={f.vendorName} onChange={e => setF({ ...f, vendorName: e.target.value })} required /></Field>
        <Field label="Vendor GSTIN (for ITC)" hint={gstinOk ? undefined : 'Invalid GSTIN format'}>
          <input className={`${inputCls} font-mono uppercase ${gstinOk ? '' : 'border-rose-400'}`} value={f.vendorGstin} onChange={e => setF({ ...f, vendorGstin: e.target.value.toUpperCase().trim() })} maxLength={15} />
        </Field>
        <div className="col-span-2"><Field label="Description"><input className={inputCls} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field></div>
        <Field label="Amount before GST (₹)"><input type="number" min={0} step="0.01" className={`${inputCls} font-mono`} value={f.amount} onChange={e => setF({ ...f, amount: Math.max(0, Number(e.target.value)) })} /></Field>
        <Field label="GST rate">
          <select className={inputCls} value={f.gstRate} onChange={e => setF({ ...f, gstRate: Number(e.target.value) })}>
            {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
          </select>
        </Field>
        <Field label="Paid via">
          <select className={inputCls} value={f.mode} onChange={e => setF({ ...f, mode: e.target.value as PaymentMode })}>
            {(['UPI', 'CASH', 'NEFT_RTGS', 'CHEQUE', 'CARD'] as PaymentMode[]).map(m => <option key={m} value={m}>{m.replace('_', ' / ')}</option>)}
          </select>
        </Field>
        <Field label="Reference"><input className={`${inputCls} font-mono`} value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} /></Field>
      </div>
      <label className="flex items-center justify-between">
        <span className="font-semibold text-stone-700">Claim GST input (ITC)</span>
        <Toggle checked={f.itcEligible} onChange={v => setF({ ...f, itcEligible: v })} />
      </label>
      {f.itcEligible && !itc && <div className="text-[11px] text-stone-500">ITC needs a vendor GSTIN and GST charged, so this will be saved without ITC.</div>}
      <div className="flex justify-between bg-cream border border-mango-100 rounded-xl p-3 font-mono">
        <span className="font-sans text-stone-600">GST {formatINR(gstAmount)}</span>
        <span className="font-bold text-ink">Total {formatINR(f.amount + gstAmount)}</span>
      </div>
      <PrimaryButton type="submit" disabled={!valid}>Save expense</PrimaryButton>
    </form>
  );
};
