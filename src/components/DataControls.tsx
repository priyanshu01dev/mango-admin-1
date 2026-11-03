import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { useAuth } from '../context/AuthContext';
import { get, post, del, errMsg } from '../api/client';
import { GhostButton, inputCls } from './admin/ui';
import { Download, AlertTriangle } from 'lucide-react';

/** Data export and account deletion request (Play data-safety, spec §8.11). */
export const DataControls: React.FC = () => {
  const { activeBusiness, role, showToast } = useBilling();
  const { reloadProfile, logout } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const exportAll = async () => {
    setBusy(true);
    try {
      const data = await get<Record<string, unknown>>('/api/businesses/current/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `mango-invoice-${activeBusiness.name.replace(/\W+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const requestDeletion = async () => {
    try {
      const r = await post<{ message: string }>('/api/businesses/current/deletion-request', { confirmName: confirm });
      showToast(r.message);
      await reloadProfile();
    } catch (e) {
      showToast(errMsg(e));
    }
  };

  const deleteLogin = async () => {
    if (window.prompt('This removes your login and personal details. Type DELETE to confirm.') !== 'DELETE') return;
    try {
      await del('/api/auth/me', { confirm: 'DELETE' });
      await logout();
    } catch (e) {
      showToast(errMsg(e));
    }
  };

  return (
    <div className="bg-white border border-mango-100 rounded-2xl p-6 space-y-5 text-xs">
      {role !== 'SALESMAN' && <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-sm text-ink">Export all data</h3>
          <p className="text-stone-500 mt-0.5">Parties, items, invoices, documents, payments, expenses and stock ledger as one JSON file.</p>
        </div>
        <GhostButton onClick={exportAll} disabled={busy}><Download className="w-3.5 h-3.5" /> {busy ? 'Preparing…' : 'Download export'}</GhostButton>
      </div>}

      <div className="flex items-center justify-between gap-4 border-t border-mango-100 pt-4">
        <div>
          <h3 className="font-extrabold text-sm text-ink">Delete my login</h3>
          <p className="text-stone-500 mt-0.5">Removes your name, mobile and email. Owners must request deletion of the business first.</p>
        </div>
        <button onClick={deleteLogin} className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-300 text-rose-700 hover:bg-rose-50">Delete my login</button>
      </div>

      {role === 'OWNER' && (
        <div className="border border-rose-200 bg-rose-50/50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-rose-700 font-extrabold"><AlertTriangle className="w-4 h-4" /> Delete this business account</div>
          <p className="text-stone-600">
            Access for everyone in this business stops immediately. GST law requires books to be kept for 72 months, so the data is deleted after that
            period. Download an export first.
          </p>
          <div className="flex gap-2">
            <input className={inputCls} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={`Type "${activeBusiness.name}" to confirm`} />
            <button
              disabled={confirm.trim().toLowerCase() !== activeBusiness.name.trim().toLowerCase()}
              onClick={requestDeletion}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40"
            >
              Request deletion
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
