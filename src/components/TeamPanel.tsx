import React, { useCallback, useEffect, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { get, post, del, errMsg } from '../api/client';
import { Badge, Field, inputCls, PrimaryButton, EmptyState } from './admin/ui';
import { UserPlus, Trash2 } from 'lucide-react';

type Role = 'OWNER' | 'ADMIN' | 'SALESMAN' | 'ACCOUNTANT';
interface Member {
  id: string;
  role: Role;
  user: { _id: string; name?: string; phone?: string; email?: string };
}

const ROLE_INFO: Record<Role, { tone: 'mango' | 'wave' | 'leaf' | 'violet'; can: string }> = {
  OWNER: { tone: 'mango', can: 'Everything, including plan, team and settings' },
  ADMIN: { tone: 'wave', can: 'Everything except removing the owner' },
  SALESMAN: { tone: 'leaf', can: 'Invoices, quotations, challans, payments received; view items and parties' },
  ACCOUNTANT: { tone: 'violet', can: 'Read-only books, GST reports, P&L, audit trail (for your CA)' }
};

/** Team members and roles for the current business (spec §8.11). */
export const TeamPanel: React.FC = () => {
  const { role, showToast, current } = useBilling();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ phone: '', name: '', role: 'SALESMAN' as Exclude<Role, 'OWNER'> });
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const userLimit = (current?.plan.limits as { users?: number } | undefined)?.users;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await get<Member[]>('/api/businesses/current/members'));
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post('/api/businesses/current/members', { phone: form.phone, name: form.name || undefined, role: form.role });
      showToast(`Added ${form.phone} as ${form.role}. They can log in with mobile OTP.`);
      setForm({ ...form, phone: '', name: '' });
      load();
    } catch (err) {
      showToast(errMsg(err));
    }
  };

  const remove = async (m: Member) => {
    if (!window.confirm(`Remove ${m.user.name || m.user.phone} from this business?`)) return;
    try {
      await del(`/api/businesses/current/members/${m.id}`);
      showToast('Member removed');
      load();
    } catch (err) {
      showToast(errMsg(err));
    }
  };

  return (
    <div className="bg-white border border-mango-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-mango-100 flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-sm text-ink">Team & roles</h3>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {members.length} member{members.length === 1 ? '' : 's'}
            {userLimit ? ` · your plan allows ${userLimit}` : ''}
          </p>
        </div>
      </div>

      {canManage && (
        <form onSubmit={add} className="p-4 border-b border-mango-100 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs items-end bg-mango-50/30">
          <Field label="Mobile number"><input className={inputCls} required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="98100 12345" /></Field>
          <Field label="Name (optional)"><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Role">
            <select className={inputCls} value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Exclude<Role, 'OWNER'> })}>
              <option value="SALESMAN">Salesman</option>
              <option value="ACCOUNTANT">Accountant / CA (read-only)</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>
          <PrimaryButton type="submit"><UserPlus className="w-3.5 h-3.5" /> Add member</PrimaryButton>
        </form>
      )}

      <table className="w-full text-left text-xs text-stone-700">
        <thead className="bg-mango-50/60 text-stone-500 uppercase text-[10px]">
          <tr>
            <th className="p-3.5 pl-5">Member</th>
            <th className="p-3.5">Role</th>
            <th className="p-3.5">Can do</th>
            <th className="p-3.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-mango-100">
          {members.map(m => (
            <tr key={m.id}>
              <td className="p-3.5 pl-5">
                <div className="font-bold text-ink">{m.user.name || '—'}</div>
                <div className="text-[10px] text-stone-500">{m.user.phone || m.user.email}</div>
              </td>
              <td className="p-3.5"><Badge tone={ROLE_INFO[m.role].tone}>{m.role}</Badge></td>
              <td className="p-3.5 text-[11px] text-stone-600">{ROLE_INFO[m.role].can}</td>
              <td className="p-3.5 text-right">
                {canManage && m.role !== 'OWNER' && (
                  <button onClick={() => remove(m)} className="p-1.5 text-stone-400 hover:text-rose-600" aria-label="Remove member">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && members.length === 0 && <EmptyState text="No members." />}
    </div>
  );
};
