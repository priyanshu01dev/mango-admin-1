import React, { useState } from 'react';
import { Camera, MapPin, Navigation, Smartphone, Wallet } from 'lucide-react';
import { useBilling } from '../context/BillingContext';
import { formatINR } from '../utils/formatters';
import {
  clock, distanceM, grossSalary, hm, label, mapsUrl, monthOf, monthSummary, msToISO, routeUrl, stamp, todayISO, useSnapshot, workedMinutes,
} from '../lib/snapshot';
import { AppSnapshot } from '../types/snapshot';
import { Card, EmptyRow, Pill, ReadOnlyNote, SnapshotGate, Stats, Th, THead, Tone } from './ui';

const STATUS_TONE: Record<string, Tone> = { PRESENT: 'green', HALF_DAY: 'amber', PAID_LEAVE: 'blue', ABSENT: 'red' };

/**
 * Staff as the owner manages them in the app (PIN logins on the shop phone): permissions, selfie + GPS
 * check-ins, salary, store visits with photos and the field-staff route. Shown under Staff & Attendance.
 */
export const AppStaff: React.FC<{ month: string }> = ({ month }) => {
  const { language } = useBilling();
  const hi = language === 'hi';
  const state = useSnapshot();
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 pt-2">
        <Smartphone className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-black text-white">{hi ? 'ऐप में स्टाफ (PIN लॉगिन)' : 'Staff in the app (PIN logins)'}</h2>
      </div>
      <SnapshotGate state={state}>{(s) => <Body s={s} month={month} hi={hi} />}</SnapshotGate>
      <ReadOnlyNote updatedAt={state.updatedAt} />
    </div>
  );
};

const Body: React.FC<{ s: AppSnapshot; month: string; hi: boolean }> = ({ s, month, hi }) => {
  const x = s.extras;
  const today = todayISO();
  const [day, setDay] = useState(today);
  const [trackId, setTrackId] = useState(x.staff.find((m) => m.trackLocation)?.id ?? x.staff[0]?.id ?? '');
  const name = (id: string) => x.staff.find((m) => m.id === id)?.name ?? (id === 'owner' ? 'Owner' : id);
  const dayEntries = x.attendance.filter((e) => e.date === day);
  const paid = new Map(x.salaries.filter((p) => p.month === month).map((p) => [p.staffId, p]));
  const pings = x.pings.filter((p) => p.staffId === trackId && msToISO(p.at) === day).sort((a, b) => a.at - b.at);
  const km = pings.reduce((a, p, i) => (i ? a + distanceM(pings[i - 1].lat, pings[i - 1].lng, p.lat, p.lng) : 0), 0) / 1000;
  const route = routeUrl(pings);
  const active = x.staff.filter((m) => m.active);
  const geo = x.staffSettings;

  if (x.staff.length === 0) return <Card title={hi ? 'स्टाफ' : 'Staff'}><p className="p-6 text-center text-xs text-slate-400">{hi ? 'मालिक ने ऐप में अभी स्टाफ नहीं जोड़ा' : 'The owner has not added staff in the app yet'}</p></Card>;
  return (
    <>
      <Stats items={[
        [hi ? 'स्टाफ' : 'Staff', active.length],
        [hi ? 'आज मौजूद' : 'Present today', x.attendance.filter((e) => e.date === today && (e.status === 'PRESENT' || e.status === 'HALF_DAY')).length],
        [hi ? 'अभी ड्यूटी पर' : 'On duty now', x.attendance.filter((e) => e.date === today && e.checkIn && !e.checkOut).length],
        [hi ? 'जियोफेंस' : 'Geofence', geo.geofenceLat != null ? `${geo.geofenceRadiusM} m` : (hi ? 'बंद' : 'Off'), geo.requireSelfie ? (hi ? 'सेल्फी ज़रूरी' : 'selfie required') : undefined],
        [hi ? 'ओनर PIN' : 'Owner PIN', geo.ownerPinHash ? (hi ? 'सेट' : 'Set') : (hi ? 'नहीं' : 'Not set'), x.activeStaffId ? `${hi ? 'फ़ोन पर' : 'phone in use by'} ${name(x.activeStaffId)}` : undefined],
      ]} />

      <Card title={hi ? 'स्टाफ, अनुमतियाँ और सैलरी' : 'Staff, permissions & salary'}>
        <table className="w-full text-left text-xs text-slate-300">
          <THead><Th first>{hi ? 'नाम' : 'Name'}</Th><Th>{hi ? 'स्क्रीन' : 'Screens'}</Th><Th>{hi ? 'सैलरी' : 'Salary'}</Th><Th>{hi ? 'आख़िरी लॉगिन' : 'Last login'}</Th><Th right>Status</Th></THead>
          <tbody className="divide-y divide-slate-800">
            {x.staff.map((m) => (
              <tr key={m.id} className={m.active ? '' : 'opacity-60'}>
                <td className="p-3 pl-5"><div className="font-bold text-white">{m.name}</div><div className="text-[10px] text-slate-400">{m.role}{m.phone ? ` · +91 ${m.phone}` : ''}</div></td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{m.permissions.map((p) => <span key={p} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">{p.toLowerCase()}</span>)}
                  {m.trackLocation && <Pill tone="blue">GPS</Pill>}</div></td>
                <td className="p-3">{formatINR(m.salary)}{m.salaryType === 'DAILY' ? '/day' : '/mo'}</td>
                <td className="p-3 text-[11px] text-slate-400">{m.lastLoginAt ? stamp(m.lastLoginAt) : '—'}</td>
                <td className="p-3 pr-5 text-right"><Pill tone={m.active ? 'green' : 'grey'}>{m.active ? 'Active' : 'Inactive'}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={hi ? 'हाज़िरी (सेल्फी + GPS)' : 'Attendance (selfie + GPS)'} icon={<Camera className="w-4 h-4 text-emerald-400" />}
        right={<input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white" />}>
        <table className="w-full text-left text-xs text-slate-300">
          <THead><Th first>{hi ? 'नाम' : 'Name'}</Th><Th>In</Th><Th>Out</Th><Th>{hi ? 'काम' : 'Worked'}</Th><Th>{hi ? 'सेल्फी' : 'Selfie'}</Th><Th right>Status</Th></THead>
          <tbody className="divide-y divide-slate-800">
            {active.map((m) => {
              const e = dayEntries.find((d) => d.staffId === m.id);
              return (
                <tr key={m.id}>
                  <td className="p-3 pl-5 text-white font-semibold">{m.name}</td>
                  <td className="p-3 font-mono text-[11px]">{clock(e?.checkIn?.at)}
                    {e?.checkIn?.distanceM != null && <span className="text-slate-500"> · {e.checkIn.distanceM} m</span>}
                    {e?.checkIn?.lat != null && <a className="ml-1 text-indigo-300 underline" href={mapsUrl(e.checkIn.lat, e.checkIn.lng ?? 0)} target="_blank" rel="noreferrer">map</a>}</td>
                  <td className="p-3 font-mono text-[11px]">{clock(e?.checkOut?.at)}</td>
                  <td className="p-3">{e ? hm(workedMinutes(e)) : '—'}</td>
                  <td className="p-3">{e?.checkIn ? (e.checkIn.selfie ? <Pill tone="green">{hi ? 'ली गई' : 'Taken'}</Pill> : <Pill>{hi ? 'नहीं' : 'None'}</Pill>) : '—'}</td>
                  <td className="p-3 pr-5 text-right">{e ? <Pill tone={STATUS_TONE[e.status]}>{label(e.status)}</Pill> : <Pill>{hi ? 'मार्क नहीं' : 'Not marked'}</Pill>}
                    {e?.corrected && <span className="block text-[9px] text-slate-500 mt-0.5">{hi ? 'मालिक ने मार्क किया' : 'marked by owner'}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-5 py-2 text-[10px] text-slate-500">{hi ? 'सेल्फी फ़ोटो फ़ोन पर रहती हैं; यहाँ सिर्फ़ जानकारी सिंक होती है।' : 'Selfie photos stay on the phone; only the record syncs here.'}</p>
      </Card>

      <Card title={`${hi ? 'सैलरी' : 'Payroll'} · ${month}`} icon={<Wallet className="w-4 h-4 text-emerald-400" />}>
        <table className="w-full text-left text-xs text-slate-300">
          <THead><Th first>{hi ? 'नाम' : 'Name'}</Th><Th>P / ½ / L / A / —</Th><Th>{hi ? 'देय दिन' : 'Payable days'}</Th><Th>{hi ? 'ग्रॉस' : 'Gross'}</Th><Th right>{hi ? 'भुगतान' : 'Paid'}</Th></THead>
          <tbody className="divide-y divide-slate-800">
            {x.staff.filter((m) => m.active || paid.has(m.id)).map((m) => {
              const sum = monthSummary(m, month, x.attendance, today);
              const p = paid.get(m.id);
              return (
                <tr key={m.id}>
                  <td className="p-3 pl-5 text-white font-semibold">{m.name}</td>
                  <td className="p-3 font-mono text-[11px]"><span className="text-emerald-400">{sum.present}</span> / <span className="text-amber-300">{sum.halfDay}</span> / <span className="text-indigo-300">{sum.paidLeave}</span> / <span className="text-rose-300">{sum.absent}</span> / <span className="text-slate-500">{sum.notMarked}</span></td>
                  <td className="p-3">{sum.payableDays}</td>
                  <td className="p-3">{formatINR(grossSalary(m, month, sum))}</td>
                  <td className="p-3 pr-5 text-right">{p ? <><span className="font-bold text-emerald-400">{formatINR(p.net)}</span><span className="block text-[10px] text-slate-500">{label(p.mode)} · {stamp(p.paidAt)}</span></> : <Pill tone="amber">{hi ? 'बाकी' : 'Due'}</Pill>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={hi ? 'स्टोर विज़िट (फ़ोटो सहित)' : 'Store visits (with photos)'} icon={<MapPin className="w-4 h-4 text-emerald-400" />}>
          <ul className="divide-y divide-slate-800 text-xs max-h-[420px] overflow-y-auto">
            {x.visits.filter((v) => monthOf(msToISO(v.at)) === month).map((v) => (
              <li key={v.id} className="px-5 py-3">
                <div className="flex justify-between gap-2"><span className="font-semibold text-white">{v.storeName}</span><span className="text-[10px] text-slate-400 whitespace-nowrap">{stamp(v.at)}</span></div>
                <div className="text-[11px] text-slate-400">{name(v.staffId)} · {v.photos.length} {hi ? 'फ़ोटो' : 'photo(s)'}{v.orderValue > 0 ? ` · ${hi ? 'ऑर्डर' : 'order'} ${formatINR(v.orderValue)}` : ''}
                  {v.lat != null && <> · <a className="text-indigo-300 underline" href={mapsUrl(v.lat, v.lng ?? 0)} target="_blank" rel="noreferrer">{hi ? 'नक्शा' : 'map'}</a></>}</div>
                {v.notes && <div className="text-[11px] text-slate-300 mt-0.5">{v.notes}</div>}
              </li>
            ))}
            {x.visits.filter((v) => monthOf(msToISO(v.at)) === month).length === 0 && <li className="p-5 text-center text-slate-400">—</li>}
          </ul>
        </Card>

        <Card title={hi ? 'स्टाफ ट्रैकिंग' : 'Staff tracking'} icon={<Navigation className="w-4 h-4 text-emerald-400" />}
          right={<select value={trackId} onChange={(e) => setTrackId(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white">
            {x.staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}>
          <div className="p-5 space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div><p className="text-[10px] text-slate-400 uppercase font-bold">{hi ? 'दिन' : 'Day'}</p><p className="text-white font-bold">{day}</p></div>
              <div><p className="text-[10px] text-slate-400 uppercase font-bold">{hi ? 'दूरी' : 'Distance'}</p><p className="text-white font-bold">{km.toFixed(1)} km</p></div>
              <div><p className="text-[10px] text-slate-400 uppercase font-bold">{hi ? 'लोकेशन पॉइंट' : 'Points'}</p><p className="text-white font-bold">{pings.length}</p></div>
            </div>
            {route ? <a href={route} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold"><Navigation className="w-3.5 h-3.5 mr-1.5" />{hi ? 'Google Maps पर रूट देखें' : 'Open route in Google Maps'}</a>
              : <p className="text-slate-400">{hi ? 'इस दिन कोई लोकेशन नहीं' : 'No location points for this day'}</p>}
            <ul className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
              {pings.slice(-30).reverse().map((p) => (
                <li key={p.at} className="py-1.5 flex justify-between font-mono text-[11px]"><span>{clock(p.at)}</span>
                  <a className="text-indigo-300 underline" href={mapsUrl(p.lat, p.lng)} target="_blank" rel="noreferrer">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</a></li>
              ))}
            </ul>
            {!x.staff.find((m) => m.id === trackId)?.trackLocation && <p className="text-[10px] text-slate-500">{hi ? 'इस स्टाफ के लिए लगातार ट्रैकिंग बंद है — सिर्फ़ चेक-इन/विज़िट की लोकेशन।' : 'Continuous tracking is off for this staff member — only check-in / visit locations.'}</p>}
          </div>
        </Card>
      </div>
      <Card title={hi ? 'सैलरी भुगतान इतिहास' : 'Salary payment history'}>
        <table className="w-full text-left text-xs text-slate-300">
          <THead><Th first>{hi ? 'नाम' : 'Name'}</Th><Th>{hi ? 'महीना' : 'Month'}</Th><Th>{hi ? 'दिन' : 'Days'}</Th><Th>{hi ? 'ग्रॉस' : 'Gross'}</Th><Th>{hi ? 'बोनस / कटौती / एडवांस' : 'Bonus / deductions / advance'}</Th><Th right>{hi ? 'नेट' : 'Net'}</Th></THead>
          <tbody className="divide-y divide-slate-800">
            {x.salaries.slice(0, 30).map((p) => (
              <tr key={p.id}><td className="p-3 pl-5 text-white">{name(p.staffId)}</td><td className="p-3">{p.month}</td><td className="p-3">{p.payableDays}</td><td className="p-3">{formatINR(p.gross)}</td>
                <td className="p-3 text-[11px]">{formatINR(p.bonus)} / {formatINR(p.deductions)} / {formatINR(p.advance)}</td><td className="p-3 pr-5 text-right font-bold text-emerald-400">{formatINR(p.net)}</td></tr>
            ))}
            {x.salaries.length === 0 && <EmptyRow cols={6} text="—" />}
          </tbody>
        </table>
      </Card>
    </>
  );
};
