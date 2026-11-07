import React, { useEffect, useState } from 'react';
import { BadgeCheck, ClipboardList, ExternalLink, Loader2 } from 'lucide-react';
import { useBilling } from '../context/BillingContext';
import { api, ApiError } from '../lib/api';
import { formatINR } from '../utils/formatters';
import { daysBetween, expiryState, ExpiryState, FSSAI_LABEL, label, LICENCE_LABEL, licenceDocuments, showDate, stamp, todayISO, useSnapshot } from '../lib/snapshot';
import { Licence } from '../types/snapshot';
import { Card, EmptyRow, PageHeader, Pill, ReadOnlyNote, SnapshotGate, Stats, Tabs, Th, THead, Tone } from './ui';

const EXPIRY_TONE: Record<ExpiryState, Tone> = { NONE: 'grey', OK: 'green', DUE_SOON: 'amber', RENEW_NOW: 'red', EXPIRED: 'red' };
const STATUS_TONE: Record<string, Tone> = { DRAFT: 'grey', SUBMITTED: 'blue', UNDER_REVIEW: 'blue', QUERY: 'amber', APPROVED: 'green', REJECTED: 'red' };
const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'QUERY', 'APPROVED', 'REJECTED'] as const;

/** An application a business sent to Mango's licence-assist desk from the app (POST /api/v1/licences/applications). */
interface DeskApplication {
  id: string; businessId: string; businessName: string; kind: 'FSSAI' | 'TRADE'; action: 'NEW' | 'RENEWAL'; category?: string;
  holderName: string; premises: string; tradeType: string; number?: string; years: number; documents: string[];
  status: string; reference: string; note?: string; createdAt: string; updatedAt?: string;
}

export const Licences: React.FC = () => {
  const { language, activeBusiness } = useBilling();
  const hi = language === 'hi';
  const state = useSnapshot();
  const [tab, setTab] = useState<'business' | 'desk'>('business');
  return (
    <div className="space-y-6">
      <PageHeader icon={<BadgeCheck className="w-5 h-5 text-emerald-400" />} title={hi ? 'फूड व ट्रेड लाइसेंस' : 'Food & trade licences'}
        subtitle={hi ? 'FSSAI और नगर निगम ट्रेड लाइसेंस — नया व नवीनीकरण' : 'FSSAI and municipal trade licences — new and renewal'}
        right={<Tabs tabs={[['business', activeBusiness.name || (hi ? 'बिजनेस' : 'Business')], ['desk', hi ? 'लाइसेंस डेस्क (सभी)' : 'Licence desk (all)']]} value={tab} onChange={setTab} />} />
      {tab === 'business' ? (
        <>
          <SnapshotGate state={state}>{(s) => <BusinessLicences list={s.extras.licences} hi={hi} />}</SnapshotGate>
          <ReadOnlyNote updatedAt={state.updatedAt} />
        </>
      ) : <Desk hi={hi} />}
    </div>
  );
};

const BusinessLicences: React.FC<{ list: Licence[]; hi: boolean }> = ({ list, hi }) => {
  const today = todayISO();
  const [open, setOpen] = useState<string | null>(null);
  const due = list.filter((l) => l.status === 'APPROVED' && ['RENEW_NOW', 'EXPIRED', 'DUE_SOON'].includes(expiryState(l, today)));
  return (
    <>
      <Stats items={[
        [hi ? 'कुल' : 'Total', list.length],
        [hi ? 'सक्रिय' : 'Active', list.filter((l) => l.status === 'APPROVED' && expiryState(l, today) !== 'EXPIRED').length],
        [hi ? 'प्रक्रिया में' : 'In process', list.filter((l) => ['SUBMITTED', 'UNDER_REVIEW', 'QUERY'].includes(l.status)).length],
        [hi ? 'नवीनीकरण बाकी' : 'Renewal due', due.length, due[0]?.expiresOn ? `${hi ? 'सबसे पहले' : 'first'} ${showDate(due[0].expiresOn)}` : undefined],
      ]} />
      {due.map((l) => {
        const d = daysBetween(today, l.expiresOn!);
        return (
          <div key={l.id} className={`text-xs rounded-xl p-3 border ${d <= 30 ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'}`}>
            <b>{LICENCE_LABEL[l.kind]}</b> {l.number && `(${l.number})`} — {d < 0 ? (hi ? `${-d} दिन पहले समाप्त` : `expired ${-d} days ago`) : (hi ? `${d} दिन में समाप्त` : `expires in ${d} days`)}
            {l.kind === 'FSSAI' && d < 0 && <span> · {hi ? 'लेट फीस' : 'late fee'} {formatINR(-d * 100)}</span>}
          </div>
        );
      })}
      <Card title={hi ? 'लाइसेंस' : 'Licences'}>
        <table className="w-full text-left text-xs text-slate-300">
          <THead><Th first>{hi ? 'प्रकार' : 'Licence'}</Th><Th>{hi ? 'नंबर / रेफ़' : 'Number / ref'}</Th><Th>{hi ? 'दस्तावेज़' : 'Documents'}</Th><Th>{hi ? 'फीस' : 'Fee'}</Th><Th>{hi ? 'वैधता' : 'Valid till'}</Th><Th right>Status</Th></THead>
          <tbody className="divide-y divide-slate-800">
            {list.map((l) => {
              const docs = licenceDocuments(l);
              const have = docs.filter((d) => l.documents[d]).length;
              const ex = expiryState(l, today);
              return (
                <React.Fragment key={l.id}>
                  <tr className="cursor-pointer hover:bg-slate-800/40" onClick={() => setOpen(open === l.id ? null : l.id)}>
                    <td className="p-3 pl-5"><div className="font-bold text-white">{LICENCE_LABEL[l.kind]} · {label(l.action)}</div>
                      <div className="text-[10px] text-slate-400">{l.fssaiCategory ? FSSAI_LABEL[l.fssaiCategory] : l.tradeType} · {l.years} {hi ? 'साल' : 'yr'}</div></td>
                    <td className="p-3 font-mono text-[11px]">{l.number || '—'}{l.applicationRef && <span className="block text-slate-500">ref {l.applicationRef}</span>}</td>
                    <td className="p-3"><Pill tone={have === docs.length ? 'green' : 'amber'}>{have}/{docs.length}</Pill></td>
                    <td className="p-3">{formatINR(l.fee)}</td>
                    <td className="p-3">{l.expiresOn ? <Pill tone={EXPIRY_TONE[ex]}>{showDate(l.expiresOn)}</Pill> : '—'}</td>
                    <td className="p-3 pr-5 text-right"><Pill tone={STATUS_TONE[l.status]}>{label(l.status)}</Pill></td>
                  </tr>
                  {open === l.id && (
                    <tr><td colSpan={6} className="px-5 pb-4 bg-slate-950/40">
                      <div className="grid md:grid-cols-2 gap-4 pt-3 text-[11px]">
                        <div className="space-y-1">
                          <p><span className="text-slate-500">{hi ? 'धारक' : 'Holder'}:</span> {l.holderName}</p>
                          <p><span className="text-slate-500">{hi ? 'परिसर' : 'Premises'}:</span> {l.premises}</p>
                          <p><span className="text-slate-500">{hi ? 'आवेदन' : 'Applied'}:</span> {showDate(l.appliedOn)} · <span className="text-slate-500">{hi ? 'जारी' : 'Issued'}:</span> {showDate(l.issuedOn)}</p>
                          {l.notes && <p className="text-slate-400">{l.notes}</p>}
                          <p className="text-slate-500">{hi ? 'अपडेट' : 'Updated'} {stamp(l.updatedAt)}</p>
                        </div>
                        <ul className="space-y-0.5">{docs.map((d) => <li key={d} className={l.documents[d] ? 'text-emerald-300' : 'text-slate-500'}>{l.documents[d] ? '☑' : '☐'} {d}</li>)}</ul>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
            {list.length === 0 && <EmptyRow cols={6} text={hi ? 'इस बिजनेस ने कोई लाइसेंस नहीं जोड़ा' : 'No licences added by this business'} />}
          </tbody>
        </table>
      </Card>
      <a href="https://foscos.fssai.gov.in" target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-indigo-300 underline"><ExternalLink className="w-3 h-3 mr-1" />FoSCoS (FSSAI)</a>
    </>
  );
};

/** Mango's assisted-filing queue across all businesses (server). */
const Desk: React.FC<{ hi: boolean }> = ({ hi }) => {
  const { can, showToast } = useBilling();
  const canEdit = can('licences', 'edit');
  const [rows, setRows] = useState<DeskApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [edit, setEdit] = useState<DeskApplication | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setRows(null); setError(null);
    api<{ data: DeskApplication[] } | DeskApplication[]>('/licences/applications', { query: { status: filter === 'open' ? 'open' : undefined } })
      .then((r) => setRows(Array.isArray(r) ? r : r.data))
      .catch((e: ApiError) => { if (e.status === 404) setMissing(true); else setError(e.message); });
  }, [filter, tick]);

  const save = async () => {
    if (!edit) return;
    try {
      await api(`/licences/applications/${edit.id}`, { method: 'PATCH', body: { status: edit.status, reference: edit.reference, note: edit.note ?? '' } });
      showToast(hi ? 'अपडेट हुआ' : 'Updated'); setEdit(null); setTick((t) => t + 1);
    } catch (e) { showToast((e as Error).message); }
  };

  if (missing) return (
    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs rounded-xl p-4">
      {hi ? 'बैकएंड में लाइसेंस डेस्क API नहीं है। जोड़ें: GET /api/admin/licences/applications, PATCH /api/admin/licences/applications/:id (ऐप POST /api/v1/licences/applications भेजता है)।'
        : 'The backend has no licence-desk API yet. Add GET /api/admin/licences/applications and PATCH /api/admin/licences/applications/:id (the app sends POST /api/v1/licences/applications).'}
    </div>
  );
  return (
    <>
      <div className="flex items-center justify-between">
        <Tabs tabs={[['open', hi ? 'खुले' : 'Open'], ['all', hi ? 'सभी' : 'All']]} value={filter} onChange={setFilter} />
        {!canEdit && <span className="text-[10px] text-slate-500">{hi ? 'सिर्फ़ देखने की अनुमति' : 'View only'}</span>}
      </div>
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl p-3">{error}</div>}
      <Card title={hi ? 'आवेदन' : 'Applications'} icon={<ClipboardList className="w-4 h-4 text-emerald-400" />}>
        {!rows && !error ? <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline text-slate-500" /></div> : (
          <table className="w-full text-left text-xs text-slate-300">
            <THead><Th first>{hi ? 'बिजनेस' : 'Business'}</Th><Th>{hi ? 'लाइसेंस' : 'Licence'}</Th><Th>{hi ? 'दस्तावेज़' : 'Docs'}</Th><Th>{hi ? 'रेफ़' : 'Reference'}</Th><Th>{hi ? 'आया' : 'Received'}</Th><Th>Status</Th><Th right> </Th></THead>
            <tbody className="divide-y divide-slate-800">
              {(rows ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="p-3 pl-5"><div className="font-bold text-white">{a.businessName}</div><div className="text-[10px] text-slate-400">{a.holderName}</div></td>
                  <td className="p-3">{LICENCE_LABEL[a.kind]} · {label(a.action)}<span className="block text-[10px] text-slate-500">{a.category ? FSSAI_LABEL[a.category] ?? a.category : a.tradeType} · {a.years} yr</span></td>
                  <td className="p-3">{a.documents.length}</td>
                  <td className="p-3 font-mono text-[11px]">{a.reference || '—'}</td>
                  <td className="p-3 text-[11px]">{new Date(a.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="p-3"><Pill tone={STATUS_TONE[a.status] ?? 'grey'}>{label(a.status)}</Pill></td>
                  <td className="p-3 pr-5 text-right">{canEdit && <button onClick={() => setEdit({ ...a })} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold">{hi ? 'अपडेट' : 'Update'}</button>}</td>
                </tr>
              ))}
              {rows?.length === 0 && <EmptyRow cols={7} text={hi ? 'कोई आवेदन नहीं' : 'No applications'} />}
            </tbody>
          </table>
        )}
      </Card>
      {edit && (
        <div className="fixed inset-0 bg-[#1d1a17]/50 flex items-center justify-center z-50 p-4" onClick={() => setEdit(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md space-y-3 text-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-sm text-white">{edit.businessName} · {LICENCE_LABEL[edit.kind]}</h3>
            <label className="block"><span className="text-slate-400">Status</span>
              <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white">
                {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></label>
            <label className="block"><span className="text-slate-400">{hi ? 'सरकारी आवेदन / लाइसेंस नंबर' : 'Govt. application / licence no.'}</span>
              <input value={edit.reference} onChange={(e) => setEdit({ ...edit, reference: e.target.value })} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono" /></label>
            <label className="block"><span className="text-slate-400">{hi ? 'ग्राहक के लिए नोट' : 'Note to the business'}</span>
              <textarea value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} rows={3} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" /></label>
            <div className="flex justify-end gap-2"><button onClick={() => setEdit(null)} className="px-3 py-2 rounded-lg bg-slate-800">{hi ? 'रद्द' : 'Cancel'}</button>
              <button onClick={save} className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold">{hi ? 'सेव' : 'Save'}</button></div>
          </div>
        </div>
      )}
    </>
  );
};
