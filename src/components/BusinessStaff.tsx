import React, { useEffect, useState } from 'react';
import { CalendarCheck, Loader2, MapPin, Users } from 'lucide-react';
import { useBilling } from '../context/BillingContext';
import { api } from '../lib/api';
import { formatINR, TRANSLATIONS } from '../utils/formatters';
import { AppStaff } from './AppStaff';

/** Shape of GET /api/admin/businesses/:id/staff (see backend/src/modules/admin/staff.ts). */
interface Member { id: string; phone: string; name: string; userId: string | null; permissions: Record<string, 'view' | 'edit'>; status: 'active' | 'inactive'; joinedAt: string | null; createdAt: string }
interface Punch { at: string; distanceM: number | null }
interface DayRow { member: { id: string; name: string; phone: string }; status: string; entry: { checkIn: Punch | null; checkOut: Punch | null; workedMinutes: number | null; corrected: boolean } | null }
interface MonthRow { member: { id: string; name: string; phone: string }; present: number; halfDay: number; absent: number; paidLeave: number; notMarked: number; workedHours: number }
interface StaffView {
  members: Member[];
  settings: { geofence: { lat: number; lng: number; radiusM: number } | null; requireSelfie: boolean };
  day: { date: string; counts: Record<string, number>; members: DayRow[] };
  month: { month: string; members: MonthRow[] };
  recentVisits: { id: string; memberId: string; storeName: string; notes: string; visitedAt: string }[];
  recentPayroll: { memberId: string; month: string; net: number; mode: string; paidAt: string }[];
}

const STATUS_STYLE: Record<string, string> = {
  present: 'bg-emerald-500/15 text-emerald-400', half_day: 'bg-amber-500/15 text-amber-300', paid_leave: 'bg-indigo-500/15 text-indigo-300',
  absent: 'bg-rose-500/15 text-rose-300', not_marked: 'bg-slate-800 text-slate-400',
};
const time = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

/** Read-only: the selected business's app staff, their permissions, attendance and field visits. */
export const BusinessStaff: React.FC = () => {
  const { language, activeBusiness } = useBilling();
  const hi = language === 'hi';
  const [data, setData] = useState<StaffView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!activeBusiness.id) return;
    setError(null);
    api<StaffView>(`/businesses/${activeBusiness.id}/staff`, { query: { month } }).then(setData).catch((e) => setError(e.message));
  }, [activeBusiness.id, month]);

  const name = (id: string) => data?.members.find((m) => m.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <CalendarCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-black text-white">{TRANSLATIONS[language].staffAttendance}</h2>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {hi ? `${activeBusiness.name} का स्टाफ, ऐप अनुमतियाँ, हाज़िरी और फील्ड विज़िट। सिर्फ़ देखने के लिए — मालिक ऐप में बदलते हैं।`
              : `${activeBusiness.name}'s app staff, their permissions, attendance and field visits. Read-only: owners manage this in the app.`}
          </p>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl p-3">{error}</div>}
      {!data && !error && <div className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin inline text-slate-500" /></div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              [hi ? 'स्टाफ' : 'Staff', data.members.filter((m) => m.status === 'active').length],
              [hi ? 'आज मौजूद' : 'Present today', data.day.counts.present + data.day.counts.halfDay],
              [hi ? 'अभी चेक-इन' : 'Checked in now', data.day.counts.checkedInNow],
              [hi ? 'मार्क नहीं' : 'Not marked', data.day.counts.notMarked],
              [hi ? 'जियोफेंस' : 'Geofence', data.settings.geofence ? `${data.settings.geofence.radiusM} m` : (hi ? 'बंद' : 'Off')],
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</p>
                <p className="text-xl font-black text-white mt-1">{value}</p>
              </div>
            ))}
          </div>

          <Card title={hi ? 'स्टाफ और ऐप अनुमतियाँ' : 'Staff & app permissions'} icon={<Users className="w-4 h-4 text-emerald-400" />}>
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]">
                <tr><th className="p-3.5 pl-5">{hi ? 'नाम' : 'Name'}</th><th className="p-3.5">{hi ? 'स्क्रीन' : 'Screens'}</th><th className="p-3.5">{hi ? 'जुड़े' : 'Joined'}</th><th className="p-3.5 text-center">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.members.map((m) => (
                  <tr key={m.id} className={m.status === 'active' ? '' : 'opacity-60'}>
                    <td className="p-3.5 pl-5"><div className="font-bold text-white">{m.name}</div><div className="text-[10px] text-slate-400">+91 {m.phone}</div></td>
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(m.permissions).map(([k, v]) => (
                          <span key={k} className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${v === 'edit' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>{k}:{v}</span>
                        ))}
                        {Object.keys(m.permissions).length === 0 && <span className="text-[10px] text-slate-500">{hi ? 'कोई स्क्रीन नहीं' : 'No screens'}</span>}
                      </div>
                    </td>
                    <td className="p-3.5 text-[11px] text-slate-400">{m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-IN') : (hi ? 'अभी लॉगिन नहीं किया' : 'Not signed in yet')}</td>
                    <td className={`p-3.5 text-center font-bold ${m.status === 'active' ? 'text-emerald-400' : 'text-slate-500'}`}>{m.status === 'active' ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))}
                {data.members.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">{hi ? 'इस बिजनेस ने अभी स्टाफ नहीं जोड़ा' : 'This business has not added staff yet'}</td></tr>}
              </tbody>
            </table>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title={`${hi ? 'आज की हाज़िरी' : 'Today'} · ${data.day.date}`}>
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]"><tr><th className="p-3 pl-5">{hi ? 'नाम' : 'Name'}</th><th className="p-3">In</th><th className="p-3">Out</th><th className="p-3 pr-5 text-right">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {data.day.members.map((r) => (
                    <tr key={r.member.id}>
                      <td className="p-3 pl-5 text-white font-semibold">{r.member.name}</td>
                      <td className="p-3 font-mono text-[11px]">{time(r.entry?.checkIn?.at)}{r.entry?.checkIn?.distanceM != null && <span className="text-slate-500"> · {r.entry.checkIn.distanceM} m</span>}</td>
                      <td className="p-3 font-mono text-[11px]">{time(r.entry?.checkOut?.at)}</td>
                      <td className="p-3 pr-5 text-right"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[r.status] ?? ''}`}>{r.status.replace('_', ' ')}</span>{r.entry?.corrected && <span className="block text-[9px] text-slate-500 mt-0.5">{hi ? 'सुधारा गया' : 'corrected'}</span>}</td>
                    </tr>
                  ))}
                  {data.day.members.length === 0 && <tr><td colSpan={4} className="p-5 text-center text-slate-400">—</td></tr>}
                </tbody>
              </table>
            </Card>

            <Card title={`${hi ? 'महीने का सार' : 'Month summary'} · ${data.month.month}`}>
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]"><tr><th className="p-3 pl-5">{hi ? 'नाम' : 'Name'}</th><th className="p-3 text-center">P</th><th className="p-3 text-center">½</th><th className="p-3 text-center">L</th><th className="p-3 text-center">A</th><th className="p-3 text-center">—</th><th className="p-3 pr-5 text-right">{hi ? 'घंटे' : 'Hours'}</th></tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {data.month.members.map((r) => (
                    <tr key={r.member.id}>
                      <td className="p-3 pl-5 text-white font-semibold">{r.member.name}</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">{r.present}</td>
                      <td className="p-3 text-center text-amber-300">{r.halfDay}</td>
                      <td className="p-3 text-center text-indigo-300">{r.paidLeave}</td>
                      <td className="p-3 text-center text-rose-300">{r.absent}</td>
                      <td className="p-3 text-center text-slate-500">{r.notMarked}</td>
                      <td className="p-3 pr-5 text-right font-mono">{r.workedHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-5 py-2 text-[10px] text-slate-500">P present · ½ half day · L paid leave · A absent · — not marked (incl. weekly offs)</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title={hi ? 'हाल की फील्ड विज़िट' : 'Recent field visits'} icon={<MapPin className="w-4 h-4 text-emerald-400" />}>
              <ul className="divide-y divide-slate-800 text-xs">
                {data.recentVisits.map((v) => (
                  <li key={v.id} className="px-5 py-3">
                    <div className="flex justify-between"><span className="font-semibold text-white">{v.storeName}</span><span className="text-[10px] text-slate-400">{new Date(v.visitedAt).toLocaleString('en-IN')}</span></div>
                    <div className="text-[11px] text-slate-400">{name(v.memberId)}{v.notes ? ` · ${v.notes}` : ''}</div>
                  </li>
                ))}
                {data.recentVisits.length === 0 && <li className="p-5 text-center text-slate-400">—</li>}
              </ul>
            </Card>
            <Card title={hi ? 'हाल में दी गई सैलरी' : 'Recent salary payments'}>
              <ul className="divide-y divide-slate-800 text-xs">
                {data.recentPayroll.map((p) => (
                  <li key={`${p.memberId}-${p.month}`} className="px-5 py-3 flex justify-between">
                    <span><span className="font-semibold text-white">{name(p.memberId)}</span><span className="text-slate-400"> · {p.month} · {p.mode.toUpperCase()}</span></span>
                    <span className="font-bold text-emerald-400">{formatINR(p.net)}</span>
                  </li>
                ))}
                {data.recentPayroll.length === 0 && <li className="p-5 text-center text-slate-400">—</li>}
              </ul>
            </Card>
          </div>
        </>
      )}

      {/* Staff the owner runs on the shop phone (PIN logins, selfie check-in, salary, visits, tracking) */}
      <AppStaff month={month} />
    </div>
  );
};

const Card: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
    <div className="p-4 border-b border-slate-800 flex items-center space-x-2">{icon}<h3 className="font-extrabold text-sm text-white">{title}</h3></div>
    <div className="overflow-x-auto">{children}</div>
  </div>
);
