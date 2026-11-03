import React, { useCallback, useEffect, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { get, patch, errMsg, download } from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { downloadCsv } from '../utils/gst';
import { Card, SegmentedTabs, GhostButton, PrimaryButton, Field, inputCls, Drawer, EmptyState } from './admin/ui';
import { Download, Landmark } from 'lucide-react';

type Tab = 'CASH' | 'BANK' | 'BALANCE_SHEET' | 'TRIAL' | 'CASH_FLOW';

interface BookRow { date: string; particulars: string; ref: string; mode: string; receipt: number; payment: number; balance: number }
interface Book { opening: number; rows: BookRow[]; receipts: number; payments: number; closing: number }
interface Statements {
  asOn: string;
  balanceSheet: { assets: Record<string, number>; totalAssets: number; liabilities: Record<string, number>; totalLiabilities: number; ownersEquity: number };
  trialBalance: { rows: { account: string; dr: number; cr: number }[]; total: number };
  cashFlow: { receiptsFromCustomers: number; paymentsToSuppliers: number; expensesPaid: number; netOperating: number; byCategory: { category: string; amount: number }[] };
  note: string;
}

const LABELS: Record<string, string> = {
  debtors: 'Sundry debtors (receivables)',
  stock: 'Closing stock (at cost)',
  cash: 'Cash in hand',
  bank: 'Bank balance',
  gstReceivable: 'GST input credit carried forward',
  tdsReceivable: 'TDS receivable',
  creditors: 'Sundry creditors (payables)',
  gstPayable: 'GST payable',
  tcsPayable: 'TCS payable'
};

/** Cash & bank books, balance sheet, trial balance, cash flow (spec §8.8 / §8.9 P1) and Tally export. */
export const BooksOfAccount: React.FC = () => {
  const { showToast, current } = useBilling();
  const [tab, setTab] = useState<Tab>('CASH');
  const [book, setBook] = useState<Book | null>(null);
  const [st, setSt] = useState<Statements | null>(null);
  const [editOpening, setEditOpening] = useState(false);
  const fyStart = (() => {
    const d = new Date();
    return `${d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1}-04-01`;
  })();
  const [from, setFrom] = useState(fyStart);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    try {
      if (tab === 'CASH' || tab === 'BANK') setBook(await get<Book>(`/api/books/${tab === 'CASH' ? 'cash' : 'bank'}?from=${from}&to=${to}`));
      else setSt(await get<Statements>(`/api/books/statements?from=${from}&to=${to}`));
    } catch (e) {
      showToast(errMsg(e));
    }
  }, [tab, from, to, showToast]);
  useEffect(() => {
    load();
  }, [load]);

  const tally = () => download(`/api/tally/vouchers.xml?from=${from}&to=${to}`, `tally-vouchers-${from}-to-${to}.xml`).catch(e => showToast(errMsg(e)));

  const opening = (current?.business as { openingBalances?: { cash?: number; bank?: number; asOn?: string } } | undefined)?.openingBalances;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { id: 'CASH', label: 'Cash book' },
            { id: 'BANK', label: 'Bank book' },
            { id: 'BALANCE_SHEET', label: 'Balance sheet' },
            { id: 'TRIAL', label: 'Trial balance' },
            { id: 'CASH_FLOW', label: 'Cash flow' }
          ]}
        />
        <div className="flex items-center gap-2 text-xs">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={`${inputCls} w-36`} aria-label="From" />
          <span className="text-stone-400">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={`${inputCls} w-36`} aria-label="To" />
          <GhostButton onClick={() => setEditOpening(true)}><Landmark className="w-3.5 h-3.5" /> Opening balances</GhostButton>
          <GhostButton onClick={tally}><Download className="w-3.5 h-3.5" /> Tally XML</GhostButton>
        </div>
      </div>

      {(tab === 'CASH' || tab === 'BANK') && book && (
        <Card className="p-4">
          <div className="flex justify-between text-xs mb-3">
            <span className="text-stone-600">Opening <b className="font-mono text-ink">{formatINR(book.opening)}</b> · receipts <b className="font-mono text-leaf-700">{formatINR(book.receipts)}</b> · payments <b className="font-mono text-rose-600">{formatINR(book.payments)}</b></span>
            <span className="text-stone-600">Closing <b className="font-mono text-ink">{formatINR(book.closing)}</b></span>
          </div>
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-mango-50/60 text-stone-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr><th className="p-2.5">Date</th><th className="p-2.5">Particulars</th><th className="p-2.5">Ref</th>{tab === 'BANK' && <th className="p-2.5">Mode</th>}<th className="p-2.5 text-right">Receipt</th><th className="p-2.5 text-right">Payment</th><th className="p-2.5 text-right">Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-mango-100">
              {book.rows.map((r, i) => (
                <tr key={i}>
                  <td className="p-2.5 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="p-2.5">{r.particulars}</td>
                  <td className="p-2.5 font-mono text-[11px]">{r.ref}</td>
                  {tab === 'BANK' && <td className="p-2.5 text-[10px]">{r.mode.replace('_', '/')}</td>}
                  <td className="p-2.5 text-right font-mono text-leaf-700">{r.receipt ? formatINR(r.receipt) : ''}</td>
                  <td className="p-2.5 text-right font-mono text-rose-600">{r.payment ? formatINR(r.payment) : ''}</td>
                  <td className={`p-2.5 text-right font-mono font-bold ${r.balance < 0 ? 'text-rose-600' : 'text-ink'}`}>{formatINR(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {book.rows.length === 0 && <EmptyState text="No entries in this period." />}
          <div className="mt-3 text-right">
            <GhostButton onClick={() => downloadCsv(`${tab.toLowerCase()}-book.csv`, ['Date', 'Particulars', 'Ref', 'Mode', 'Receipt', 'Payment', 'Balance'], book.rows.map(r => [r.date, r.particulars, r.ref, r.mode, r.receipt, r.payment, r.balance]))}>
              <Download className="w-3.5 h-3.5" /> CSV
            </GhostButton>
          </div>
        </Card>
      )}

      {tab === 'BALANCE_SHEET' && st && (
        <Card className="p-5 text-xs">
          <h3 className="font-extrabold text-sm text-ink mb-3">Balance sheet as on {formatDate(st.asOn)}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase text-stone-500 mb-1">Liabilities & capital</div>
              {Object.entries(st.balanceSheet.liabilities).map(([k, v]) => <Line key={k} k={LABELS[k] ?? k} v={v} />)}
              <Line k="Owner's capital & retained profit" v={st.balanceSheet.ownersEquity} />
              <Line k="Total" v={st.balanceSheet.totalLiabilities + st.balanceSheet.ownersEquity} strong />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-stone-500 mb-1">Assets</div>
              {Object.entries(st.balanceSheet.assets).map(([k, v]) => <Line key={k} k={LABELS[k] ?? k} v={v} />)}
              <Line k="Total" v={st.balanceSheet.totalAssets} strong />
            </div>
          </div>
          <p className="text-[10px] text-stone-500 mt-4">{st.note}</p>
        </Card>
      )}

      {tab === 'TRIAL' && st && (
        <Card className="p-5 text-xs max-w-2xl">
          <table className="w-full">
            <thead className="text-[10px] uppercase text-stone-500"><tr><th className="text-left p-2">Account</th><th className="text-right p-2">Debit</th><th className="text-right p-2">Credit</th></tr></thead>
            <tbody className="divide-y divide-mango-100 font-mono">
              {st.trialBalance.rows.map(r => (
                <tr key={r.account}><td className="p-2 font-sans text-stone-700">{r.account}</td><td className="p-2 text-right">{r.dr ? formatINR(r.dr) : ''}</td><td className="p-2 text-right">{r.cr ? formatINR(r.cr) : ''}</td></tr>
              ))}
              <tr className="font-black text-ink border-t-2 border-ink"><td className="p-2 font-sans">Total</td><td className="p-2 text-right">{formatINR(st.trialBalance.total)}</td><td className="p-2 text-right">{formatINR(st.trialBalance.total)}</td></tr>
            </tbody>
          </table>
          <p className="text-[10px] text-stone-500 mt-3">{st.note}</p>
        </Card>
      )}

      {tab === 'CASH_FLOW' && st && (
        <Card className="p-5 text-xs max-w-2xl">
          <h3 className="font-extrabold text-sm text-ink mb-2">Cash flow from operations · {formatDate(from)} – {formatDate(to)}</h3>
          <Line k="Received from customers" v={st.cashFlow.receiptsFromCustomers} />
          <Line k="Paid to suppliers" v={-st.cashFlow.paymentsToSuppliers} />
          <Line k="Expenses paid" v={-st.cashFlow.expensesPaid} />
          {st.cashFlow.byCategory.map(c => <Line key={c.category} k={`  ${c.category}`} v={-c.amount} indent />)}
          <Line k="Net cash from operations" v={st.cashFlow.netOperating} strong />
        </Card>
      )}

      <Drawer open={editOpening} onClose={() => setEditOpening(false)} title="Opening balances">
        {editOpening && <OpeningForm initial={opening} onSaved={() => { setEditOpening(false); load(); }} />}
      </Drawer>
    </div>
  );
};


const Line: React.FC<{ k: string; v: number; strong?: boolean; indent?: boolean }> = ({ k, v, strong, indent }) => (
  <div className={`flex justify-between py-1.5 ${strong ? 'border-t border-mango-200 font-black text-ink text-sm' : 'text-stone-700'} ${indent ? 'pl-4 text-[11px] text-stone-500' : ''}`}>
    <span>{k}</span>
    <span className={`font-mono ${v < 0 ? 'text-rose-600' : ''}`}>{formatINR(v)}</span>
  </div>
);

const OpeningForm: React.FC<{ initial?: { cash?: number; bank?: number; asOn?: string }; onSaved: () => void }> = ({ initial, onSaved }) => {
  const { showToast, reload } = useBilling();
  const [f, setF] = useState({ cash: initial?.cash ?? 0, bank: initial?.bank ?? 0, asOn: initial?.asOn || `${new Date().getFullYear()}-04-01` });
  return (
    <form
      className="space-y-3 text-xs"
      onSubmit={async e => {
        e.preventDefault();
        try {
          await patch('/api/books/opening', f);
          showToast('Opening balances saved');
          await reload();
          onSaved();
        } catch (err) {
          showToast(errMsg(err));
        }
      }}
    >
      <Field label="Cash in hand (₹)"><input type="number" className={inputCls} value={f.cash} onChange={e => setF({ ...f, cash: Number(e.target.value) })} /></Field>
      <Field label="Bank balance (₹, all accounts)"><input type="number" className={inputCls} value={f.bank} onChange={e => setF({ ...f, bank: Number(e.target.value) })} /></Field>
      <Field label="As on"><input type="date" className={inputCls} value={f.asOn} onChange={e => setF({ ...f, asOn: e.target.value })} /></Field>
      <PrimaryButton type="submit">Save</PrimaryButton>
    </form>
  );
};
