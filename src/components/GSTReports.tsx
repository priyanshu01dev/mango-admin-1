import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { useDocuments } from '../context/DocumentsContext';
import { get, errMsg } from '../api/client';
import { formatINR, TRANSLATIONS } from '../utils/formatters';
import { FileCheck2, Download, Table, FileSpreadsheet, ShieldCheck, Printer, CheckCircle2 } from 'lucide-react';

export const GSTReports: React.FC = () => {
  const { language, activeBusiness, invoices, showToast } = useBilling();
  // GSTR-1 is filed for the previous month by default
  const [gstrPeriod, setGstrPeriod] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const t = TRANSLATIONS[language];

  const [activeReportTab, setActiveReportTab] = useState<'GSTR1' | 'GSTR3B' | 'HSN'>('GSTR1');

  const { documents, expenses } = useDocuments();
  // cancelled invoices stay in the register but carry no tax liability
  const currentInvoices = invoices.filter(i => i.businessId === activeBusiness.id && i.status !== 'CANCELLED');
  const liveDocs = documents.filter(d => d.businessId === activeBusiness.id && d.status !== 'CANCELLED');
  const creditNotes = liveDocs.filter(d => d.docType === 'CREDIT_NOTE');
  const cn = {
    taxable: creditNotes.reduce((a, d) => a + d.taxableTotal, 0),
    igst: creditNotes.reduce((a, d) => a + d.igstTotal, 0),
    cgst: creditNotes.reduce((a, d) => a + d.cgstTotal, 0),
    sgst: creditNotes.reduce((a, d) => a + d.sgstTotal, 0)
  };
  // Table 4: eligible ITC from purchase bills (less debit notes) + expenses with vendor GSTIN
  const itcBills = liveDocs.filter(d => d.docType === 'PURCHASE_BILL' && d.itcEligible !== false);
  const debitNotes = liveDocs.filter(d => d.docType === 'DEBIT_NOTE');
  const itcExp = expenses.filter(e => e.businessId === activeBusiness.id && e.itcEligible);
  const itc = {
    igst: itcBills.reduce((a, d) => a + d.igstTotal, 0) - debitNotes.reduce((a, d) => a + d.igstTotal, 0),
    cgst: itcBills.reduce((a, d) => a + d.cgstTotal, 0) - debitNotes.reduce((a, d) => a + d.cgstTotal, 0) + itcExp.reduce((a, e) => a + e.gstAmount / 2, 0),
    sgst: itcBills.reduce((a, d) => a + d.sgstTotal, 0) - debitNotes.reduce((a, d) => a + d.sgstTotal, 0) + itcExp.reduce((a, e) => a + e.gstAmount / 2, 0)
  };

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
  const totalTaxLiability = totalCgst + totalSgst + totalIgst - (cn.igst + cn.cgst + cn.sgst);
  const totalItc = itc.igst + itc.cgst + itc.sgst;
  const netPayable = Math.max(0, totalTaxLiability - totalItc);

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

  // GSTR-1 JSON in the portal / offline-tool format, built by the server for the chosen month
  const downloadJsonForGstPortal = async () => {
    try {
      const json = await get<{ fp: string }>(`/api/reports/gstr1/json?period=${gstrPeriod}`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR1_${activeBusiness.gstin || 'NA'}_${json.fp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(errMsg(e));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-mango-100 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-black text-ink">{t.gstReports}</h2>
            <span className="bg-indigo-500/10 text-wave-700 text-xs px-2.5 py-0.5 rounded-full border border-indigo-500/20 font-bold">
              FY 2026-27
            </span>
          </div>
          <p className="text-stone-500 text-xs mt-0.5">
            {language === 'hi'
              ? 'जीएसटी पोर्टल (GST Portal) के नियमों के अनुसार GSTR-1, GSTR-3B और HSN सारांश रिपोर्ट'
              : 'Official GST returns summaries ready for offline tool export and filing'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <input type="month" value={gstrPeriod} onChange={e => setGstrPeriod(e.target.value)} className="bg-white border border-mango-200/70 rounded-lg px-2 py-1.5 text-xs" aria-label="Return period" />
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
      <div className="flex bg-white p-1.5 rounded-xl border border-mango-100 w-fit">
        <button
          onClick={() => setActiveReportTab('GSTR1')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeReportTab === 'GSTR1' ? 'bg-mango-500 text-white shadow-sm' : 'text-stone-500 hover:text-ink'
          }`}
        >
          GSTR-1 Outward Supplies
        </button>
        <button
          onClick={() => setActiveReportTab('GSTR3B')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeReportTab === 'GSTR3B' ? 'bg-mango-500 text-white shadow-sm' : 'text-stone-500 hover:text-ink'
          }`}
        >
          GSTR-3B Tax Liability
        </button>
        <button
          onClick={() => setActiveReportTab('HSN')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeReportTab === 'HSN' ? 'bg-mango-500 text-white shadow-sm' : 'text-stone-500 hover:text-ink'
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
            <div className="bg-white border border-mango-100 p-5 rounded-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-mango-100">
                <span className="font-extrabold text-sm text-ink">4A, 4B, 4C, 6B - B2B Invoices</span>
                <span className="bg-emerald-500/15 text-leaf-600 text-xs px-2 py-0.5 rounded-full font-bold">
                  {b2bInvoices.length} Invoices
                </span>
              </div>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between text-stone-500">
                  <span>Total Taxable Value:</span>
                  <span className="font-bold font-mono text-ink">{formatINR(b2bTaxable)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Central Tax (CGST):</span>
                  <span className="font-mono text-stone-700">{formatINR(b2bCgst)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>State Tax (SGST):</span>
                  <span className="font-mono text-stone-700">{formatINR(b2bSgst)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Integrated Tax (IGST):</span>
                  <span className="font-mono text-stone-700">{formatINR(b2bIgst)}</span>
                </div>
                <div className="flex justify-between text-ink font-bold border-t border-mango-100 pt-2">
                  <span>Total GST:</span>
                  <span className="font-mono text-leaf-600">{formatINR(b2bCgst + b2bSgst + b2bIgst)}</span>
                </div>
              </div>
            </div>

            {/* 7 - B2C Small */}
            <div className="bg-white border border-mango-100 p-5 rounded-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-mango-100">
                <span className="font-extrabold text-sm text-ink">7 - B2C (Others / Retail Consumers)</span>
                <span className="bg-teal-500/15 text-teal-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {b2csInvoices.length} Invoices
                </span>
              </div>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between text-stone-500">
                  <span>Total Taxable Value:</span>
                  <span className="font-bold font-mono text-ink">{formatINR(b2csTaxable)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Central Tax (CGST):</span>
                  <span className="font-mono text-stone-700">{formatINR(b2csCgst)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>State Tax (SGST):</span>
                  <span className="font-mono text-stone-700">{formatINR(b2csSgst)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Integrated Tax (IGST):</span>
                  <span className="font-mono text-stone-700">{formatINR(b2csIgst)}</span>
                </div>
                <div className="flex justify-between text-ink font-bold border-t border-mango-100 pt-2">
                  <span>Total GST:</span>
                  <span className="font-mono text-teal-700">{formatINR(b2csCgst + b2csSgst + b2csIgst)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GSTR-3B */}
      {activeReportTab === 'GSTR3B' && (
        <div className="bg-white border border-mango-100 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-mango-100 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-ink">
                Table 3.1 - Details of Outward Supplies and inward supplies liable to reverse charge
              </h3>
              <p className="text-[11px] text-stone-500">Legal Tax Liability for Month of November 2026</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-stone-500">Total Tax Liability:</span>
              <div className="text-xl font-bold font-mono text-leaf-600">{formatINR(totalTaxLiability)}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-mango-50/60 text-stone-500 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Nature of Supplies</th>
                  <th className="p-3 text-right">Total Taxable Value (₹)</th>
                  <th className="p-3 text-right">Integrated Tax (IGST)</th>
                  <th className="p-3 text-right">Central Tax (CGST)</th>
                  <th className="p-3 text-right">State Tax (SGST)</th>
                  <th className="p-3 text-right">Cess (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mango-100 font-mono">
                <tr>
                  <td className="p-3 font-sans font-semibold text-ink">
                    (a) Outward taxable supplies (other than zero rated, nil rated and exempted)
                  </td>
                  <td className="p-3 text-right font-bold text-ink">{formatINR(totalTaxable)}</td>
                  <td className="p-3 text-right text-wave-700">{formatINR(totalIgst)}</td>
                  <td className="p-3 text-right text-wave-700">{formatINR(totalCgst)}</td>
                  <td className="p-3 text-right text-wave-700">{formatINR(totalSgst)}</td>
                  <td className="p-3 text-right text-stone-400">₹0.00</td>
                </tr>
                {creditNotes.length > 0 && (
                  <tr>
                    <td className="p-3 font-sans font-semibold text-ink">Less: credit notes / sales returns ({creditNotes.length})</td>
                    <td className="p-3 text-right text-rose-600">({formatINR(cn.taxable)})</td>
                    <td className="p-3 text-right text-rose-600">({formatINR(cn.igst)})</td>
                    <td className="p-3 text-right text-rose-600">({formatINR(cn.cgst)})</td>
                    <td className="p-3 text-right text-rose-600">({formatINR(cn.sgst)})</td>
                    <td className="p-3 text-right text-stone-400">₹0.00</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-mango-100 pt-4">
            <h3 className="font-extrabold text-sm text-ink">Table 4 - Eligible ITC</h3>
            <p className="text-[11px] text-stone-500">
              From {itcBills.length} purchase bills (less {debitNotes.length} debit notes) and {itcExp.length} expenses with vendor GSTIN. Match against GSTR-2B before claiming.
            </p>
            <table className="w-full text-left text-xs text-stone-700 mt-2">
              <thead className="bg-mango-50/60 text-stone-500 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Details</th>
                  <th className="p-3 text-right">IGST</th>
                  <th className="p-3 text-right">CGST</th>
                  <th className="p-3 text-right">SGST</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mango-100 font-mono">
                <tr>
                  <td className="p-3 font-sans font-semibold text-ink">(A)(5) All other ITC</td>
                  <td className="p-3 text-right text-leaf-700">{formatINR(itc.igst)}</td>
                  <td className="p-3 text-right text-leaf-700">{formatINR(itc.cgst)}</td>
                  <td className="p-3 text-right text-leaf-700">{formatINR(itc.sgst)}</td>
                  <td className="p-3 text-right font-bold text-ink">{formatINR(totalItc)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="bg-mango-50 border border-mango-200 rounded-xl p-4 w-full max-w-sm text-xs space-y-1 font-mono">
              <div className="flex justify-between"><span className="font-sans text-stone-600">Output tax liability</span><span>{formatINR(totalTaxLiability)}</span></div>
              <div className="flex justify-between"><span className="font-sans text-stone-600">Less: ITC</span><span className="text-leaf-700">({formatINR(totalItc)})</span></div>
              <div className="flex justify-between border-t border-mango-200 pt-1.5 text-sm font-black text-ink"><span className="font-sans">Net GST payable (cash)</span><span>{formatINR(netPayable)}</span></div>
              {totalItc > totalTaxLiability && (
                <div className="font-sans text-[10px] text-stone-500">ITC of {formatINR(totalItc - totalTaxLiability)} carries forward to the next period.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HSN SUMMARY TABLE */}
      {activeReportTab === 'HSN' && (
        <div className="bg-white border border-mango-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-mango-100 flex justify-between items-center">
            <h3 className="font-extrabold text-sm text-ink">Table 12 - HSN Wise Summary of Outward Supplies</h3>
            <span className="text-xs text-stone-500 font-mono">{hsnList.length} Unique HSN Codes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-mango-50/60 text-stone-500 uppercase text-[10px]">
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
              <tbody className="divide-y divide-mango-100 font-mono">
                {hsnList.map(h => (
                  <tr key={h.hsn} className="hover:bg-mango-50/60">
                    <td className="p-3 pl-5 font-bold text-leaf-600">{h.hsn}</td>
                    <td className="p-3 font-sans text-ink">{h.name}</td>
                    <td className="p-3 text-center">{h.unit}</td>
                    <td className="p-3 text-right">{h.qty}</td>
                    <td className="p-3 text-right font-bold text-ink">{formatINR(h.totalVal)}</td>
                    <td className="p-3 text-right">{formatINR(h.taxableVal)}</td>
                    <td className="p-3 text-right text-wave-700">{formatINR(h.igst)}</td>
                    <td className="p-3 text-right text-wave-700">{formatINR(h.cgst)}</td>
                    <td className="p-3 pr-5 text-right text-wave-700">{formatINR(h.sgst)}</td>
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
