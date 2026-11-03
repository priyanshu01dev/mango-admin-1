import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { Quotation, InvoiceItem } from '../types';
import { formatINR, formatDate, TRANSLATIONS, INDIAN_STATES } from '../utils/formatters';
import { PlusCircle, Search, ArrowRightLeft, FileSpreadsheet, CheckCircle2, Clock, Trash2, X } from 'lucide-react';

export const Quotations: React.FC = () => {
  const {
    language,
    activeBusiness,
    quotations,
    addQuotation,
    convertQuotationToInvoice,
    parties,
    products
  } = useBilling();

  const t = TRANSLATIONS[language];
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Quotation form
  const [selectedCustomerId, setSelectedCustomerId] = useState(parties[0]?.id || '');
  const [quotNumber, setQuotNumber] = useState(() => 'EST/2026/00' + (quotations.length + 89));
  const [validDays, setValidDays] = useState(15);
  const [notes, setNotes] = useState('Quotation valid for 15 days. Prices inclusive of GST.');

  const [formItems, setFormItems] = useState<InvoiceItem[]>([
    {
      id: 'qitem-1',
      productId: products[1]?.id,
      name: products[1]?.name || 'Schneider 16A Modular Switch',
      hsnCode: products[1]?.hsnCode || '8536',
      quantity: 50,
      unit: products[1]?.unit || 'PCS',
      price: products[1]?.sellingPrice || 140,
      discountPercent: 5,
      gstRate: 18,
      taxableAmount: 6650,
      cgstAmount: 598.5,
      sgstAmount: 598.5,
      igstAmount: 0,
      totalAmount: 7847
    }
  ]);

  const currentQuotations = quotations.filter(q => {
    const matchesBiz = q.businessId === activeBusiness.id;
    const matchesSearch =
      q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesBiz && matchesSearch;
  });

  const handleSaveQuotation = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = parties.find(p => p.id === selectedCustomerId);
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + validDays);

    const isInter = cust ? cust.stateCode !== activeBusiness.stateCode : false;
    const grandTotal = formItems.reduce((acc, i) => acc + i.totalAmount, 0);

    addQuotation({
      quotationNumber: quotNumber,
      businessId: activeBusiness.id,
      customerId: selectedCustomerId,
      customerName: cust?.name || 'Walk-in Customer',
      customerGstin: cust?.gstin,
      customerPhone: cust?.phone || '+91 99999 99999',
      customerAddress: cust?.billingAddress || '',
      customerStateCode: cust?.stateCode || activeBusiness.stateCode,
      date: new Date().toISOString().slice(0, 10),
      validUntil: validUntilDate.toISOString().slice(0, 10),
      isInterState: isInter,
      items: formItems,
      grandTotal: Math.round(grandTotal),
      status: 'SENT',
      notes
    });

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">{t.quotations}</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            {language === 'hi' ? 'कोटेशन / एस्टिमेट बनाएं और 1-क्लिक में GST बिल में बदलें' : 'Generate price estimates and convert directly to GST invoices'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search quotation..."
              className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 w-56"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs shadow-md shadow-emerald-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t.createQuotation}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5 pl-5">Quotation No</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Issue Date</th>
                <th className="p-3.5">Valid Until</th>
                <th className="p-3.5 text-right">Estimate Total</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 pr-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {currentQuotations.map(q => (
                <tr key={q.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 pl-5 font-mono font-bold text-white">{q.quotationNumber}</td>
                  <td className="p-3.5">
                    <div className="font-semibold text-slate-200">{q.customerName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{q.customerGstin || 'Consumer'}</div>
                  </td>
                  <td className="p-3.5 text-slate-400">{formatDate(q.date)}</td>
                  <td className="p-3.5 text-slate-400">{formatDate(q.validUntil)}</td>
                  <td className="p-3.5 text-right font-bold text-emerald-400 font-mono text-sm">
                    {formatINR(q.grandTotal)}
                  </td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        q.status === 'CONVERTED'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="p-3.5 pr-5 text-right">
                    {q.status !== 'CONVERTED' ? (
                      <button
                        onClick={() => convertQuotationToInvoice(q.id)}
                        className="flex items-center space-x-1.5 ml-auto px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>{t.convertInvoice}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Converted ✓</span>
                    )}
                  </td>
                </tr>
              ))}

              {currentQuotations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No quotations created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Create New Quotation / Estimate</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuotation} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Quotation Number</label>
                  <input
                    type="text"
                    required
                    value={quotNumber}
                    onChange={e => setQuotNumber(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Validity (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={validDays}
                    onChange={e => setValidDays(parseInt(e.target.value, 10) || 15)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Select Customer</label>
                <select
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                >
                  {parties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.phone}) - {p.state}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Notes / Terms</label>
                <textarea
                  rows={2}
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
                  Save Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
