import React, { useState } from 'react';
import { Bike, Plug, ShoppingBag } from 'lucide-react';
import { useBilling } from '../context/BillingContext';
import { formatINR } from '../utils/formatters';
import { label, msToISO, PLATFORM_LABEL, stamp, todayISO, useSnapshot } from '../lib/snapshot';
import { AppSnapshot, DeliveryOrder } from '../types/snapshot';
import { Card, EmptyRow, PageHeader, Pill, ReadOnlyNote, SnapshotGate, Stats, Tabs, Th, THead, Tone } from './ui';

const STATUS_TONE: Record<string, Tone> = { NEW: 'amber', ACCEPTED: 'blue', PREPARING: 'blue', READY: 'blue', PICKED_UP: 'blue', DELIVERED: 'green', CANCELLED: 'grey', REJECTED: 'grey' };
const FOOD = ['ZOMATO', 'SWIGGY', 'ONDC'] as const;
const commission = (o: DeliveryOrder) => (o.amount * o.commissionPct) / 100;

/** Zomato / Swiggy / ONDC orders and Uber / Ola / Rapido rides of the selected business. */
export const Delivery: React.FC = () => {
  const { language, activeBusiness } = useBilling();
  const hi = language === 'hi';
  const state = useSnapshot();
  const [tab, setTab] = useState<'orders' | 'rides'>('orders');
  return (
    <div className="space-y-6">
      <PageHeader icon={<ShoppingBag className="w-5 h-5 text-emerald-400" />} title={hi ? 'ऑनलाइन ऑर्डर व राइड' : 'Online orders & rides'}
        subtitle={hi ? `${activeBusiness.name}: Zomato, Swiggy, ONDC ऑर्डर और Uber, Ola, Rapido राइड` : `${activeBusiness.name}: Zomato, Swiggy, ONDC orders and Uber, Ola, Rapido rides`}
        right={<Tabs tabs={[['orders', hi ? 'फ़ूड ऑर्डर' : 'Food orders'], ['rides', hi ? 'राइड / पार्सल' : 'Rides & parcels']]} value={tab} onChange={setTab} />} />
      <SnapshotGate state={state}>{(s) => (tab === 'orders' ? <Orders s={s} hi={hi} /> : <Rides s={s} hi={hi} />)}</SnapshotGate>
      <ReadOnlyNote updatedAt={state.updatedAt} />
    </div>
  );
};

const Orders: React.FC<{ s: AppSnapshot; hi: boolean }> = ({ s, hi }) => {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const orders = s.extras.deliveryOrders;
  const inMonth = orders.filter((o) => msToISO(o.at).startsWith(month) && o.status !== 'CANCELLED' && o.status !== 'REJECTED');
  const due = orders.filter((o) => o.status === 'DELIVERED' && !o.settled);
  return (
    <>
      <div className="flex justify-end"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white" /></div>
      <Stats items={[
        [hi ? 'ऑर्डर' : 'Orders', inMonth.length],
        [hi ? 'ऑर्डर वैल्यू' : 'Order value', formatINR(inMonth.reduce((a, o) => a + o.amount, 0))],
        [hi ? 'कमीशन' : 'Commission', formatINR(inMonth.reduce((a, o) => a + commission(o), 0))],
        [hi ? 'पेआउट बाकी' : 'Payout due', formatINR(due.reduce((a, o) => a + o.amount - commission(o), 0)), `${due.length} ${hi ? 'ऑर्डर' : 'orders'}`],
      ]} />
      <Card title={hi ? 'इंटीग्रेशन' : 'Integrations'} icon={<Plug className="w-4 h-4 text-emerald-400" />}>
        <table className="w-full text-left text-xs text-slate-300">
          <THead><Th first>{hi ? 'प्लेटफ़ॉर्म' : 'Platform'}</Th><Th>{hi ? 'आउटलेट ID' : 'Outlet ID'}</Th><Th>API key</Th><Th>{hi ? 'कमीशन' : 'Commission'}</Th><Th>{hi ? 'ऑटो' : 'Auto'}</Th><Th>{hi ? 'इस महीने' : 'This month'}</Th><Th right>Status</Th></THead>
          <tbody className="divide-y divide-slate-800">
            {FOOD.map((p) => {
              const i = s.extras.integrations.find((x) => x.platform === p);
              const mine = inMonth.filter((o) => o.platform === p);
              return (
                <tr key={p}>
                  <td className="p-3 pl-5 font-bold text-white">{PLATFORM_LABEL[p]}</td>
                  <td className="p-3 font-mono text-[11px]">{i?.outletId || '—'}</td>
                  <td className="p-3 font-mono text-[11px]">{i?.apiKey ? `••••${i.apiKey.slice(-4)}` : '—'}</td>
                  <td className="p-3">{i ? `${i.commissionPct}%` : '—'}</td>
                  <td className="p-3 text-[11px]">{i ? [i.autoAccept && (hi ? 'स्वीकार' : 'accept'), i.autoKot && 'KOT'].filter(Boolean).join(' + ') || '—' : '—'}</td>
                  <td className="p-3">{mine.length} · {formatINR(mine.reduce((a, o) => a + o.amount, 0))}</td>
                  <td className="p-3 pr-5 text-right"><Pill tone={i?.connected ? 'green' : 'grey'}>{i?.connected ? (hi ? 'जुड़ा' : 'Connected') : (hi ? 'नहीं' : 'Off')}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-5 py-2 text-[10px] text-slate-500">{hi ? 'API key छिपाई गई है।' : 'API keys are masked.'}</p>
      </Card>
      <Card title={hi ? 'ऑर्डर' : 'Orders'}>
        <table className="w-full text-left text-xs text-slate-300">
          <THead><Th first>{hi ? 'ऑर्डर' : 'Order'}</Th><Th>{hi ? 'ग्राहक' : 'Customer'}</Th><Th>{hi ? 'आइटम' : 'Items'}</Th><Th>{hi ? 'रकम' : 'Amount'}</Th><Th>{hi ? 'कमीशन' : 'Commission'}</Th><Th>Status</Th><Th right>{hi ? 'पेआउट' : 'Payout'}</Th></THead>
          <tbody className="divide-y divide-slate-800">
            {orders.filter((o) => msToISO(o.at).startsWith(month)).sort((a, b) => b.at - a.at).map((o) => (
              <tr key={o.id}>
                <td className="p-3 pl-5"><div className="font-bold text-white">{PLATFORM_LABEL[o.platform]} #{o.externalId || '—'}</div><div className="text-[10px] text-slate-500">{stamp(o.at)}</div></td>
                <td className="p-3">{o.customerName || '—'}</td>
                <td className="p-3 text-[11px] max-w-xs">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}</td>
                <td className="p-3">{formatINR(o.amount)}</td>
                <td className="p-3">{formatINR(commission(o))} <span className="text-slate-500">({o.commissionPct}%)</span></td>
                <td className="p-3"><Pill tone={STATUS_TONE[o.status]}>{label(o.status)}</Pill></td>
                <td className="p-3 pr-5 text-right">{o.settled ? <Pill tone="green">{hi ? 'मिला' : 'Received'}</Pill> : o.status === 'DELIVERED' ? <Pill tone="amber">{formatINR(o.amount - commission(o))}</Pill> : '—'}</td>
              </tr>
            ))}
            {orders.filter((o) => msToISO(o.at).startsWith(month)).length === 0 && <EmptyRow cols={7} text={hi ? 'इस महीने कोई ऑर्डर नहीं' : 'No orders this month'} />}
          </tbody>
        </table>
      </Card>
    </>
  );
};

const Rides: React.FC<{ s: AppSnapshot; hi: boolean }> = ({ s, hi }) => {
  const rides = s.extras.rides;
  const month = todayISO().slice(0, 7);
  const thisMonth = rides.filter((r) => msToISO(r.at).startsWith(month));
  return (
    <>
      <Stats items={(['UBER', 'OLA', 'RAPIDO'] as const).map((p) => {
        const list = thisMonth.filter((r) => r.platform === p);
        return [PLATFORM_LABEL[p], formatINR(list.reduce((a, r) => a + r.fare, 0)), `${list.length} ${hi ? 'ट्रिप इस महीने' : 'trips this month'}`] as [string, string, string];
      })} />
      <Card title={hi ? 'राइड व पार्सल' : 'Rides & parcels'} icon={<Bike className="w-4 h-4 text-emerald-400" />}>
        <table className="w-full text-left text-xs text-slate-300">
          <THead><Th first>{hi ? 'समय' : 'When'}</Th><Th>{hi ? 'ऐप' : 'App'}</Th><Th>{hi ? 'किसलिए' : 'Purpose'}</Th><Th>{hi ? 'कहाँ से → कहाँ' : 'From → to'}</Th><Th right>{hi ? 'किराया' : 'Fare'}</Th></THead>
          <tbody className="divide-y divide-slate-800">
            {rides.map((r) => (
              <tr key={r.id}><td className="p-3 pl-5 text-[11px]">{stamp(r.at)}</td><td className="p-3 font-bold text-white">{PLATFORM_LABEL[r.platform]}</td><td className="p-3">{label(r.purpose)}</td>
                <td className="p-3 text-[11px]">{[r.from, r.to].filter(Boolean).join(' → ') || '—'}</td><td className="p-3 pr-5 text-right font-bold">{formatINR(r.fare)}</td></tr>
            ))}
            {rides.length === 0 && <EmptyRow cols={5} text="—" />}
          </tbody>
        </table>
        <p className="px-5 py-2 text-[10px] text-slate-500">{hi ? 'हर राइड ऐप में "Travel & delivery" ख़र्च के रूप में दर्ज होती है।' : 'Each ride is recorded as a "Travel & delivery" expense in the app.'}</p>
      </Card>
    </>
  );
};
