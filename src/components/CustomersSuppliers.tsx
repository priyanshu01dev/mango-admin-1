import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { Party } from '../types';
import { formatINR, TRANSLATIONS, INDIAN_STATES } from '../utils/formatters';
import { Users2, PlusCircle, Search, Phone, Mail, MapPin, Building, ArrowUpRight, ArrowDownLeft, X, FileText } from 'lucide-react';

export const CustomersSuppliers: React.FC = () => {
  const { language, activeBusiness, parties, addParty, updateParty, invoices } = useBilling();
  const t = TRANSLATIONS[language];

  const [activeTab, setActiveTab] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPartyForLedger, setSelectedPartyForLedger] = useState<Party | null>(null);

  // New party form
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [address, setAddress] = useState('');
  const [stateCode, setStateCode] = useState(activeBusiness.stateCode);
  const [creditLimit, setCreditLimit] = useState(100000);

  const filteredParties = parties.filter(p => {
    const matchesBiz = p.businessId === activeBusiness.id;
    const matchesType = p.type === activeTab;
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone.includes(searchTerm) ||
      (p.gstin && p.gstin.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesBiz && matchesType && matchesSearch;
  });

  const totalReceivables = parties
    .filter(p => p.businessId === activeBusiness.id && p.type === 'CUSTOMER' && p.currentBalance > 0)
    .reduce((acc, p) => acc + p.currentBalance, 0);

  const totalPayables = parties
    .filter(p => p.businessId === activeBusiness.id && p.type === 'SUPPLIER')
    .reduce((acc, p) => acc + Math.abs(p.currentBalance), 0);

  const handleSaveParty = (e: React.FormEvent) => {
    e.preventDefault();
    addParty({
      businessId: activeBusiness.id,
      type: activeTab,
      name,
      contactPerson,
      phone,
      email,
      gstin,
      pan: pan || (gstin ? gstin.slice(2, 12) : ''),
      billingAddress: address,
      state: INDIAN_STATES[stateCode] || 'Delhi',
      stateCode,
      openingBalance: 0,
      currentBalance: 0,
      creditLimit: activeTab === 'CUSTOMER' ? creditLimit : undefined,
      status: 'ACTIVE'
    });

    setIsAddModalOpen(false);
    setName('');
    setPhone('+91 ');
    setGstin('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Balance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Receivables (Customers)</span>
            <div className="text-2xl font-black text-rose-400 mt-1">{formatINR(totalReceivables)}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Amount to collect from buyers</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Payables (Suppliers)</span>
            <div className="text-2xl font-black text-amber-400 mt-1">{formatINR(totalPayables)}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Amount to pay for stock purchases</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Action Bar & Tabs */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTab('CUSTOMER')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'CUSTOMER' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {language === 'hi' ? 'ग्राहक (Customers)' : 'Customers'}
            </button>
            <button
              onClick={() => setActiveTab('SUPPLIER')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'SUPPLIER' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {language === 'hi' ? 'सप्लायर (Suppliers)' : 'Suppliers'}
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, phone or GSTIN..."
              className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 w-52 sm:w-64"
            />
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs shadow-md shadow-emerald-500/20"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Add {activeTab === 'CUSTOMER' ? 'Customer' : 'Supplier'}</span>
        </button>
      </div>

      {/* Parties Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5 pl-5">Party Name</th>
                <th className="p-3.5">Contact</th>
                <th className="p-3.5">GSTIN / State</th>
                <th className="p-3.5">Address</th>
                <th className="p-3.5 text-right">Balance</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 pr-5 text-right">Statement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredParties.map(party => (
                <tr key={party.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 pl-5">
                    <div className="font-bold text-white text-xs">{party.name}</div>
                    {party.contactPerson && (
                      <div className="text-[10px] text-slate-400">Attn: {party.contactPerson}</div>
                    )}
                  </td>

                  <td className="p-3.5">
                    <div className="text-slate-200 font-mono">{party.phone}</div>
                    {party.email && <div className="text-[10px] text-slate-400">{party.email}</div>}
                  </td>

                  <td className="p-3.5">
                    <div className="font-mono text-emerald-400 font-semibold">{party.gstin || 'Consumer'}</div>
                    <div className="text-[10px] text-slate-400">{party.state} ({party.stateCode})</div>
                  </td>

                  <td className="p-3.5 text-slate-400 max-w-xs truncate">{party.billingAddress}</td>

                  <td className="p-3.5 text-right font-mono font-bold text-sm">
                    {party.currentBalance > 0 ? (
                      <span className="text-rose-400">{formatINR(party.currentBalance)}</span>
                    ) : party.currentBalance < 0 ? (
                      <span className="text-amber-400">{formatINR(Math.abs(party.currentBalance))}</span>
                    ) : (
                      <span className="text-emerald-400">₹0.00</span>
                    )}
                  </td>

                  <td className="p-3.5 text-center">
                    <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      {party.status}
                    </span>
                  </td>

                  <td className="p-3.5 pr-5 text-right">
                    <button
                      onClick={() => setSelectedPartyForLedger(party)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="View Ledger Statement"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEDGER STATEMENT MODAL */}
      {selectedPartyForLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-white">Party Account Ledger: {selectedPartyForLedger.name}</h3>
                <p className="text-[10px] text-slate-400">GSTIN: {selectedPartyForLedger.gstin || 'Unregistered'} • {selectedPartyForLedger.phone}</p>
              </div>
              <button onClick={() => setSelectedPartyForLedger(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
              <div>
                <span className="text-slate-400">Current Outstanding Balance:</span>
                <div className="text-xl font-bold font-mono text-rose-400">
                  {formatINR(selectedPartyForLedger.currentBalance)}
                </div>
              </div>
              {selectedPartyForLedger.creditLimit && (
                <div className="text-right">
                  <span className="text-slate-400">Credit Limit:</span>
                  <div className="font-mono text-slate-200">{formatINR(selectedPartyForLedger.creditLimit)}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="font-bold text-slate-300 uppercase text-[10px]">Associated Tax Invoices</span>
              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-400 text-[10px]">
                    <tr>
                      <th className="p-2">Invoice #</th>
                      <th className="p-2">Date</th>
                      <th className="p-2 text-right">Invoice Total</th>
                      <th className="p-2 text-right">Paid</th>
                      <th className="p-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {invoices
                      .filter(i => i.customerId === selectedPartyForLedger.id || i.customerName === selectedPartyForLedger.name)
                      .map(inv => (
                        <tr key={inv.id}>
                          <td className="p-2 font-mono text-emerald-400">{inv.invoiceNumber}</td>
                          <td className="p-2 text-slate-400">{inv.invoiceDate}</td>
                          <td className="p-2 text-right font-mono">{formatINR(inv.grandTotal)}</td>
                          <td className="p-2 text-right font-mono text-emerald-400">{formatINR(inv.amountPaid)}</td>
                          <td className="p-2 text-right font-mono font-bold text-rose-400">{formatINR(inv.balanceDue)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedPartyForLedger(null)}
                className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PARTY MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Add New {activeTab === 'CUSTOMER' ? 'Customer' : 'Supplier'}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveParty} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Business / Individual Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Apex Infotech Solutions"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98110 00000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="billing@company.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">GSTIN Number (Optional)</label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={e => setGstin(e.target.value.toUpperCase())}
                    placeholder="07AAAAA0000A1Z5"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">State & State Code</label>
                  <select
                    value={stateCode}
                    onChange={e => setStateCode(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    {Object.entries(INDIAN_STATES).map(([c, s]) => (
                      <option key={c} value={c}>{c} - {s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Billing Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Street, City, Pincode"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Save Party
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
