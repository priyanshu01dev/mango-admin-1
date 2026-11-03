import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { formatINR, TRANSLATIONS } from '../utils/formatters';
import { FileCheck2, Download, Table, FileSpreadsheet, ShieldCheck, Printer, CheckCircle2 } from 'lucide-react';

export const GSTReports: React.FC = () => {
  const { language, activeBusiness, invoices } = useBilling();
  const t = TRANSLATIONS[language];

  const [activeReportTab, setActiveReportTab] = useState<'GSTR1' | 'GSTR3B' | 'HSN'>('GSTR1');

  const currentInvoices = invoices.filter(i => i.businessId === activeBusiness.id);

  // GSTR-1 Sections:
  // 1. B2B (Invoices with customer GSTIN)
  const b2bInvoices = currentInvoices.filter(i => !!i.customerGstin && i.customerGstin.trim().length > 5);
  // 2. B2CS (Invoices without customer GSTIN, Intra-state or < 2.5L)
  const b2csInvoices = currentInvoices.filter(i => !i.customerGstin || i.customerGstin.trim().length <= 5);

  const b2bTaxable = b2bInvoices.reduce((acc, i) => acc + i.taxableTotal, 0);
  const b2bCgst = b2bInvoices.reduce((acc, i) => acc + i.cgstTotal, 0);
  const b2bSgst = b2bInvoices.reduce((acc, i) => acc + i.sgstTotal, 0);
  const b2bIgst = b2bInvoices.reduce((acc, i) => acc + i.igstTotal, 0);

  const b2csTaxable = b2csInvoices.reduce((acc, i) => acc + i.taxableTotal, 0);
  const b2csCgst = b2csInvoices.reduce((acc, i) => acc + i.cgstTotal, 0);
  const b2csSgst = b2csInvoices.reduce((acc, i) => acc + i.sgstTotal, 0);
  const b2csIgst = b2csInvoices.reduce((acc, i) => acc + i.igstTotal, 0);

  // GSTR-3B Totals
  const totalTaxable = currentInvoices.reduce((acc, i) => acc + i.taxableTotal, 0);
  const totalCgst = currentInvoices.reduce((acc, i) => acc + i.cgstTotal, 0);
  const totalSgst = currentInvoices.reduce((acc, i) => acc + i.sgstTotal, 0);
  const totalIgst = currentInvoices.reduce((acc, i) => acc + i.igstTotal, 0);
  const totalTaxLiability = totalCgst + totalSgst + totalIgst;

  // HSN Summary aggregation
  const hsnMap: Record<string, { hsn: string; name: string; qty: number; unit: string; totalVal: number; taxableVal: number; cgst: number; sgst: number; igst: number }> = {};
  currentInvoices.forEach(inv => {
    inv.items.forEach(item => {
      const code = item.hsnCode || 'OTHER';
      if (!hsnMap[code]) {
        hsnMap[code] = {
          hsn: code,
          name: item.name,
          qty: 0,
          unit: item.unit,
          totalVal: 0,
          taxableVal: 0,
          cgst: 0,
          sgst: 0,
          igst: 0
        };
      }
      hsnMap[code].qty += item.quantity;
      hsnMap[code].totalVal += item.totalAmount;
      hsnMap[code].taxableVal += item.taxableAmount;
      hsnMap[code].cgst += item.cgstAmount;
      hsnMap[code].sgst += item.sgstAmount;
      hsnMap[code].igst += item.igstAmount;
    });
  });

  const hsnList = Object.values(hsnMap);

  const downloadJsonForGstPortal = () => {
    const payload = {
      gstin: activeBusiness.gstin,
      fp: '112026', // Return Period Nov 2026
      gt: totalTaxable,
      cur_gt: totalTaxable,
      b2b: b2bInvoices.map(inv => ({
        ctin: inv.customerGstin,
        inv: [
          {
            inum: inv.invoiceNumber,
            idt: inv.invoiceDate,
            val: inv.grandTotal,
            pos: inv.customerStateCode,
            rchrg: 'N',
            inv_typ: 'R',
            itms: inv.items.map(it => ({
              num: 1,
              itm_det: {
                rt: it.gstRate,
                txval: it.taxableAmount,
                iamt: it.igstAmount,
                camt: it.cgstAmount,
                samt: it.sgstAmount,
                csamt: 0
              }
            }))
          }
        ]
      })),
      b2cs: [
        {
          sply_ty: 'INTRA',
          pos: activeBusiness.stateCode,
          txval: b2csTaxable,
          rt: 18,
          camt: b2csCgst,
          samt: b2csSgst,
          csamt: 0
        }
      ],
      hsn: {
        data: hsnList.map((h, i) => ({
          num: i + 1,
          hsn_sc: h.hsn,
          desc: h.name,
          uqc: h.unit,
          qty: h.qty,
          val: h.totalVal,
          txval: h.taxableVal,
          iamt: h.igst,
          camt: h.cgst,
          samt: h.sgst,
          csamt: 0
        }))
      }
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_${activeBusiness.gstin}_Nov2026.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-black text-white">{t.gstReports}</h2>
            <span className="bg-indigo-500/10 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full border border-indigo-500/20 font-bold">
              FY 2026-27
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {language === 'hi'
              ? 'जीएसटी पोर्टल (GST Portal) के नियमों के अनुसार GSTR-1, GSTR-3B और HSN सारांश रिपोर्ट'
              : 'Official GST returns summaries ready for offline tool export and filing'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={downloadJsonForGstPortal}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export GST Portal JSON</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-fit">
        <button
          onClick={() => setActiveReportTab('GSTR1')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeReportTab === 'GSTR1' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          GSTR-1 Outward Supplies
        </button>
        <button
          onClick={() => setActiveReportTab('GSTR3B')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeReportTab === 'GSTR3B' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          GSTR-3B Tax Liability
        </button>
        <button
          onClick={() => setActiveReportTab('HSN')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeReportTab === 'HSN' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          HSN Wise Summary Table
        </button>
      </div>

      {/* TAB 1: GSTR-1 */}
      {activeReportTab === 'GSTR1' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 4A - B2B Invoices */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-extrabold text-sm text-white">4A, 4B, 4C, 6B - B2B Invoices</span>
                <span className="bg-emerald-500/15 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-bold">
                  {b2bInvoices.length} Invoices
                </span>
              </div>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Total Taxable Value:</span>
                  <span className="font-bold font-mono text-white">{formatINR(b2bTaxable)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Central Tax (CGST):</span>
                  <span className="font-mono text-slate-300">{formatINR(b2bCgst)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>State Tax (SGST):</span>
                  <span className="font-mono text-slate-300">{formatINR(b2bSgst)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Integrated Tax (IGST):</span>
                  <span className="font-mono text-slate-300">{formatINR(b2bIgst)}</span>
                </div>
                <div className="flex justify-between text-white font-bold border-t border-slate-800 pt-2">
                  <span>Total GST:</span>
                  <span className="font-mono text-emerald-400">{formatINR(b2bCgst + b2bSgst + b2bIgst)}</span>
                </div>
              </div>
            </div>

            {/* 7 - B2C Small */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-extrabold text-sm text-white">7 - B2C (Others / Retail Consumers)</span>
                <span className="bg-teal-500/15 text-teal-300 text-xs px-2 py-0.5 rounded-full font-bold">
                  {b2csInvoices.length} Invoices
                </span>
              </div>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Total Taxable Value:</span>
                  <span className="font-bold font-mono text-white">{formatINR(b2csTaxable)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Central Tax (CGST):</span>
                  <span className="font-mono text-slate-300">{formatINR(b2csCgst)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>State Tax (SGST):</span>
                  <span className="font-mono text-slate-300">{formatINR(b2csSgst)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Integrated Tax (IGST):</span>
                  <span className="font-mono text-slate-300">{formatINR(b2csIgst)}</span>
                </div>
                <div className="flex justify-between text-white font-bold border-t border-slate-800 pt-2">
                  <span>Total GST:</span>
                  <span className="font-mono text-teal-300">{formatINR(b2csCgst + b2csSgst + b2csIgst)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GSTR-3B */}
      {activeReportTab === 'GSTR3B' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-white">
                Table 3.1 - Details of Outward Supplies and inward supplies liable to reverse charge
              </h3>
              <p className="text-[11px] text-slate-400">Legal Tax Liability for Month of November 2026</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400">Total Tax Liability:</span>
              <div className="text-xl font-bold font-mono text-emerald-400">{formatINR(totalTaxLiability)}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Nature of Supplies</th>
                  <th className="p-3 text-right">Total Taxable Value (₹)</th>
                  <th className="p-3 text-right">Integrated Tax (IGST)</th>
                  <th className="p-3 text-right">Central Tax (CGST)</th>
                  <th className="p-3 text-right">State Tax (SGST)</th>
                  <th className="p-3 text-right">Cess (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                <tr>
                  <td className="p-3 font-sans font-semibold text-white">
                    (a) Outward taxable supplies (other than zero rated, nil rated and exempted)
                  </td>
                  <td className="p-3 text-right font-bold text-white">{formatINR(totalTaxable)}</td>
                  <td className="p-3 text-right text-indigo-300">{formatINR(totalIgst)}</td>
                  <td className="p-3 text-right text-indigo-300">{formatINR(totalCgst)}</td>
                  <td className="p-3 text-right text-indigo-300">{formatINR(totalSgst)}</td>
                  <td className="p-3 text-right text-slate-500">₹0.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: HSN SUMMARY TABLE */}
      {activeReportTab === 'HSN' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-extrabold text-sm text-white">Table 12 - HSN Wise Summary of Outward Supplies</h3>
            <span className="text-xs text-slate-400 font-mono">{hsnList.length} Unique HSN Codes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3 pl-5">HSN Code</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-center">UQC</th>
                  <th className="p-3 text-right">Total Qty</th>
                  <th className="p-3 text-right">Total Value (₹)</th>
                  <th className="p-3 text-right">Taxable Value (₹)</th>
                  <th className="p-3 text-right">Integrated Tax</th>
                  <th className="p-3 text-right">Central Tax</th>
                  <th className="p-3 pr-5 text-right">State Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {hsnList.map(h => (
                  <tr key={h.hsn} className="hover:bg-slate-800/40">
                    <td className="p-3 pl-5 font-bold text-emerald-400">{h.hsn}</td>
                    <td className="p-3 font-sans text-white">{h.name}</td>
                    <td className="p-3 text-center">{h.unit}</td>
                    <td className="p-3 text-right">{h.qty}</td>
                    <td className="p-3 text-right font-bold text-white">{formatINR(h.totalVal)}</td>
                    <td className="p-3 text-right">{formatINR(h.taxableVal)}</td>
                    <td className="p-3 text-right text-indigo-300">{formatINR(h.igst)}</td>
                    <td className="p-3 text-right text-indigo-300">{formatINR(h.cgst)}</td>
                    <td className="p-3 pr-5 text-right text-indigo-300">{formatINR(h.sgst)}</td>
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
