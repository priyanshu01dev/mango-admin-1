import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { EWayBillRecord, EInvoiceRecord } from '../types';
import { formatINR, formatDate, TRANSLATIONS } from '../utils/formatters';
import { Truck, QrCode, FileText, CheckCircle2, AlertCircle, Printer, X, ShieldCheck } from 'lucide-react';

export const EWayBillEInvoice: React.FC = () => {
  const { language, activeBusiness, ewayBills, eInvoices, invoices } = useBilling();
  const t = TRANSLATIONS[language];

  const [activeSubTab, setActiveSubTab] = useState<'EWAY' | 'EINVOICE'>('EWAY');
  const [selectedEwbForPrint, setSelectedEwbForPrint] = useState<EWayBillRecord | null>(null);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-black text-white">{t.eWayEInvoice}</h2>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-bold">
              NIC Portal Connected
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {language === 'hi'
              ? 'राष्ट्रीय सूचना विज्ञान केंद्र (NIC) ई-वे बिल व 64-करैक्टर IRN ई-इनवॉइस जनरेटर'
              : 'National Informatics Centre (NIC) E-Way Bill and 64-character IRN e-Invoice engine'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveSubTab('EWAY')}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'EWAY'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>E-Way Bills ({ewayBills.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('EINVOICE')}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'EINVOICE'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>e-Invoices (IRN) ({eInvoices.length})</span>
          </button>
        </div>
      </div>

      {/* SubTab 1: E-Way Bills Table */}
      {activeSubTab === 'EWAY' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5 pl-5">EWB Number</th>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">From / To GSTIN</th>
                  <th className="p-3.5">Transporter & Vehicle</th>
                  <th className="p-3.5">Approx Dist</th>
                  <th className="p-3.5">Valid Upto</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 pr-5 text-right">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {ewayBills.map(ewb => (
                  <tr key={ewb.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 pl-5 font-mono font-bold text-emerald-400 text-sm">
                      {ewb.ewbNumber}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-white">{ewb.invoiceNumber}</td>
                    <td className="p-3.5 font-mono text-[11px]">
                      <div className="text-slate-200">From: {ewb.fromGstin}</div>
                      <div className="text-slate-400">To: {ewb.toGstin}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-200">{ewb.transporterName}</div>
                      <div className="text-[10px] font-mono text-amber-400 font-bold">{ewb.vehicleNumber}</div>
                    </td>
                    <td className="p-3.5">{ewb.approxDistanceKm} KM</td>
                    <td className="p-3.5 font-mono text-slate-300">{ewb.validUpto}</td>
                    <td className="p-3.5 text-center">
                      <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        {ewb.status}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      <button
                        onClick={() => setSelectedEwbForPrint(ewb)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Print E-Way Bill Slip"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SubTab 2: E-Invoices Table */}
      {activeSubTab === 'EINVOICE' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5 pl-5">Invoice #</th>
                  <th className="p-3.5">IRN (Invoice Reference Number)</th>
                  <th className="p-3.5">Ack Number & Date</th>
                  <th className="p-3.5">Buyer GSTIN</th>
                  <th className="p-3.5 text-right">Invoice Value</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {eInvoices.map(einv => (
                  <tr key={einv.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 pl-5 font-mono font-bold text-white">{einv.invoiceNumber}</td>
                    <td className="p-3.5 font-mono text-[10px] text-teal-300 max-w-xs truncate" title={einv.irn}>
                      {einv.irn}
                    </td>
                    <td className="p-3.5 font-mono text-[11px]">
                      <div className="font-bold text-slate-200">Ack: {einv.ackNo}</div>
                      <div className="text-[10px] text-slate-400">{einv.ackDate}</div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">{einv.buyerGstin}</td>
                    <td className="p-3.5 text-right font-bold text-white font-mono">{formatINR(einv.totalValue)}</td>
                    <td className="p-3.5 text-center">
                      <span className="bg-teal-500/15 text-teal-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-500/30">
                        {einv.status} ✓
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRINTABLE E-WAY BILL SLIP MODAL */}
      {selectedEwbForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white text-slate-900 rounded-2xl p-6 max-w-xl w-full shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-300">
              <div className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-indigo-700" />
                <span className="font-extrabold text-sm uppercase tracking-wider text-slate-900">
                  Government of India • e-Way Bill Slip
                </span>
              </div>
              <button onClick={() => setSelectedEwbForPrint(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border border-slate-300 rounded p-4 space-y-3 font-mono text-[11px] bg-slate-50">
              <div className="flex justify-between border-b pb-2 border-slate-200">
                <span>e-Way Bill No:</span>
                <strong className="text-slate-900 text-sm">{selectedEwbForPrint.ewbNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span>Generated Date:</span>
                <span>{selectedEwbForPrint.generatedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Valid Until:</span>
                <strong className="text-rose-700">{selectedEwbForPrint.validUpto}</strong>
              </div>
              <div className="flex justify-between">
                <span>Document:</span>
                <span>{selectedEwbForPrint.documentType} ({selectedEwbForPrint.invoiceNumber})</span>
              </div>
              <div className="border-t pt-2 border-slate-200">
                <strong>PART-A (Supply Details):</strong>
                <p>From: {selectedEwbForPrint.fromGstin} ({activeBusiness.name})</p>
                <p>To: {selectedEwbForPrint.toGstin}</p>
              </div>
              <div className="border-t pt-2 border-slate-200">
                <strong>PART-B (Vehicle Details):</strong>
                <p>Transporter: {selectedEwbForPrint.transporterName} ({selectedEwbForPrint.transporterId})</p>
                <p>Vehicle No: <strong className="text-slate-900">{selectedEwbForPrint.vehicleNumber}</strong></p>
                <p>Distance: {selectedEwbForPrint.approxDistanceKm} KM</p>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setSelectedEwbForPrint(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold"
              >
                Print Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
