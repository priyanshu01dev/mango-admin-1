import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { PaymentTransaction, PaymentMode } from '../types';
import { formatINR, formatDate, TRANSLATIONS } from '../utils/formatters';
import { Wallet, PlusCircle, Search, ArrowDownLeft, ArrowUpRight, CheckCircle2, X } from 'lucide-react';

export const Payments: React.FC = () => {
  const { language, activeBusiness, payments, recordPayment, parties, invoices } = useBilling();
  const t = TRANSLATIONS[language];

  const [activeType, setActiveType] = useState<'ALL' | 'PAYMENT_IN' | 'PAYMENT_OUT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Payment form
  const [payType, setPayType] = useState<'PAYMENT_IN' | 'PAYMENT_OUT'>('PAYMENT_IN');
  const [selectedPartyId, setSelectedPartyId] = useState(parties[0]?.id || '');
  const [amount, setAmount] = useState<number>(5000);
  const [mode, setMode] = useState<PaymentMode>('UPI');
  const [refNo, setRefNo] = useState('');
  const [notes, setNotes] = useState('Payment receipt confirmation');

  const filteredPayments = payments.filter(p => {
    const matchesBiz = p.businessId === activeBusiness.id;
    const matchesType = activeType === 'ALL' || p.type === activeType;
    const matchesSearch =
      p.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesBiz && matchesType && matchesSearch;
  });

  const totalIn = payments
    .filter(p => p.businessId === activeBusiness.id && p.type === 'PAYMENT_IN')
    .reduce((acc, p) => acc + p.amount, 0);

  const totalOut = payments
    .filter(p => p.businessId === activeBusiness.id && p.type === 'PAYMENT_OUT')
    .reduce((acc, p) => acc + p.amount, 0);

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const party = parties.find(p => p.id === selectedPartyId);
    recordPayment({
      businessId: activeBusiness.id,
      type: payType,
      partyId: selectedPartyId,
      partyName: party?.name || 'Walk-in Party',
      amount,
      paymentDate: new Date().toISOString().slice(0, 10),
      mode,
      referenceNumber: refNo || 'REC-' + Date.now().toString().slice(-6),
      notes
    });

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Received (Payment In)</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{formatINR(totalIn)}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Collections from customers via UPI, Bank, Cash</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Paid (Payment Out)</span>
            <div className="text-2xl font-black text-rose-400 mt-1">{formatINR(totalOut)}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Supplier payouts & business expenses</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            {(['ALL', 'PAYMENT_IN', 'PAYMENT_OUT'] as const).map(type => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeType === type ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {type === 'ALL' ? 'All Transactions' : type === 'PAYMENT_IN' ? 'Receipts (In)' : 'Payouts (Out)'}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by party, ref or invoice..."
              className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 w-52 sm:w-64"
            />
          </div>
        </div>

        {null}
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5 pl-5">Date & Ref</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Party Name</th>
                <th className="p-3.5">Associated Invoice</th>
                <th className="p-3.5">Mode</th>
                <th className="p-3.5 text-right">Amount (₹)</th>
                <th className="p-3.5 pr-5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredPayments.map(pay => (
                <tr key={pay.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 pl-5">
                    <div className="font-bold text-white text-xs">{formatDate(pay.paymentDate)}</div>
                    <div className="font-mono text-[10px] text-slate-400">{pay.referenceNumber}</div>
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        pay.type === 'PAYMENT_IN'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {pay.type === 'PAYMENT_IN' ? '↓ Payment In' : '↑ Payment Out'}
                    </span>
                  </td>

                  <td className="p-3.5 font-semibold text-slate-200">{pay.partyName}</td>
                  <td className="p-3.5 font-mono text-emerald-400">{pay.invoiceNumber || '-'}</td>

                  <td className="p-3.5">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300 border border-slate-700">
                      {pay.mode}
                    </span>
                  </td>

                  <td className="p-3.5 text-right font-mono font-bold text-sm">
                    <span className={pay.type === 'PAYMENT_IN' ? 'text-emerald-400' : 'text-rose-400'}>
                      {pay.type === 'PAYMENT_IN' ? '+' : '-'} {formatINR(pay.amount)}
                    </span>
                  </td>

                  <td className="p-3.5 pr-5 text-slate-400 text-[11px] max-w-xs truncate">{pay.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Record Payment Voucher</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayType('PAYMENT_IN')}
                  className={`p-2 rounded-xl border font-bold ${
                    payType === 'PAYMENT_IN'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  Payment In (Receipt)
                </button>
                <button
                  type="button"
                  onClick={() => setPayType('PAYMENT_OUT')}
                  className={`p-2 rounded-xl border font-bold ${
                    payType === 'PAYMENT_OUT'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  Payment Out (Payout)
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Party (Customer / Supplier)</label>
                <select
                  value={selectedPartyId}
                  onChange={e => setSelectedPartyId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                >
                  {parties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={amount}
                  onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-emerald-400 font-bold text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Payment Mode</label>
                  <select
                    value={mode}
                    onChange={e => setMode(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="NEFT_RTGS">Bank NEFT/RTGS</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Ref / UTR Number</label>
                  <input
                    type="text"
                    value={refNo}
                    onChange={e => setRefNo(e.target.value)}
                    placeholder="UPI-123456"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Remarks</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
