import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, Plus, ShieldCheck, UserCog, X } from 'lucide-react';
import { useBilling } from '../context/BillingContext';
import { api } from '../lib/api';
import { AccessLevel, AdminScreen, PermissionMap } from '../types';
import { TRANSLATIONS } from '../utils/formatters';

/** An admin as returned by GET /api/admin/staff. */
interface StaffAdmin {
  id: string; name: string; email: string; isSuperAdmin: boolean; permissions: PermissionMap; active: boolean;
  legacyRole: string | null; lastLoginAt: string | null; createdAt: string;
}

const SCREENS: AdminScreen[] = ['dashboard', 'invoices', 'quotations', 'eway', 'inventory', 'parties', 'payments', 'gst', 'subscriptions', 'attendance',
  'hospitality', 'licences', 'marketing', 'loyalty', 'delivery', 'api', 'audit', 'businesses', 'support', 'app_config', 'staff'];

function screenLabel(s: AdminScreen, lang: 'en' | 'hi'): string {
  const t = TRANSLATIONS[lang] as Record<string, string>;
  const map: Record<AdminScreen, string> = {
    dashboard: t.dashboard, invoices: t.invoices, quotations: t.quotations, eway: t.eWayEInvoice, inventory: t.inventory, parties: t.parties,
    payments: t.payments, gst: t.gstReports, subscriptions: t.subscriptions, attendance: t.staffAttendance, api: t.androidApi, audit: lang === 'hi' ? 'ऑडिट लॉग (और सेटिंग्स स्क्रीन)' : 'Audit log (Audit & Settings screen)',
    businesses: lang === 'hi' ? 'बिजनेस सस्पेंड / स्नैपशॉट (सेटिंग्स स्क्रीन में)' : 'Suspend business / download snapshot (in Audit & Settings)',
    support: lang === 'hi' ? 'सपोर्ट टिकट, घोषणाएँ, ऐप यूज़र' : 'Support tickets, broadcasts, app users',
    app_config: lang === 'hi' ? 'ऐप सेटिंग्स (मेंटेनेंस, वर्ज़न)' : 'App settings (maintenance, versions)',
    staff: t.adminStaff,
    hospitality: t.hospitality, licences: t.licences, marketing: t.marketing, loyalty: t.loyalty, delivery: t.delivery,
  };
  return map[s];
}
/** Screens that exist on the server but have no page in this panel yet. */
const API_ONLY: AdminScreen[] = ['app_config'];

const LEVELS: (AccessLevel | 'none')[] = ['none', 'view', 'edit'];
const rank = (l: AccessLevel | 'none' | undefined) => (l === 'edit' ? 2 : l === 'view' ? 1 : 0);

interface FormState { id?: string; name: string; email: string; password: string; isSuperAdmin: boolean; permissions: PermissionMap }
const EMPTY: FormState = { name: '', email: '', password: '', isSuperAdmin: false, permissions: {} };

/** Admin panel staff: who can sign in to this panel and which screens they can open. */
export const Staff: React.FC = () => {
  const { language, admin: me, can, showToast, refreshMe } = useBilling();
  const hi = language === 'hi';
  const lang = language as 'en' | 'hi';
  const canEdit = can('staff', 'edit');
  const [admins, setAdmins] = useState<StaffAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState<StaffAdmin | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api<{ admins: StaffAdmin[] }>('/staff').then((r) => setAdmins(r.admins)).catch((e) => showToast(e.message)).finally(() => setLoading(false));
  }, [showToast]);
  useEffect(load, [load]);

  /** Highest level the signed-in admin may hand out for a screen (non-super admins: their own level). */
  const ceiling = (s: AdminScreen): number => (me?.isSuperAdmin ? 2 : rank(me?.permissions[s]));

  const openCreate = () => { setErrors({}); setForm({ ...EMPTY }); };
  const openEdit = (a: StaffAdmin) => { setErrors({}); setForm({ id: a.id, name: a.name, email: a.email, password: '', isSuperAdmin: a.isSuperAdmin, permissions: a.isSuperAdmin ? {} : { ...a.permissions } }); };

  const setLevel = (s: AdminScreen, l: AccessLevel | 'none') => setForm((f) => {
    if (!f) return f;
    const p = { ...f.permissions };
    if (l === 'none') delete p[s]; else p[s] = l;
    return { ...f, permissions: p };
  });
  const setAll = (l: AccessLevel | 'none') => setForm((f) => {
    if (!f) return f;
    const p: PermissionMap = {};
    if (l !== 'none') for (const s of SCREENS) { const c = ceiling(s); const want = rank(l); if (c > 0) p[s] = (Math.min(c, want) === 2 ? 'edit' : 'view'); }
    if (f.id === me?.id && f.permissions.staff) p.staff = f.permissions.staff; // keep own Staff access
    return { ...f, permissions: p };
  });

  const save = async () => {
    if (!form) return;
    setBusy(true); setErrors({});
    try {
      if (form.id) {
        await api(`/staff/${form.id}`, { method: 'PATCH', body: { name: form.name, permissions: form.permissions, ...(me?.isSuperAdmin ? { isSuperAdmin: form.isSuperAdmin } : {}) } });
        showToast(hi ? 'अनुमतियाँ सेव हुईं' : 'Access saved');
        if (form.id === me?.id) await refreshMe();
      } else {
        await api('/staff', { body: { name: form.name, email: form.email, password: form.password, permissions: form.permissions, isSuperAdmin: form.isSuperAdmin } });
        showToast(hi ? 'एडमिन जोड़ा गया' : 'Admin added');
      }
      setForm(null); load();
    } catch (e: any) {
      if (e.details && typeof e.details === 'object') setErrors(e.details);
      showToast(e.message);
    } finally { setBusy(false); }
  };

  const toggleActive = async (a: StaffAdmin) => {
    if (a.active && !confirm(hi ? `${a.name} का एक्सेस बंद करें?` : `Turn off access for ${a.name}? They will be signed out.`)) return;
    try { await api(`/staff/${a.id}`, { method: 'PATCH', body: { active: !a.active } }); load(); showToast(a.active ? (hi ? 'निष्क्रिय किया' : 'Deactivated') : (hi ? 'सक्रिय किया' : 'Activated')); }
    catch (e: any) { showToast(e.message); }
  };

  const resetPassword = async () => {
    if (!resetFor) return;
    setBusy(true);
    try { await api(`/staff/${resetFor.id}/password`, { body: { password: newPassword } }); showToast(hi ? 'पासवर्ड रीसेट हुआ' : 'Password reset'); setResetFor(null); setNewPassword(''); }
    catch (e: any) { showToast(e.message); }
    finally { setBusy(false); }
  };

  const summary = (a: StaffAdmin) => {
    if (a.isSuperAdmin) return hi ? 'सब कुछ (सुपर एडमिन)' : 'Everything (super admin)';
    const keys = SCREENS.filter((s) => a.permissions[s]);
    if (!keys.length) return hi ? 'कोई स्क्रीन नहीं' : 'No screens';
    const edits = keys.filter((s) => a.permissions[s] === 'edit').length;
    return `${keys.length} ${hi ? 'स्क्रीन' : 'screens'} · ${edits} ${hi ? 'एडिट' : 'edit'}`;
  };

  const isSelfForm = form?.id === me?.id;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <UserCog className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-black text-white">{TRANSLATIONS[lang].adminStaff}</h2>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {hi ? 'एडमिन पैनल में कौन साइन इन कर सकता है और कौन-सी स्क्रीन देख/बदल सकता है। नए एडमिन को कोई स्क्रीन नहीं मिलती।'
              : 'Who can sign in to this panel and which screens they can view or edit. New admins start with no screens.'}
          </p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20">
            <Plus className="w-4 h-4" /><span>{hi ? 'एडमिन जोड़ें' : 'Add admin'}</span>
          </button>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="p-3.5 pl-5">{hi ? 'एडमिन' : 'Admin'}</th>
                <th className="p-3.5">{hi ? 'एक्सेस' : 'Access'}</th>
                <th className="p-3.5">{hi ? 'आखिरी लॉगिन' : 'Last sign-in'}</th>
                <th className="p-3.5 text-center">{hi ? 'स्थिति' : 'Status'}</th>
                {canEdit && <th className="p-3.5 pr-5 text-right">{hi ? 'कार्य' : 'Actions'}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading && <tr><td colSpan={5} className="p-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline text-slate-500" /></td></tr>}
              {!loading && admins.map((a) => {
                const locked = !me?.isSuperAdmin && (a.isSuperAdmin || SCREENS.some((s) => rank(a.permissions[s]) > ceiling(s)));
                return (
                  <tr key={a.id} className={a.active ? '' : 'opacity-60'}>
                    <td className="p-3.5 pl-5">
                      <div className="font-bold text-white flex items-center">
                        {a.name}{a.id === me?.id && <span className="ml-1.5 text-[9px] font-bold text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded">{hi ? 'आप' : 'You'}</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">{a.email}</div>
                    </td>
                    <td className="p-3.5">
                      {a.isSuperAdmin
                        ? <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold text-[10px] inline-flex items-center"><ShieldCheck className="w-3 h-3 mr-1" />SUPER ADMIN</span>
                        : <span className="text-slate-300 text-[11px]">{summary(a)}</span>}
                      {a.legacyRole && <span className="block text-[10px] text-slate-500 mt-0.5">{hi ? 'पुराना रोल' : 'was'}: {a.legacyRole}</span>}
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px]">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('en-IN') : '—'}</td>
                    <td className={`p-3.5 text-center font-bold ${a.active ? 'text-emerald-400' : 'text-slate-500'}`}>{a.active ? 'Active' : 'Inactive'}</td>
                    {canEdit && (
                      <td className="p-3.5 pr-5 text-right whitespace-nowrap space-x-1.5">
                        <button disabled={locked} onClick={() => openEdit(a)} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed">{hi ? 'एक्सेस' : 'Access'}</button>
                        {a.id !== me?.id && (
                          <>
                            <button disabled={locked} onClick={() => { setResetFor(a); setNewPassword(''); }} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed" title={hi ? 'पासवर्ड रीसेट' : 'Reset password'}><KeyRound className="w-3 h-3 inline" /></button>
                            <button disabled={locked} onClick={() => toggleActive(a)} className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${a.active ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25' : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'}`}>
                              {a.active ? (hi ? 'बंद करें' : 'Deactivate') : (hi ? 'चालू करें' : 'Activate')}
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1a17]/50 p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm">{form.id ? (hi ? `एक्सेस: ${form.name}` : `Access: ${form.name}`) : (hi ? 'नया एडमिन' : 'New admin')}</h3>
              <button onClick={() => setForm(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={hi ? 'नाम' : 'Name'} error={errors.name}>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" />
              </Field>
              <Field label={hi ? 'ईमेल' : 'Email'} error={errors.email}>
                <input disabled={!!form.id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white disabled:opacity-60" />
              </Field>
              {!form.id && (
                <Field label={hi ? 'अस्थायी पासवर्ड (10+ अक्षर)' : 'Temporary password (10+ characters)'} error={errors.password}>
                  <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono" />
                </Field>
              )}
            </div>

            {me?.isSuperAdmin && (
              <label className="flex items-start space-x-2 bg-slate-800/60 border border-slate-700 rounded-xl p-3 cursor-pointer">
                <input type="checkbox" checked={form.isSuperAdmin} onChange={(e) => setForm({ ...form, isSuperAdmin: e.target.checked })} className="mt-0.5 accent-emerald-500" />
                <span>
                  <span className="font-bold text-white">{hi ? 'सुपर एडमिन' : 'Super admin'}</span>
                  <span className="block text-[11px] text-slate-400">{hi ? 'हर स्क्रीन पर पूरा एक्सेस, और दूसरे सुपर एडमिन बना सकते हैं।' : 'Full access to every screen, and can create other super admins.'}</span>
                </span>
              </label>
            )}

            {!form.isSuperAdmin && (
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-800/70">
                  <span className="text-[11px] font-bold text-slate-300">{hi ? 'स्क्रीन एक्सेस' : 'Screen access'}</span>
                  <span className="space-x-1.5">
                    {(['none', 'view', 'edit'] as const).map((l) => (
                      <button key={l} onClick={() => setAll(l)} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-300 hover:text-white">
                        {l === 'none' ? (hi ? 'सब हटाएँ' : 'Clear') : l === 'view' ? (hi ? 'सब देखें' : 'All view') : (hi ? 'सब एडिट' : 'All edit')}
                      </button>
                    ))}
                  </span>
                </div>
                <table className="w-full text-left">
                  <thead className="text-slate-500 uppercase text-[10px]">
                    <tr><th className="p-2 pl-3">{hi ? 'स्क्रीन' : 'Screen'}</th>{LEVELS.map((l) => <th key={l} className="p-2 text-center w-20">{l === 'none' ? (hi ? 'कोई नहीं' : 'None') : l === 'view' ? (hi ? 'देखें' : 'View') : (hi ? 'एडिट' : 'Edit')}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {SCREENS.map((s) => {
                      const cur = form.permissions[s] ?? 'none';
                      return (
                        <tr key={s} className="hover:bg-slate-800/30">
                          <td className="p-2 pl-3">
                            <span className="text-slate-200">{screenLabel(s, lang)}</span>
                            {API_ONLY.includes(s) && <span className="ml-1.5 text-[9px] text-slate-500 border border-slate-700 rounded px-1">API</span>}
                            <span className="block text-[9px] text-slate-500 font-mono">{s}</span>
                          </td>
                          {LEVELS.map((l) => {
                            const tooHigh = rank(l) > ceiling(s);
                            const selfStaffDrop = isSelfForm && s === 'staff' && rank(l) < rank(form.permissions.staff);
                            const disabled = tooHigh || selfStaffDrop;
                            return (
                              <td key={l} className="p-2 text-center">
                                <input type="checkbox" checked={cur === l} disabled={disabled} onChange={() => setLevel(s, l)}
                                  title={tooHigh ? (hi ? 'आपके पास यह एक्सेस नहीं है' : "You can't grant more than you have") : selfStaffDrop ? (hi ? 'अपना Staff एक्सेस नहीं हटा सकते' : "You can't remove your own Staff access") : ''}
                                  className="w-4 h-4 accent-emerald-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {errors.permissions && <p className="text-rose-400 text-[11px]">{errors.permissions}</p>}

            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setForm(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">{hi ? 'रद्द करें' : 'Cancel'}</button>
              <button disabled={busy} onClick={save} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold disabled:opacity-60">
                {busy ? '…' : form.id ? (hi ? 'सेव करें' : 'Save access') : (hi ? 'एडमिन बनाएँ' : 'Create admin')}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1a17]/50 p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm">{hi ? `पासवर्ड रीसेट: ${resetFor.name}` : `Reset password: ${resetFor.name}`}</h3>
              <button onClick={() => setResetFor(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-slate-400">{hi ? 'नया अस्थायी पासवर्ड उन्हें खुद बताएँ। ऑडिट लॉग में दर्ज होगा।' : 'Share the new temporary password with them directly. This is recorded in the audit log.'}</p>
            <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={hi ? 'कम से कम 10 अक्षर' : 'At least 10 characters'} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono" />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setResetFor(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">{hi ? 'रद्द करें' : 'Cancel'}</button>
              <button disabled={busy || newPassword.length < 10} onClick={resetPassword} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold disabled:opacity-60">{hi ? 'रीसेट करें' : 'Reset'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
  <div>
    <label className="block text-[11px] text-slate-400 mb-1">{label}</label>
    {children}
    {error && <p className="text-rose-400 text-[10px] mt-1">{error}</p>}
  </div>
);

