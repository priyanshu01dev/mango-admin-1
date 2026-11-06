import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { BusinessProfile } from '../types';
import { formatINR, TRANSLATIONS, INDIAN_STATES } from '../utils/formatters';
import { Settings, ShieldCheck, Users, FileText, CheckCircle2, AlertTriangle, Building, Save } from 'lucide-react';

export const AuditSettings: React.FC = () => {
  const { language, activeBusiness, auditLogs, showToast, team, setBusinessStatus, can } = useBilling();
  const canSuspend = can('businesses', 'edit');
  const canSeeLog = can('audit');
  const toggleStatus = async () => {
    const suspend = activeBusiness.status !== 'SUSPENDED';
    const reason = suspend ? prompt(language === 'hi' ? 'सस्पेंड करने का कारण (मालिक को दिखेगा):' : 'Reason for suspending (shown to the owner):') : undefined;
    if (suspend && !reason) return;
    try { await setBusinessStatus(suspend ? 'suspended' : 'active', reason ?? undefined); } catch (e) { showToast((e as Error).message); }
  };
  const t = TRANSLATIONS[language];

  const [activeSubTab, setActiveSubTab] = useState<'BIZ_SETTINGS' | 'USERS_RBAC' | 'AUDIT_LOGS'>('BIZ_SETTINGS');

  // Business form state
  // Profile is edited by the owner in the app; shown read-only here.
  const formData: BusinessProfile = activeBusiness;
  const setFormData = (_: BusinessProfile) => {};
  const handleSaveSettings = (e: React.FormEvent) => e.preventDefault();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-black text-white">{t.auditLogs}</h2>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {language === 'hi'
              ? 'बिजनेस प्रोफाइल, बैंक विवरण, रोल आधारित अनुमति (RBAC) व सुरक्षा ऑडिट लॉग'
              : 'Store profile, banking, role-based access control (RBAC), and security audit trails'}
          </p>
        </div>

        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveSubTab('BIZ_SETTINGS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'BIZ_SETTINGS' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Store Profile
          </button>
          <button
            onClick={() => setActiveSubTab('USERS_RBAC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'USERS_RBAC' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Users & Roles (RBAC)
          </button>
          {canSeeLog && <button
            onClick={() => setActiveSubTab('AUDIT_LOGS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'AUDIT_LOGS' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Security Audit Trail ({auditLogs.length})
          </button>}
        </div>
      </div>

      {/* SUBTAB 1: STORE PROFILE */}
      {activeSubTab === 'BIZ_SETTINGS' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6 text-xs">
          <p className="text-[11px] text-slate-400 -mb-2">{language === 'hi' ? 'यह प्रोफ़ाइल मालिक Mango Invoice ऐप में बदलते हैं — यहाँ केवल देखने के लिए।' : 'Owners edit this profile in the Mango Invoice app — view only here.'}</p>
          <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
            <h3 className="font-extrabold text-sm text-white">Business Information & GST Credentials</h3>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-[10px] font-bold ${activeBusiness.status === 'SUSPENDED' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{activeBusiness.status}</span>
              {canSuspend && (
                <button type="button" onClick={toggleStatus}
                  className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl font-bold text-xs ${activeBusiness.status === 'SUSPENDED' ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'}`}>
                  <Save className="w-3.5 h-3.5" />
                  <span>{activeBusiness.status === 'SUSPENDED' ? (language === 'hi' ? 'फिर से चालू करें' : 'Reactivate') : (language === 'hi' ? 'सस्पेंड करें' : 'Suspend business')}</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Legal Registered Name</label>
              <input readOnly
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Trade / Display Name</label>
              <input readOnly
                type="text"
                value={formData.tradeName}
                onChange={e => setFormData({ ...formData, tradeName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">GSTIN Number</label>
              <input readOnly
                type="text"
                required
                value={formData.gstin}
                onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-emerald-400 font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">PAN Number</label>
              <input readOnly
                type="text"
                required
                value={formData.pan}
                onChange={e => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Contact Phone</label>
              <input readOnly
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Billing Email</label>
              <input readOnly
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1">Business Store Address</label>
              <input readOnly
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <h4 className="font-extrabold text-sm text-white mb-3">Bank Account & UPI Details (Printed on Invoices)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Bank Name</label>
                <input readOnly
                  type="text"
                  value={formData.bankName}
                  onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Account Number</label>
                <input readOnly
                  type="text"
                  value={formData.bankAccountNumber}
                  onChange={e => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">IFSC Code</label>
                <input readOnly
                  type="text"
                  value={formData.bankIfsc}
                  onChange={e => setFormData({ ...formData, bankIfsc: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Bank Branch</label>
                <input readOnly
                  type="text"
                  value={formData.bankBranch}
                  onChange={e => setFormData({ ...formData, bankBranch: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">UPI ID (For Instant QR Code Generation)</label>
                <input readOnly
                  type="text"
                  value={formData.upiId}
                  onChange={e => setFormData({ ...formData, upiId: e.target.value })}
                  placeholder="storename@bank"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-emerald-400 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <label className="block text-[11px] text-slate-400 mb-1">Terms & Conditions (Footer of Invoice)</label>
            <textarea readOnly
              rows={3}
              value={formData.terms}
              onChange={e => setFormData({ ...formData, terms: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white leading-relaxed"
            />
          </div>
        </form>
      )}

      {/* SUBTAB 2: RBAC */}
      {activeSubTab === 'USERS_RBAC' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-extrabold text-sm text-white">{language === 'hi' ? 'बिजनेस की टीम (ऐप से)' : 'Business team (from the app)'}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{language === 'hi' ? 'मालिक ऐप में यूज़र और रोल जोड़ते हैं' : 'Owners add users and roles in the app'}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3.5 pl-5">Staff Member</th>
                  <th className="p-3.5">Assigned Role</th>
                  <th className="p-3.5">Permissions Granted</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {team.map((m, i) => (
                  <tr key={i}>
                    <td className="p-3.5 pl-5">
                      <div className="font-bold text-white">{m.name}</div>
                      <div className="text-[10px] text-slate-400">+91 {m.phone}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold text-[10px]">{m.role.toUpperCase()}</span>
                    </td>
                    <td className="p-3.5 text-slate-300 text-[11px]">{m.role === 'Owner' ? 'Full access' : m.role}{m.lastActive ? ` · last active ${m.lastActive}` : ''}</td>
                    <td className={`p-3.5 text-center font-bold ${m.active ? 'text-emerald-400' : 'text-slate-500'}`}>{m.active ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))}
                {team.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-400">{language === 'hi' ? 'ऐप से कोई टीम सिंक नहीं हुई' : 'No team synced from the app'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: AUDIT TRAIL */}
      {canSeeLog && activeSubTab === 'AUDIT_LOGS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-sm text-white">Security & Audit Activity Log</h3>
              <p className="text-[11px] text-slate-400">Immutable ledger of all modifications, invoices, and logins</p>
            </div>
            <span className="bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono text-emerald-400">
              {auditLogs.length} Events Logged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3.5 pl-5">Timestamp</th>
                  <th className="p-3.5">User & Role</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Details</th>
                  <th className="p-3.5">IP Address</th>
                  <th className="p-3.5 pr-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 pl-5 text-slate-400">{log.timestamp}</td>
                    <td className="p-3.5 font-sans">
                      <span className="font-bold text-white">{log.userName}</span>
                      <span className="block text-[10px] text-slate-400">{log.role}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-indigo-300 font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-sans text-slate-200">{log.details}</td>
                    <td className="p-3.5 text-slate-400">{log.ipAddress}</td>
                    <td className="p-3.5 pr-5 text-center">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
