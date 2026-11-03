import React from 'react';
import { useBilling } from '../context/BillingContext';
import { formatINR, formatDate, TRANSLATIONS } from '../utils/formatters';
import {
  TrendingUp,
  Receipt,
  Users,
  AlertTriangle,
  ArrowUpRight,
  PlusCircle,
  Boxes,
  FileCheck2,
  Printer,
  Share2,
  ChevronRight,
  Clock,
  CheckCircle2,
  PackagePlus
} from 'lucide-react';
import { Invoice } from '../types';

interface DashboardProps {
  onOpenNewInvoice: () => void;
  onNavigateTab: (tab: any) => void;
  onSelectInvoiceForPrint: (inv: Invoice) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenNewInvoice,
  onNavigateTab,
  onSelectInvoiceForPrint
}) => {
  const {
    language,
    activeBusiness,
    businesses,
    invoices,
    products,
    adjustProductStock,
    showToast
  } = useBilling();

  const t = TRANSLATIONS[language];

  // Calculations for current active business
  const currentInvoices = invoices.filter(i => i.businessId === activeBusiness.id);
  const totalRevenue = currentInvoices.reduce((acc, i) => acc + i.grandTotal, 0);
  const totalPaid = currentInvoices.reduce((acc, i) => acc + i.amountPaid, 0);
  const totalBalanceDue = currentInvoices.reduce((acc, i) => acc + i.balanceDue, 0);
  const totalGstCollected = currentInvoices.reduce((acc, i) => acc + i.totalGst, 0);
  const totalCgst = currentInvoices.reduce((acc, i) => acc + i.cgstTotal, 0);
  const totalSgst = currentInvoices.reduce((acc, i) => acc + i.sgstTotal, 0);
  const totalIgst = currentInvoices.reduce((acc, i) => acc + i.igstTotal, 0);

  const lowStockProducts = products.filter(
    p => p.businessId === activeBusiness.id && p.currentStock <= p.minStockAlert
  );

  const totalInventoryValue = products
    .filter(p => p.businessId === activeBusiness.id)
    .reduce((acc, p) => acc + p.currentStock * p.purchasePrice, 0);

  // Status breakdown
  const paidCount = currentInvoices.filter(i => i.status === 'PAID').length;
  const unpaidCount = currentInvoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID').length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome with Store details */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black tracking-tight text-white">
              {activeBusiness.tradeName || activeBusiness.name}
            </h1>
            <span className="bg-emerald-500/20 text-emerald-400 font-bold text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              {activeBusiness.status}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span><strong>GSTIN:</strong> <span className="font-mono text-slate-300">{activeBusiness.gstin}</span></span>
            <span>•</span>
            <span><strong>State:</strong> {activeBusiness.state} ({activeBusiness.stateCode})</span>
            <span>•</span>
            <span><strong>Plan:</strong> <span className="text-emerald-400 font-semibold">{activeBusiness.activePlan}</span></span>
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenNewInvoice}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t.createNewInvoice}</span>
          </button>
          <button
            onClick={() => onNavigateTab('quotations')}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
          >
            <span>{t.createQuotation}</span>
          </button>
          <button
            onClick={() => onNavigateTab('gst')}
            className="flex items-center space-x-1.5 bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 px-3.5 py-2 rounded-xl text-xs font-semibold border border-indigo-500/30 transition-all"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>GSTR-1 & 3B</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {t.totalRevenue}
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{formatINR(totalRevenue)}</span>
            <div className="flex items-center space-x-1.5 mt-1 text-xs text-emerald-400 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+18.4% vs last month</span>
            </div>
          </div>
        </div>

        {/* Pending Receivables */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {t.pendingReceivables}
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-400">{formatINR(totalBalanceDue)}</span>
            <div className="flex items-center space-x-1.5 mt-1 text-xs text-slate-400">
              <span>{unpaidCount} {language === 'hi' ? 'बिलों का भुगतान बाकी' : 'unpaid invoices'}</span>
            </div>
          </div>
        </div>

        {/* Total GST Collected */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {t.gstCollected}
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-indigo-300">{formatINR(totalGstCollected)}</span>
            <div className="mt-1 text-[11px] text-slate-400 font-mono truncate">
              CGST: {formatINR(totalCgst)} | SGST: {formatINR(totalSgst)}
            </div>
          </div>
        </div>

        {/* Inventory Stock & Alerts */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {t.inventory}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{formatINR(totalInventoryValue)}</span>
            <div className="flex items-center space-x-2 mt-1 text-xs">
              <span className="text-slate-400">{products.length} Products</span>
              {lowStockProducts.length > 0 && (
                <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold text-[10px]">
                  {lowStockProducts.length} Low
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mid Section: Monthly Trends Chart + Payment Collection Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales & GST Trend Simulation Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="font-extrabold text-sm text-white">{t.monthlySalesTrend}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {language === 'hi' ? 'मासिक राजस्व व एकत्रित GST का तुलनात्मक विश्लेषण' : 'Comparative analysis of monthly sales revenue vs GST collected'}
              </p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500"></span>
                <span className="text-slate-300">{language === 'hi' ? 'बिक्री' : 'Sales'}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-sm bg-indigo-500"></span>
                <span className="text-slate-300">GST</span>
              </div>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="pt-6 pb-2 grid grid-cols-6 gap-3 sm:gap-6 items-end h-48">
            {[
              { month: 'Jun', sales: 65, gst: 12 },
              { month: 'Jul', sales: 82, gst: 15 },
              { month: 'Aug', sales: 74, gst: 14 },
              { month: 'Sep', sales: 95, gst: 18 },
              { month: 'Oct', sales: 110, gst: 21 },
              { month: 'Nov (Current)', sales: 144, gst: 26, isCurrent: true }
            ].map(col => (
              <div key={col.month} className="flex flex-col items-center h-full justify-end group">
                <div className="text-[10px] text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  {col.sales}k
                </div>
                <div className="w-full max-w-[42px] flex items-end justify-center space-x-1.5 h-36">
                  {/* Sales bar */}
                  <div
                    style={{ height: `${(col.sales / 150) * 100}%` }}
                    className={`w-1/2 rounded-t transition-all ${
                      col.isCurrent ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-emerald-500/70'
                    }`}
                  ></div>
                  {/* GST bar */}
                  <div
                    style={{ height: `${(col.gst / 30) * 100}%` }}
                    className={`w-1/2 rounded-t transition-all ${
                      col.isCurrent ? 'bg-gradient-to-t from-indigo-600 to-indigo-400' : 'bg-indigo-500/60'
                    }`}
                  ></div>
                </div>
                <span className={`text-[11px] mt-2 font-medium ${col.isCurrent ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                  {col.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Payment Health Status */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-white">
              {language === 'hi' ? 'भुगतान व बिल स्थिति' : 'Billing Status Breakdown'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {language === 'hi' ? 'जारी किए गए बिलों का रिकवरी अनुपात' : 'Collection efficiency & status metrics'}
            </p>

            <div className="mt-5 space-y-4">
              {/* Paid Status */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
                    {language === 'hi' ? 'पूर्ण भुगतान (Paid)' : 'Paid in Full'}
                  </span>
                  <span className="font-bold text-emerald-400">{formatINR(totalPaid)}</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${totalRevenue ? (totalPaid / totalRevenue) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Pending / Overdue */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium flex items-center">
                    <Clock className="w-3.5 h-3.5 text-rose-400 mr-1.5" />
                    {language === 'hi' ? 'बकाया (Pending Due)' : 'Pending Balance'}
                  </span>
                  <span className="font-bold text-rose-400">{formatINR(totalBalanceDue)}</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all"
                    style={{ width: `${totalRevenue ? (totalBalanceDue / totalRevenue) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* GST Tax Slabs summary */}
              <div className="pt-3 border-t border-slate-800 text-xs space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Applicable GST Slabs</span>
                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                  <div className="bg-slate-800/80 p-1.5 rounded border border-slate-700">0% Exemption</div>
                  <div className="bg-slate-800/80 p-1.5 rounded border border-slate-700">5% Essentials</div>
                  <div className="bg-slate-800/80 p-1.5 rounded border border-slate-700">12% Standard</div>
                  <div className="bg-slate-800/80 p-1.5 rounded border border-slate-700">18% Standard</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Total Invoices: {currentInvoices.length}</span>
            <button
              onClick={() => onNavigateTab('invoices')}
              className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1"
            >
              <span>{language === 'hi' ? 'सभी बिल देखें' : 'View Invoices'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Low stock alert cards + Recent Invoices Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices Table (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-white">{t.recentTransactions}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {language === 'hi' ? 'हाल में जारी किए गए GST बिल' : 'Latest GST Tax Invoices generated'}
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('invoices')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3 pl-5">Invoice #</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Grand Total</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {currentInvoices.slice(0, 5).map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 pl-5 font-mono font-bold text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-200">{inv.customerName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{inv.customerGstin || 'Consumer'}</div>
                    </td>
                    <td className="p-3 text-slate-400">{formatDate(inv.invoiceDate)}</td>
                    <td className="p-3 text-right font-bold text-slate-100">{formatINR(inv.grandTotal)}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : inv.status === 'PARTIALLY_PAID'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3 pr-5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => onSelectInvoiceForPrint(inv)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title={t.printPdf}
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          const text = `Invoice ${inv.invoiceNumber} for ${formatINR(inv.grandTotal)} from ${activeBusiness.name}.`;
                          window.open(`https://wa.me/${inv.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                        }}
                        className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 transition-colors"
                        title={t.shareWhatsapp}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Watchlist */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="font-extrabold text-sm text-white">{t.lowStockAlerts}</h3>
              </div>
              <span className="bg-amber-500/15 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                {lowStockProducts.length} Alert
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {lowStockProducts.map(p => (
                <div key={p.id} className="bg-slate-800/50 border border-slate-700/60 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-white line-clamp-1">{p.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      SKU: {p.sku} • Min: {p.minStockAlert} {p.unit}
                    </div>
                    <div className="text-rose-400 font-bold text-xs mt-1">
                      Remaining: {p.currentStock} {p.unit}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      adjustProductStock(p.id, 25, 'Quick Reorder from Dashboard');
                      showToast(`Added +25 ${p.unit} to ${p.name}`);
                    }}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-bold border border-emerald-500/30 transition-all shrink-0"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>+25 Restock</span>
                  </button>
                </div>
              ))}

              {lowStockProducts.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p>{language === 'hi' ? 'सभी उत्पादों में पर्याप्त स्टॉक उपलब्ध है' : 'All inventory levels healthy.'}</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-right">
            <button
              onClick={() => onNavigateTab('inventory')}
              className="text-xs text-slate-400 hover:text-slate-200 font-medium"
            >
              {language === 'hi' ? 'पूरी इन्वेंटरी देखें →' : 'Manage full inventory →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
