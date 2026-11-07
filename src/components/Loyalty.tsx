import React, { useState } from 'react';
import { Gift, Search } from 'lucide-react';
import { useBilling } from '../context/BillingContext';
import { formatINR } from '../utils/formatters';
import { loyaltyBalance, showDate, stamp, useSnapshot } from '../lib/snapshot';
import { AppSnapshot } from '../types/snapshot';
import { Card, EmptyRow, PageHeader, Pill, ReadOnlyNote, SnapshotGate, Stats, Th, THead } from './ui';

/** Customer IDs and loyalty points of the selected business (points are derived from its invoices, as in the app). */
export const Loyalty: React.FC = () => {
  const { language, activeBusiness } = useBilling();
  const hi = language === 'hi';
  const state = useSnapshot();
  return (
    <div className="space-y-6">
      <PageHeader icon={<Gift className="w-5 h-5 text-emerald-400" />} title={hi ? 'लॉयल्टी व कस्टमर ID' : 'Loyalty & customer IDs'}
        subtitle={hi ? `${activeBusiness.name} के सदस्य, पॉइंट और रिडेम्प्शन` : `${activeBusiness.name} · members, points and redemptions`} />
      <SnapshotGate state={state}>{(s) => <Body s={s} hi={hi} />}</SnapshotGate>
      <ReadOnlyNote updatedAt={state.updatedAt} />
    </div>
  );
};

const Body: React.FC<{ s: AppSnapshot; hi: boolean }> = ({ s, hi }) => {
  const x = s.extras;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const party = (id: string) => s.parties.find((p) => p.id === id);
  const rows = x.loyaltyMembers.map((m) => ({ m, p: party(m.partyId), b: loyaltyBalance(m, x.loyalty, s.docs, x.points) }))
    .filter(({ m, p }) => !q || m.code.toLowerCase().includes(q.toLowerCase()) || p?.name.toLowerCase().includes(q.toLowerCase()) || p?.phone?.includes(q))
    .sort((a, b) => b.b.balance - a.b.balance);
  const all = x.loyaltyMembers.map((m) => loyaltyBalance(m, x.loyalty, s.docs, x.points));
  const out = all.reduce((a, b) => a + b.balance, 0);
  const customers = s.parties.filter((p) => p.type === 'CUSTOMER').length;
  return (
    <>
      <Stats items={[
        [hi ? 'प्रोग्राम' : 'Programme', x.loyalty.enabled ? (hi ? 'चालू' : 'On') : (hi ? 'बंद' : 'Off'),
          `${x.loyalty.pointsPer100} pt / ₹100 · 1 pt = ${formatINR(x.loyalty.rupeesPerPoint)}`],
        [hi ? 'सदस्य' : 'Members', x.loyaltyMembers.length, customers ? `${Math.round((x.loyaltyMembers.length * 100) / customers)}% ${hi ? 'ग्राहक' : 'of customers'}` : undefined],
        [hi ? 'बकाया पॉइंट' : 'Points outstanding', out.toLocaleString('en-IN'), `${hi ? 'देनदारी' : 'liability'} ${formatINR(out * x.loyalty.rupeesPerPoint)}`],
        [hi ? 'रिडीम हुए' : 'Redeemed', all.reduce((a, b) => a + b.redeemed, 0).toLocaleString('en-IN')],
        [hi ? 'सदस्यों की बिक्री' : 'Member sales', formatINR(all.reduce((a, b) => a + b.spend, 0))],
      ]} />
      <Card title={hi ? 'सदस्य' : 'Members'} right={
        <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2"><Search className="w-3.5 h-3.5 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={hi ? 'नाम, फ़ोन या ID' : 'Name, phone or ID'} className="bg-transparent px-2 py-1 text-xs text-white outline-none w-44" /></div>}>
        <table className="w-full text-left text-xs text-slate-300">
          <THead><Th first>{hi ? 'कस्टमर ID' : 'Customer ID'}</Th><Th>{hi ? 'नाम' : 'Name'}</Th><Th>{hi ? 'सदस्य बने' : 'Joined'}</Th><Th>{hi ? 'ख़रीद' : 'Spend'}</Th><Th>{hi ? 'कमाए / रिडीम' : 'Earned / redeemed'}</Th><Th right>{hi ? 'बैलेंस' : 'Balance'}</Th></THead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(({ m, p, b }) => (
              <React.Fragment key={m.partyId}>
                <tr className="cursor-pointer hover:bg-slate-800/40" onClick={() => setOpen(open === m.partyId ? null : m.partyId)}>
                  <td className="p-3 pl-5 font-mono font-bold text-emerald-300">{m.code}</td>
                  <td className="p-3"><div className="text-white font-semibold">{p?.name ?? '—'}</div><div className="text-[10px] text-slate-500">{[p?.phone, p?.email].filter(Boolean).join(' · ')}</div></td>
                  <td className="p-3 text-[11px]">{showDate(m.joinedOn)}</td>
                  <td className="p-3">{formatINR(b.spend)}</td>
                  <td className="p-3">{b.earned + b.adjusted} / {b.redeemed}</td>
                  <td className="p-3 pr-5 text-right"><span className="font-black text-white">{b.balance}</span><span className="block text-[10px] text-slate-500">{formatINR(b.balance * x.loyalty.rupeesPerPoint)}</span></td>
                </tr>
                {open === m.partyId && (
                  <tr><td colSpan={6} className="px-5 pb-3 bg-slate-950/40">
                    <ul className="pt-2 space-y-1 text-[11px]">
                      {x.points.filter((e) => e.partyId === m.partyId).sort((a, c) => c.at - a.at).map((e) => (
                        <li key={e.id} className="flex justify-between"><span>{e.reason} <span className="text-slate-500">· {stamp(e.at)}</span></span>
                          <span className={e.points > 0 ? 'text-emerald-400' : 'text-rose-300'}>{e.points > 0 ? '+' : ''}{e.points}</span></li>
                      ))}
                      {!x.points.some((e) => e.partyId === m.partyId) && <li className="text-slate-500">{hi ? 'कोई रिडेम्प्शन नहीं' : 'No redemptions or adjustments'}</li>}
                    </ul>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
            {rows.length === 0 && <EmptyRow cols={6} text={hi ? 'कोई सदस्य नहीं' : 'No members'} />}
          </tbody>
        </table>
      </Card>
      {!x.loyalty.enabled && x.loyaltyMembers.length > 0 && <p className="text-xs"><Pill tone="amber">{hi ? 'प्रोग्राम बंद है — पॉइंट नहीं बढ़ रहे' : 'Programme is off'}</Pill></p>}
    </>
  );
};
