import React, { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, Megaphone, Trash2 } from 'lucide-react';
import { useBilling } from '../context/BillingContext';
import { api, ApiError } from '../lib/api';
import { Card, EmptyRow, PageHeader, Pill, Tabs, Th, THead, Tone } from './ui';

interface Ticket { id: string; businessId: string | null; businessName: string; phone: string; subject: string; category: string; message: string; status: 'open' | 'in_progress' | 'closed'; createdAt: string }
interface Announcement { id: string; businessId: string | null; businessName: string | null; title: string; body: string; createdAt: string }

const TONE: Record<Ticket['status'], Tone> = { open: 'amber', in_progress: 'blue', closed: 'green' };
const when = (s: string) => new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Tickets raised from the app's Help screen, and announcements shown in the app's Notifications. */
export const Support: React.FC = () => {
  const { language, can, showToast, activeBusiness } = useBilling();
  const hi = language === 'hi';
  const canEdit = can('support', 'edit');
  const [tab, setTab] = useState<'tickets' | 'announce'>('tickets');
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [news, setNews] = useState<Announcement[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', body: '', onlyThis: false });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<{ data: Ticket[] }>('/support/tickets', { query: { status: filter === 'open' ? 'open' : undefined } }).then((r) => setTickets(r.data)).catch((e: ApiError) => setError(e.message));
    api<{ data: Announcement[] }>('/announcements').then((r) => setNews(r.data)).catch(() => {});
  }, [filter]);
  useEffect(load, [load]);

  const setStatus = async (t: Ticket, status: Ticket['status']) => {
    try { await api(`/support/tickets/${t.id}`, { method: 'PATCH', body: { status } }); load(); } catch (e) { showToast((e as Error).message); }
  };
  const announce = async () => {
    try {
      await api('/announcements', { body: { title: form.title, body: form.body, businessId: form.onlyThis ? activeBusiness.id : undefined } });
      setForm({ title: '', body: '', onlyThis: false }); showToast(hi ? 'भेज दिया' : 'Announcement sent'); load();
    } catch (e) { showToast((e as Error).message); }
  };
  const remove = async (a: Announcement) => {
    try { await api(`/announcements/${a.id}`, { method: 'DELETE' }); load(); } catch (e) { showToast((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={<LifeBuoy className="w-5 h-5 text-emerald-400" />} title={hi ? 'सपोर्ट' : 'Support'}
        subtitle={hi ? 'ऐप के Help से आए टिकट, और ऐप की Notifications में जाने वाली घोषणाएँ' : "Tickets from the app's Help screen, and announcements shown in the app's Notifications"}
        right={<Tabs tabs={[['tickets', hi ? 'टिकट' : 'Tickets'], ['announce', hi ? 'घोषणाएँ' : 'Announcements']]} value={tab} onChange={setTab} />} />
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl p-3">{error}</div>}

      {tab === 'tickets' ? (
        <>
          <Tabs tabs={[['open', hi ? 'खुले' : 'Open'], ['all', hi ? 'सभी' : 'All']]} value={filter} onChange={setFilter} />
          <Card title={hi ? 'टिकट' : 'Tickets'}>
            <table className="w-full text-left text-xs text-slate-300">
              <THead><Th first>{hi ? 'बिजनेस' : 'Business'}</Th><Th>{hi ? 'विषय' : 'Subject'}</Th><Th>{hi ? 'कब' : 'When'}</Th><Th>Status</Th><Th right> </Th></THead>
              <tbody className="divide-y divide-slate-800">
                {(tickets ?? []).map((t) => (
                  <React.Fragment key={t.id}>
                    <tr className="cursor-pointer hover:bg-slate-800/40" onClick={() => setOpen(open === t.id ? null : t.id)}>
                      <td className="p-3 pl-5"><div className="font-bold text-white">{t.businessName}</div><div className="text-[10px] text-slate-400">+91 {t.phone}</div></td>
                      <td className="p-3"><div className="text-white font-semibold">{t.subject}</div><div className="text-[10px] text-slate-500">{t.category}</div></td>
                      <td className="p-3 text-[11px]">{when(t.createdAt)}</td>
                      <td className="p-3"><Pill tone={TONE[t.status]}>{t.status.replace('_', ' ')}</Pill></td>
                      <td className="p-3 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <select value={t.status} onChange={(e) => setStatus(t, e.target.value as Ticket['status'])} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white">
                            <option value="open">Open</option><option value="in_progress">In progress</option><option value="closed">Closed</option>
                          </select>
                        )}
                      </td>
                    </tr>
                    {open === t.id && (
                      <tr><td colSpan={5} className="px-5 pb-4 bg-slate-950/40">
                        <p className="pt-3 text-xs text-slate-300 whitespace-pre-wrap">{t.message}</p>
                        <a href={`https://wa.me/91${t.phone}`} target="_blank" rel="noreferrer" className="inline-block mt-2 text-[11px] text-indigo-300 underline">{hi ? 'WhatsApp पर जवाब दें' : 'Reply on WhatsApp'}</a>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
                {tickets?.length === 0 && <EmptyRow cols={5} text={hi ? 'कोई टिकट नहीं' : 'No tickets'} />}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title={hi ? 'नई घोषणा' : 'New announcement'} icon={<Megaphone className="w-4 h-4 text-emerald-400" />}>
            <div className="p-5 space-y-3 text-xs">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={hi ? 'शीर्षक' : 'Title'} maxLength={120}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" />
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={hi ? 'संदेश' : 'Message'} rows={4} maxLength={2000}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" />
              <label className="flex items-center space-x-2 text-slate-300">
                <input type="checkbox" checked={form.onlyThis} onChange={(e) => setForm({ ...form, onlyThis: e.target.checked })} disabled={!activeBusiness.id} />
                <span>{hi ? `सिर्फ़ ${activeBusiness.name || '—'} को` : `Only to ${activeBusiness.name || '—'}`}</span>
              </label>
              <button disabled={!canEdit || form.title.trim().length < 3 || form.body.trim().length < 3} onClick={announce}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold disabled:opacity-40">{hi ? 'भेजें' : 'Send'}</button>
              <p className="text-[10px] text-slate-500">{hi ? 'ऐप में Notifications पर दिखेगी।' : "Shows in the app's Notifications."}</p>
            </div>
          </Card>
          <Card title={hi ? 'भेजी गई' : 'Sent'}>
            <ul className="divide-y divide-slate-800 text-xs">
              {news.map((a) => (
                <li key={a.id} className="px-5 py-3 flex justify-between gap-3">
                  <div><div className="font-bold text-white">{a.title}</div><div className="text-slate-400">{a.body}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{a.businessName ?? (hi ? 'सभी बिजनेस' : 'All businesses')} · {when(a.createdAt)}</div></div>
                  {canEdit && <button onClick={() => remove(a)} title={hi ? 'हटाएँ' : 'Delete'} className="text-slate-500 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>}
                </li>
              ))}
              {news.length === 0 && <li className="p-5 text-center text-slate-400">—</li>}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
};
