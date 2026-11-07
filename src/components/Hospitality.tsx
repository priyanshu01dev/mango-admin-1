import React, { useState } from 'react';
import { BedDouble, ChefHat, Receipt, UtensilsCrossed } from 'lucide-react';
import { useBilling } from '../context/BillingContext';
import { formatINR } from '../utils/formatters';
import { clock, daysBetween, label, showDate, todayISO, useSnapshot } from '../lib/snapshot';
import { AppSnapshot, Booking, RunningOrder } from '../types/snapshot';
import { Card, EmptyRow, PageHeader, Pill, ReadOnlyNote, SnapshotGate, Stats, Tabs, Th, THead, Tone } from './ui';

const orderTotal = (o: RunningOrder) => o.lines.reduce((a, l) => a + l.qty * l.rate, 0);
const ORDER_TONE: Record<string, Tone> = { OPEN: 'amber', BILLED: 'blue', POSTED_TO_ROOM: 'blue', CLOSED: 'green', VOID: 'grey', MERGED: 'grey' };
const ROOM_TONE: Record<string, Tone> = { AVAILABLE: 'green', OCCUPIED: 'amber', CLEANING: 'blue', MAINTENANCE: 'grey' };
const BOOKING_TONE: Record<string, Tone> = { RESERVED: 'blue', CHECKED_IN: 'amber', CHECKED_OUT: 'green', CANCELLED: 'grey' };

/** Restaurant (tables, orders, KOTs, sales) and hotel (rooms, bookings, occupancy) for the selected business. */
export const Hospitality: React.FC = () => {
  const { language, activeBusiness } = useBilling();
  const hi = language === 'hi';
  const state = useSnapshot();
  const [tab, setTab] = useState<'restaurant' | 'hotel'>('restaurant');
  return (
    <div className="space-y-6">
      <PageHeader icon={<UtensilsCrossed className="w-5 h-5 text-emerald-400" />} title={hi ? 'होटल व रेस्टोरेंट' : 'Hotel & Restaurant'}
        subtitle={hi ? `${activeBusiness.name} की टेबल, ऑर्डर, KOT, कमरे और बुकिंग` : `${activeBusiness.name} · tables, orders, KOTs, rooms and bookings`}
        right={<Tabs tabs={[['restaurant', hi ? 'रेस्टोरेंट' : 'Restaurant'], ['hotel', hi ? 'होटल' : 'Hotel']]} value={tab} onChange={setTab} />} />
      <SnapshotGate state={state}>{(s) => (tab === 'restaurant' ? <Restaurant s={s} hi={hi} /> : <Hotel s={s} hi={hi} />)}</SnapshotGate>
      <ReadOnlyNote updatedAt={state.updatedAt} />
    </div>
  );
};

const Restaurant: React.FC<{ s: AppSnapshot; hi: boolean }> = ({ s, hi }) => {
  const [day, setDay] = useState(todayISO());
  const tableName = (o: RunningOrder) => s.tables.find((t) => t.id === o.tableId)?.name ?? `${label(o.type)} #${o.number}`;
  const running = s.orders.filter((o) => o.status === 'OPEN' || o.status === 'BILLED');
  const bills = s.docs.filter((d) => d.orderId && d.status !== 'CANCELLED' && d.date === day && (d.type === 'INVOICE' || d.type === 'BILL_OF_SUPPLY'));
  const kots = s.kots.filter((k) => k.date === day).sort((a, b) => b.at - a.at);
  const dayOrders = s.orders.filter((o) => o.date === day);
  const byType = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'].map((t) => [t, bills.filter((b) => s.orders.find((o) => o.id === b.orderId)?.type === t).reduce((a, b) => a + b.amount, 0)] as const);
  const items = new Map<string, { qty: number; value: number }>();
  dayOrders.filter((o) => o.status !== 'VOID').forEach((o) => o.lines.forEach((l) => {
    const k = l.variant ? `${l.name} (${l.variant})` : l.name;
    const cur = items.get(k) ?? { qty: 0, value: 0 }; items.set(k, { qty: cur.qty + l.qty, value: cur.value + l.qty * l.rate });
  }));
  const top = [...items.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 10);
  const occupied = new Set(running.map((o) => o.tableId).filter(Boolean));

  if (s.tables.length === 0 && s.orders.length === 0) return <Card title={hi ? 'रेस्टोरेंट' : 'Restaurant'}><p className="p-6 text-center text-xs text-slate-400">{hi ? 'इस बिजनेस ने रेस्टोरेंट मॉड्यूल शुरू नहीं किया' : 'This business has not set up the restaurant module'}</p></Card>;
  return (
    <>
      <div className="flex justify-end"><input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white" /></div>
      <Stats items={[
        [hi ? 'बिक्री' : 'Sales', formatINR(bills.reduce((a, b) => a + b.amount, 0)), `${bills.length} ${hi ? 'बिल' : 'bills'}`],
        [hi ? 'टेबल भरी' : 'Tables busy', `${occupied.size} / ${s.tables.length}`],
        [hi ? 'चल रहे ऑर्डर' : 'Running orders', running.length, formatINR(running.reduce((a, o) => a + orderTotal(o), 0))],
        ['KOT', kots.filter((k) => !k.cancel).length, `${kots.filter((k) => k.cancel).length} ${hi ? 'रद्द' : 'cancelled'}`],
        [hi ? 'मेन्यू आइटम' : 'Menu items', s.items.filter((i) => i.menuCategory).length],
      ]} />

      <Card title={hi ? 'टेबल' : 'Floor'} icon={<UtensilsCrossed className="w-4 h-4 text-emerald-400" />}>
        <div className="p-4 grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-2">
          {s.tables.map((t) => {
            const o = running.find((x) => x.tableId === t.id);
            return (
              <div key={t.id} className={`rounded-xl p-2.5 border text-xs ${o ? (o.status === 'BILLED' ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-amber-500/15 border-amber-500/30') : 'bg-slate-800/50 border-slate-700'}`}>
                <div className="font-black text-white">{t.name}</div>
                <div className="text-[10px] text-slate-400">{t.area}</div>
                <div className="text-[11px] font-bold mt-1 text-slate-200">{o ? formatINR(orderTotal(o)) : (hi ? 'खाली' : 'Free')}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={hi ? 'ऑर्डर' : 'Orders'} icon={<Receipt className="w-4 h-4 text-emerald-400" />}>
          <table className="w-full text-left text-xs text-slate-300">
            <THead><Th first>{hi ? 'टेबल' : 'Table'}</Th><Th>{hi ? 'समय' : 'Time'}</Th><Th>{hi ? 'आइटम' : 'Items'}</Th><Th>Status</Th><Th right>{hi ? 'रकम' : 'Amount'}</Th></THead>
            <tbody className="divide-y divide-slate-800">
              {[...running, ...dayOrders.filter((o) => !running.includes(o))].sort((a, b) => b.openedAt - a.openedAt).slice(0, 40).map((o) => (
                <tr key={o.id}>
                  <td className="p-3 pl-5 font-semibold text-white">{tableName(o)}{o.customerName ? <span className="block text-[10px] text-slate-500">{o.customerName}</span> : null}</td>
                  <td className="p-3 font-mono text-[11px]">{clock(o.openedAt)}</td>
                  <td className="p-3">{o.lines.length}</td>
                  <td className="p-3"><Pill tone={ORDER_TONE[o.status]}>{label(o.status)}</Pill></td>
                  <td className="p-3 pr-5 text-right font-bold">{formatINR(orderTotal(o))}</td>
                </tr>
              ))}
              {running.length + dayOrders.length === 0 && <EmptyRow cols={5} text={hi ? 'कोई ऑर्डर नहीं' : 'No orders'} />}
            </tbody>
          </table>
        </Card>

        <Card title={hi ? 'किचन टिकट (KOT)' : 'Kitchen tickets (KOT)'} icon={<ChefHat className="w-4 h-4 text-emerald-400" />}>
          <ul className="divide-y divide-slate-800 text-xs max-h-[420px] overflow-y-auto">
            {kots.map((k) => (
              <li key={k.id} className="px-5 py-3">
                <div className="flex justify-between"><span className={`font-bold ${k.cancel ? 'text-rose-300' : 'text-white'}`}>KOT #{k.number} · {k.tableName}</span><span className="text-[10px] text-slate-400">{clock(k.at)}{(k.prints ?? 0) > 1 ? ` · ${k.prints}× printed` : ''}</span></div>
                <div className="text-[11px] text-slate-400">{k.lines.map((l) => `${k.cancel ? -Math.abs(l.qty) : l.qty}× ${l.name}${l.variant ? ` (${l.variant})` : ''}`).join(', ')}</div>
                {k.cancel && k.reason && <div className="text-[10px] text-rose-300/80">{hi ? 'कारण' : 'Reason'}: {k.reason}</div>}
              </li>
            ))}
            {kots.length === 0 && <li className="p-5 text-center text-slate-400">—</li>}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={hi ? 'ऑर्डर टाइप से बिक्री' : 'Sales by order type'}>
          <table className="w-full text-left text-xs text-slate-300"><tbody className="divide-y divide-slate-800">
            {byType.map(([t, v]) => <tr key={t}><td className="p-3 pl-5">{label(t)}</td><td className="p-3 pr-5 text-right font-bold">{formatINR(v)}</td></tr>)}
          </tbody></table>
        </Card>
        <Card title={hi ? 'सबसे ज़्यादा बिके' : 'Top dishes'}>
          <table className="w-full text-left text-xs text-slate-300">
            <THead><Th first>{hi ? 'डिश' : 'Dish'}</Th><Th>{hi ? 'मात्रा' : 'Qty'}</Th><Th right>{hi ? 'रकम' : 'Value'}</Th></THead>
            <tbody className="divide-y divide-slate-800">
              {top.map(([n, v]) => <tr key={n}><td className="p-3 pl-5 text-white">{n}</td><td className="p-3">{v.qty}</td><td className="p-3 pr-5 text-right">{formatINR(v.value)}</td></tr>)}
              {top.length === 0 && <EmptyRow cols={3} text="—" />}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
};

const Hotel: React.FC<{ s: AppSnapshot; hi: boolean }> = ({ s, hi }) => {
  const today = todayISO();
  const room = (b: Booking) => s.rooms.find((r) => r.id === b.roomId);
  const inHouse = s.bookings.filter((b) => b.status === 'CHECKED_IN');
  const arrivals = s.bookings.filter((b) => b.status === 'RESERVED' && b.checkIn === today);
  const departures = inHouse.filter((b) => b.checkOut <= today);
  const live = s.bookings.filter((b) => b.status !== 'CANCELLED').sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1)).slice(0, 50);
  // occupancy over the last 30 days: room-nights sold / available
  const from = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  let sold = 0, revenue = 0;
  s.bookings.filter((b) => b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT').forEach((b) => {
    const n = Math.max(1, daysBetween(b.checkIn, b.checkOut));
    for (let i = 0; i < n; i++) {
      const d = new Date(new Date(b.checkIn + 'T00:00:00').getTime() + i * 86_400_000).toISOString().slice(0, 10);
      if (d >= from && d <= today) { sold++; revenue += b.tariff; }
    }
  });
  const avail = s.rooms.length * 30;

  if (s.rooms.length === 0) return <Card title={hi ? 'होटल' : 'Hotel'}><p className="p-6 text-center text-xs text-slate-400">{hi ? 'इस बिजनेस ने होटल मॉड्यूल शुरू नहीं किया' : 'This business has not set up the hotel module'}</p></Card>;
  return (
    <>
      <Stats items={[
        [hi ? 'कमरे भरे' : 'Occupied', `${s.rooms.filter((r) => r.status === 'OCCUPIED').length} / ${s.rooms.length}`],
        [hi ? 'आज आगमन' : 'Arrivals today', arrivals.length],
        [hi ? 'आज चेक-आउट' : 'Check-outs due', departures.length],
        [hi ? 'ऑक्यूपेंसी (30 दिन)' : 'Occupancy (30 d)', `${avail ? Math.round((sold * 100) / avail) : 0}%`, `${sold} room-nights`],
        ['ADR (30 d)', formatINR(sold ? revenue / sold : 0), hi ? 'औसत किराया/रात' : 'avg rate / night'],
      ]} />
      <Card title={hi ? 'कमरे' : 'Rooms'} icon={<BedDouble className="w-4 h-4 text-emerald-400" />}>
        <div className="p-4 grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-2">
          {[...s.rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map((r) => {
            const g = inHouse.find((b) => b.roomId === r.id);
            return (
              <div key={r.id} className="rounded-xl p-2.5 border border-slate-700 bg-slate-800/50 text-xs">
                <div className="flex justify-between items-center"><span className="font-black text-white">{r.number}</span><Pill tone={ROOM_TONE[r.status]}>{label(r.status)}</Pill></div>
                <div className="text-[10px] text-slate-400 mt-1">{r.type} · {formatINR(r.tariff)}</div>
                {g && <div className="text-[11px] text-amber-200 truncate mt-0.5">{g.guestName}</div>}
              </div>
            );
          })}
        </div>
      </Card>
      <Card title={hi ? 'बुकिंग' : 'Bookings'}>
        <table className="w-full text-left text-xs text-slate-300">
          <THead><Th first>{hi ? 'मेहमान' : 'Guest'}</Th><Th>{hi ? 'कमरा' : 'Room'}</Th><Th>{hi ? 'तारीख' : 'Stay'}</Th><Th>{hi ? 'आईडी' : 'ID proof'}</Th><Th>{hi ? 'एडवांस' : 'Advance'}</Th><Th right>Status</Th></THead>
          <tbody className="divide-y divide-slate-800">
            {live.map((b) => (
              <tr key={b.id}>
                <td className="p-3 pl-5 text-white font-semibold">{b.guestName}<span className="block text-[10px] text-slate-500">{b.adults + b.children} {hi ? 'मेहमान' : 'guests'}{b.phone ? ` · ${b.phone}` : ''}</span></td>
                <td className="p-3">{room(b)?.number} · {room(b)?.type}</td>
                <td className="p-3 text-[11px]">{showDate(b.checkIn)} → {showDate(b.checkOut)}</td>
                <td className="p-3 text-[11px]">{b.idProofNumber ? `${b.idProofType ?? 'ID'} ···${b.idProofNumber.slice(-4)}` : <span className="text-rose-300">{hi ? 'नहीं' : 'Missing'}</span>}</td>
                <td className="p-3">{formatINR(b.advance)}</td>
                <td className="p-3 pr-5 text-right"><Pill tone={BOOKING_TONE[b.status]}>{label(b.status)}</Pill></td>
              </tr>
            ))}
            {live.length === 0 && <EmptyRow cols={6} text={hi ? 'कोई बुकिंग नहीं' : 'No bookings'} />}
          </tbody>
        </table>
      </Card>
    </>
  );
};
