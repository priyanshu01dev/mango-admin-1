import React, { useEffect, useState } from 'react';
import { ExternalLink, IndianRupee } from 'lucide-react';
import { useBilling } from '../context/BillingContext';
import { api, ApiError } from '../lib/api';
import { formatINR } from '../utils/formatters';
import { Card, EmptyRow, Pill, Stats, Tabs, Th, THead, Tone } from './ui';

interface Order { id: string; businessName: string; kind: 'plan' | 'coins'; item: string; coins: number; months: number; amount: number; status: string; gatewayRef: string | null; createdAt: string; paidAt: string | null }
interface Resp { summary: { thisMonth: number; byKind: Record<string, { count: number; total: number }> }; data: Order[] }

const TONE: Record<string, Tone> = { paid: 'green', pending: 'amber', failed: 'grey', refunded: 'red' };

/** Plan and coin payments collected through Razorpay, across all businesses. Refunds are done in the Razorpay dashboard. */
export const PlatformPayments: React.FC = () => {
  const { language } = useBilling();
  const hi = language === 'hi';
  const [status, setStatus] = useState<'paid' | 'pending' | 'all'>('paid');
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    api<Resp>('/orders', { query: { status: status === 'all' ? undefined : status } }).then(setData).catch((e: ApiError) => setError(e.status === 404 ? null : e.message));
  }, [status]);
  if (!data && !error) return null;
  const k = data?.summary.byKind ?? {};
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center text-sm font-extrabold text-white"><IndianRupee className="w-4 h-4 mr-1.5 text-emerald-400" />{hi ? 'ऑनलाइन भुगतान (Razorpay)' : 'Online payments (Razorpay)'}</h3>
        <Tabs tabs={[['paid', hi ? 'मिले' : 'Paid'], ['pending', hi ? 'बाकी' : 'Pending'], ['all', hi ? 'सभी' : 'All']]} value={status} onChange={setStatus} />
      </div>
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl p-3">{error}</div>}
      {data && (
        <>
          <Stats items={[
            [hi ? 'इस महीने' : 'This month', formatINR(data.summary.thisMonth)],
            [hi ? 'प्लान' : 'Plans', formatINR(k.plan?.total ?? 0), `${k.plan?.count ?? 0} ${hi ? 'भुगतान' : 'payments'}`],
            [hi ? 'कॉइन' : 'Coins', formatINR(k.coins?.total ?? 0), `${k.coins?.count ?? 0} ${hi ? 'भुगतान' : 'payments'}`],
          ]} />
          <Card title={hi ? 'भुगतान' : 'Payments'} right={<a href="https://dashboard.razorpay.com/app/payment-links" target="_blank" rel="noreferrer" className="inline-flex items-center text-[11px] text-indigo-300 underline"><ExternalLink className="w-3 h-3 mr-1" />Razorpay</a>}>
            <table className="w-full text-left text-xs text-slate-300">
              <THead><Th first>{hi ? 'बिजनेस' : 'Business'}</Th><Th>{hi ? 'क्या' : 'For'}</Th><Th>{hi ? 'रकम' : 'Amount'}</Th><Th>{hi ? 'Razorpay रेफ़' : 'Razorpay ref'}</Th><Th>{hi ? 'कब' : 'When'}</Th><Th right>Status</Th></THead>
              <tbody className="divide-y divide-slate-800">
                {data.data.map((o) => (
                  <tr key={o.id}>
                    <td className="p-3 pl-5 font-semibold text-white">{o.businessName}<span className="block text-[10px] font-mono text-slate-500">{o.id}</span></td>
                    <td className="p-3">{o.kind === 'plan' ? `${o.item.charAt(0).toUpperCase()}${o.item.slice(1)} · ${o.months} mo` : `${o.coins} coins`}</td>
                    <td className="p-3 font-bold">{formatINR(o.amount)}</td>
                    <td className="p-3 font-mono text-[11px]">{o.gatewayRef ?? '—'}</td>
                    <td className="p-3 text-[11px]">{new Date(o.paidAt ?? o.createdAt).toLocaleString('en-IN')}</td>
                    <td className="p-3 pr-5 text-right"><Pill tone={TONE[o.status] ?? 'grey'}>{o.status}</Pill></td>
                  </tr>
                ))}
                {data.data.length === 0 && <EmptyRow cols={6} text="—" />}
              </tbody>
            </table>
            <p className="px-5 py-2 text-[10px] text-slate-500">{hi ? 'रिफंड Razorpay डैशबोर्ड से करें।' : 'Refunds are issued from the Razorpay dashboard.'}</p>
          </Card>
        </>
      )}
    </div>
  );
};
