import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { InvoiceSettingsPanel } from './InvoiceSettingsPanel';
import { BusinessProfile } from '../types';
import { formatINR, TRANSLATIONS, INDIAN_STATES } from '../utils/formatters';
import { Settings, ShieldCheck, Users, FileText, CheckCircle2, AlertTriangle, Building, Save } from 'lucide-react';

export const AuditSettings: React.FC = () => {
  const { language, activeBusiness, updateBusinessProfile, auditLogs, showToast } = useBilling();
  const t = TRANSLATIONS[language];

  const [activeSubTab, setActiveSubTab] = useState<'BIZ_SETTINGS' | 'INVOICE_SETTINGS' | 'USERS_RBAC' | 'AUDIT_LOGS'>('BIZ_SETTINGS');

  // Business form state
  const [formData, setFormData] = useState<BusinessProfile>({ ...activeBusiness });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateBusinessProfile(formData);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-mango-100 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-leaf-600" />
            <h2 className="text-xl font-black text-ink">{t.auditLogs}</h2>
          </div>
          <p className="text-stone-500 text-xs mt-0.5">
            {language === 'hi'
              ? 'बिजनेस प्रोफाइल, बैंक विवरण, रोल आधारित अनुमति (RBAC) व सुरक्षा ऑडिट लॉग'
              : 'Store profile, banking, role-based access control (RBAC), and security audit trails'}
          </p>
        </div>

        <div className="flex bg-mango-50/60 p-1 rounded-xl border border-mango-200/70">
          <button
            onClick={() => setActiveSubTab('BIZ_SETTINGS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'BIZ_SETTINGS' ? 'bg-mango-500 text-white shadow-sm' : 'text-stone-500 hover:text-ink'
            }`}
          >
            Store Profile
          </button>
          <button
            onClick={() => setActiveSubTab('INVOICE_SETTINGS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'INVOICE_SETTINGS' ? 'bg-mango-500 text-white shadow-sm' : 'text-stone-500 hover:text-ink'
            }`}
          >
            Invoice Settings
          </button>
          <button
            onClick={() => setActiveSubTab('USERS_RBAC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'USERS_RBAC' ? 'bg-mango-500 text-white shadow-sm' : 'text-stone-500 hover:text-ink'
            }`}
          >
            Users & Roles (RBAC)
          </button>
          <button
            onClick={() => setActiveSubTab('AUDIT_LOGS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'AUDIT_LOGS' ? 'bg-mango-500 text-white shadow-sm' : 'text-stone-500 hover:text-ink'
            }`}
          >
            Security Audit Trail ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* SUBTAB 1: STORE PROFILE */}
      {activeSubTab === 'BIZ_SETTINGS' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-mango-100 rounded-2xl p-6 shadow-sm space-y-6 text-xs">
          <div className="border-b border-mango-100 pb-3 flex justify-between items-center">
            <h3 className="font-extrabold text-sm text-ink">Business Information & GST Credentials</h3>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-4 py-2 bg-mango-500 hover:bg-mango-600 text-white rounded-xl font-bold text-xs shadow-md shadow-mango-500/25"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Settings</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Legal Registered Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Trade / Display Name</label>
              <input
                type="text"
                value={formData.tradeName}
                onChange={e => setFormData({ ...formData, tradeName: e.target.value })}
                className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] text-stone-500 mb-1">GSTIN Number</label>
              <input
                type="text"
                required
                value={formData.gstin}
                onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-leaf-600 font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] text-stone-500 mb-1">PAN Number</label>
              <input
                type="text"
                required
                value={formData.pan}
                onChange={e => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-ink"
              />
            </div>

            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Contact Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
              />
            </div>

            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Billing Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] text-stone-500 mb-1">Business Store Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
              />
            </div>
          </div>

          <div className="border-t border-mango-100 pt-4">
            <h4 className="font-extrabold text-sm text-ink mb-3">Bank Account & UPI Details (Printed on Invoices)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
                />
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Account Number</label>
                <input
                  type="text"
                  value={formData.bankAccountNumber}
                  onChange={e => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-ink"
                />
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={formData.bankIfsc}
                  onChange={e => setFormData({ ...formData, bankIfsc: e.target.value.toUpperCase() })}
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-ink"
                />
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Bank Branch</label>
                <input
                  type="text"
                  value={formData.bankBranch}
                  onChange={e => setFormData({ ...formData, bankBranch: e.target.value })}
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] text-stone-500 mb-1">UPI ID (For Instant QR Code Generation)</label>
                <input
                  type="text"
                  value={formData.upiId}
                  onChange={e => setFormData({ ...formData, upiId: e.target.value })}
                  placeholder="storename@bank"
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-leaf-600 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-mango-100 pt-4">
            <label className="block text-[11px] text-stone-500 mb-1">Terms & Conditions (Footer of Invoice)</label>
            <textarea
              rows={3}
              value={formData.terms}
              onChange={e => setFormData({ ...formData, terms: e.target.value })}
              className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink leading-relaxed"
            />
          </div>
        </form>
      )}

      {/* SUBTAB 2: RBAC */}
      {activeSubTab === 'INVOICE_SETTINGS' && <InvoiceSettingsPanel />}

      {activeSubTab === 'USERS_RBAC' && (
        <div className="bg-white border border-mango-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-mango-100">
            <h3 className="font-extrabold text-sm text-ink">Staff Roles & Permissions (RBAC)</h3>
            <p className="text-[11px] text-stone-500 mt-0.5">Control access levels for billing operators and accountants</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-mango-50/60 text-stone-500 uppercase text-[10px]">
                <tr>
                  <th className="p-3.5 pl-5">Staff Member</th>
                  <th className="p-3.5">Assigned Role</th>
                  <th className="p-3.5">Permissions Granted</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mango-100">
                <tr>
                  <td className="p-3.5 pl-5">
                    <div className="font-bold text-ink">Priyanshu Kumar</div>
                    <div className="text-[10px] text-stone-500">priyanshu@mongo.internal</div>
                  </td>
                  <td className="p-3.5">
                    <span className="bg-emerald-500/20 text-leaf-600 px-2 py-0.5 rounded font-bold text-[10px]">
                      SUPER_ADMIN
                    </span>
                  </td>
                  <td className="p-3.5 text-stone-700 text-[11px]">Full access, Tax filing, Delete invoice, System settings</td>
                  <td className="p-3.5 text-center text-leaf-600 font-bold">Active</td>
                </tr>

                <tr>
                  <td className="p-3.5 pl-5">
                    <div className="font-bold text-ink">Rajesh Kumar</div>
                    <div className="text-[10px] text-stone-500">rajesh.billing@store.in</div>
                  </td>
                  <td className="p-3.5">
                    <span className="bg-indigo-500/20 text-wave-600 px-2 py-0.5 rounded font-bold text-[10px]">
                      BILLING_MANAGER
                    </span>
                  </td>
                  <td className="p-3.5 text-stone-700 text-[11px]">Create invoices, generate e-way bills, collect payment</td>
                  <td className="p-3.5 text-center text-leaf-600 font-bold">Active</td>
                </tr>

                <tr>
                  <td className="p-3.5 pl-5">
                    <div className="font-bold text-ink">Sunita Sharma (CA)</div>
                    <div className="text-[10px] text-stone-500">accounts@auditfirm.com</div>
                  </td>
                  <td className="p-3.5">
                    <span className="bg-teal-500/20 text-teal-600 px-2 py-0.5 rounded font-bold text-[10px]">
                      ACCOUNTANT
                    </span>
                  </td>
                  <td className="p-3.5 text-stone-700 text-[11px]">View reports, export GSTR JSON, customer balance reconciliation</td>
                  <td className="p-3.5 text-center text-leaf-600 font-bold">Active</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: AUDIT TRAIL */}
      {activeSubTab === 'AUDIT_LOGS' && (
        <div className="bg-white border border-mango-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-mango-100 flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-sm text-ink">Security & Audit Activity Log</h3>
              <p className="text-[11px] text-stone-500">Immutable ledger of all modifications, invoices, and logins</p>
            </div>
            <span className="bg-mango-50/60 px-2.5 py-1 rounded-lg text-xs font-mono text-leaf-600">
              {auditLogs.length} Events Logged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-mango-50/60 text-stone-500 uppercase text-[10px]">
                <tr>
                  <th className="p-3.5 pl-5">Timestamp</th>
                  <th className="p-3.5">User & Role</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Details</th>
                  <th className="p-3.5">IP Address</th>
                  <th className="p-3.5 pr-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mango-100 font-mono text-[11px]">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-mango-50/60">
                    <td className="p-3.5 pl-5 text-stone-500">{log.timestamp}</td>
                    <td className="p-3.5 font-sans">
                      <span className="font-bold text-ink">{log.userName}</span>
                      <span className="block text-[10px] text-stone-500">{log.role}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="bg-mango-50/60 px-1.5 py-0.5 rounded text-[10px] text-wave-700 font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-sans text-stone-800">{log.details}</td>
                    <td className="p-3.5 text-stone-500">{log.ipAddress}</td>
                    <td className="p-3.5 pr-5 text-center">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500/15 text-leaf-600'
                            : 'bg-amber-500/15 text-mango-600'
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
