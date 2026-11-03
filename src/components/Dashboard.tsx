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
  PackagePlus,
  ArrowDownRight,
  FileText,
  Wallet,
  ShoppingCart,
  Truck,
  Calculator,
  BarChart3
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
    invoices,
    products,
    adjustProductStock,
    showToast,
    parties
  } = useBilling();

  const t = TRANSLATIONS[language];
  const hiLang = language === 'hi';

  // Calculations for current active business
  const currentInvoices = invoices.filter(i => i.businessId === activeBusiness.id);
  // month-to-date vs last month, from real (non-cancelled) invoices
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const lastMonthKey = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1)).toISOString().slice(0, 7);
  const liveInvoices = currentInvoices.filter(i => i.status !== 'CANCELLED');
  const monthInvoices = liveInvoices.filter(i => i.invoiceDate.startsWith(monthKey));
  const lastMonthSales = liveInvoices.filter(i => i.invoiceDate.startsWith(lastMonthKey)).reduce((a, i) => a + i.grandTotal, 0);
  const totalRevenue = monthInvoices.reduce((acc, i) => acc + i.grandTotal, 0);
  const salesChange = lastMonthSales ? ((totalRevenue - lastMonthSales) / lastMonthSales) * 100 : null;
  const totalBalanceDue = liveInvoices.reduce((acc, i) => acc + i.balanceDue, 0);
  // suppliers carry a negative balance when we owe them
  const totalPayable = parties
    .filter(p => p.businessId === activeBusiness.id && p.currentBalance < 0)
    .reduce((a, p) => a - p.currentBalance, 0);
  const monthLabel = now.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short', year: 'numeric' });

  // e-invoice: B2B invoices without IRN; IRP 30-day window from invoice date
  const pendingIrn = liveInvoices
    .filter(i => i.customerGstin && i.customerGstin.length === 15 && i.eInvoiceStatus !== 'GENERATED')
    .map(i => ({ inv: i, daysLeft: 30 - Math.round((now.getTime() - new Date(i.invoiceDate + 'T00:00:00').getTime()) / 86400000) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  // GSTR-1 for last month is due on the 11th of this month (11th of next month once that has passed)
  const gstrDue = new Date(now.getFullYear(), now.getMonth() + (now.getDate() > 11 ? 1 : 0), 11);
  const gstrPeriodKey = new Date(Date.UTC(gstrDue.getFullYear(), gstrDue.getMonth() - 1, 1)).toISOString().slice(0, 7);
  const gstrPeriodLabel = new Date(gstrPeriodKey + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  const gstrCount = liveInvoices.filter(i => i.invoiceDate.startsWith(gstrPeriodKey)).length;
  const totalGstCollected = currentInvoices.reduce((acc, i) => acc + i.totalGst, 0);

  const lowStockProducts = products.filter(
    p => p.businessId === activeBusiness.id && p.currentStock <= p.minStockAlert
  );

  const unpaidCount = liveInvoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID').length;

  // first-run checklist: a new business has no data yet, so say what to do instead of showing zeros
  const bizProducts = products.filter(p => p.businessId === activeBusiness.id);
  const bizParties = parties.filter(p => p.businessId === activeBusiness.id);
  const steps = [
    { done: !!(activeBusiness.address && (activeBusiness.gstin || activeBusiness.upiId)), label: hiLang ? 'स्टोर प्रोफाइल पूरी करें (पता, GSTIN, UPI)' : 'Complete your store profile (address, GSTIN, UPI ID)', cta: hiLang ? 'खोलें' : 'Open', go: () => onNavigateTab('audit') },
    { done: bizProducts.length > 0, label: hiLang ? 'आइटम जोड़ें या CSV से इम्पोर्ट करें' : 'Add your items (or import a CSV)', cta: hiLang ? 'आइटम' : 'Add items', go: () => onNavigateTab('inventory') },
    { done: bizParties.some(p => p.type === 'CUSTOMER'), label: hiLang ? 'ग्राहक जोड़ें' : 'Add a customer', cta: hiLang ? 'ग्राहक' : 'Add customer', go: () => onNavigateTab('parties') },
    { done: currentInvoices.length > 0, label: hiLang ? 'पहली GST इनवॉइस बनाएं' : 'Create your first GST invoice', cta: hiLang ? 'इनवॉइस' : 'New invoice', go: onOpenNewInvoice }
  ];
  const showGetStarted = currentInvoices.length === 0;

  return (
    <div className="space-y-6 pb-12">
      {showGetStarted && (
        <div className="bg-white border-2 border-mango-200 rounded-3xl p-5 sm:p-6">
          <h2 className="text-lg font-black text-ink">{hiLang ? 'शुरू करें' : 'Get started'} · {activeBusiness.tradeName || activeBusiness.name}</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {hiLang ? 'आपका बिजनेस नया है, इसलिए अभी कोई बिक्री नहीं दिख रही। ये 4 कदम पूरे करें:' : 'Your business is new, so there are no sales to show yet. Finish these 4 steps:'}
          </p>
          <div className="mt-4 space-y-2">
            {steps.map((st, i) => (
              <div key={i} className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${st.done ? 'border-leaf-100 bg-leaf-50/50' : 'border-mango-100'}`}>
                <div className="flex items-center gap-3 text-xs">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] ${st.done ? 'bg-leaf-500 text-white' : 'bg-mango-100 text-mango-700'}`}>{st.done ? '✓' : i + 1}</span>
                  <span className={st.done ? 'text-stone-400 line-through' : 'font-semibold text-ink'}>{st.label}</span>
                </div>
                {!st.done && (
                  <button onClick={st.go} className="shrink-0 text-xs font-bold text-white bg-mango-500 hover:bg-mango-600 px-3 py-1.5 rounded-xl">{st.cta}</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Top Gorgeous Mango Gradient Sales Card (Matching screenshot style) */}
      <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 sm:p-8 text-ink shadow-2xl shadow-mango-500/25 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-ink/75">
              Sales · {monthLabel}
            </span>
            <div className="text-3xl sm:text-4xl font-black text-ink mt-1 tracking-tight font-mono">
              {formatINR(totalRevenue)}
            </div>
            <p className="text-xs font-semibold text-ink/75 mt-1">
              {monthInvoices.length} invoices this month · {formatINR(lastMonthSales)} last month
            </p>
          </div>

          <div className="bg-slate-950/15 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center space-x-1 text-ink font-bold text-xs border border-slate-950/10">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{salesChange === null ? 'New' : `${salesChange >= 0 ? '+' : ''}${salesChange.toFixed(1)}%`}</span>
          </div>
        </div>

        {/* To Collect & To Pay Sub-cards inside gradient banner */}
        <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-slate-950/15">
          <div className="bg-slate-950/10 backdrop-blur-sm rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cream text-mango-600 flex items-center justify-center shrink-0 shadow-md">
              <ArrowDownRight className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/75">To collect</span>
              <div className="text-sm font-black font-mono text-ink">{formatINR(totalBalanceDue)}</div>
            </div>
          </div>

          <div className="bg-slate-950/10 backdrop-blur-sm rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cream text-orange-600 flex items-center justify-center shrink-0 shadow-md">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/75">To pay</span>
              <div className="text-sm font-black font-mono text-ink">{formatINR(totalPayable)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid (Matching mobile app quick actions) */}
      <div>
        <h3 className="font-extrabold text-sm text-ink mb-3 px-1">Quick actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Invoice', icon: FileText, color: 'text-mango-600 bg-amber-500/10', action: onOpenNewInvoice },
            { label: 'Payment In', icon: Wallet, color: 'text-leaf-600 bg-emerald-500/10', action: () => onNavigateTab('payments') },
            { label: 'Quotation', icon: FileCheck2, color: 'text-mango-700 bg-amber-500/10', action: () => onNavigateTab('quotations') },
            { label: 'Purchase', icon: ShoppingCart, color: 'text-wave-600 bg-blue-500/10', action: () => onNavigateTab('purchases') },
            { label: 'e-Way Bill', icon: Truck, color: 'text-wave-600 bg-indigo-500/10', action: () => onNavigateTab('eway') },
            { label: 'POS Bill', icon: Calculator, color: 'text-orange-600 bg-orange-500/10', action: onOpenNewInvoice },
            { label: 'e-Invoice', icon: Boxes, color: 'text-leaf-600 bg-emerald-500/10', action: () => onNavigateTab('eway') },
            { label: 'Reports', icon: BarChart3, color: 'text-mango-600 bg-amber-500/10', action: () => onNavigateTab('gst') },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={item.action}
                className="bg-white hover:bg-mango-50 border border-mango-100 p-4 rounded-2xl flex flex-col items-center justify-center text-center transition-all group hover:border-amber-500/40"
              >
                <div className={`w-11 h-11 rounded-2xl ${item.color} flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-stone-800 group-hover:text-mango-600 transition-colors">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Needs Attention Section */}
      <div>
        <h3 className="font-extrabold text-sm text-ink mb-3 px-1">Needs attention</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-mango-100 p-4 rounded-3xl flex items-center justify-between hover:border-amber-500/40 transition-all">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-mango-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-ink">
                  {pendingIrn.length ? `IRN due in ${Math.max(0, pendingIrn[0].daysLeft)} days` : 'All B2B invoices have IRN'}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  {pendingIrn.length ? `${pendingIrn.length} B2B invoice${pendingIrn.length > 1 ? 's' : ''} pending · ${pendingIrn[0].inv.invoiceNumber}` : 'Nothing pending on the IRP'}
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('eway')}
              className="text-xs font-bold text-mango-600 hover:text-mango-700 flex items-center space-x-1 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20"
            >
              <span>Review</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white border border-mango-100 p-4 rounded-3xl flex items-center justify-between hover:border-indigo-500/40 transition-all">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-wave-600 flex items-center justify-center shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-ink">GSTR-1 due {gstrDue.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                <div className="text-[11px] text-stone-500 mt-0.5">{gstrCount} invoices · {gstrPeriodLabel} return filing</div>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('gst')}
              className="text-xs font-bold text-wave-600 hover:text-wave-700 flex items-center space-x-1 bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20"
            >
              <span>File Now</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Invoices & Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-mango-100 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-mango-100">
            <div>
              <h3 className="font-extrabold text-sm text-ink">{t.recentTransactions}</h3>
              <p className="text-[11px] text-stone-500 mt-0.5">Latest GST Tax Invoices generated</p>
            </div>
            <button
              onClick={() => onNavigateTab('invoices')}
              className="text-xs text-mango-600 hover:text-mango-700 font-semibold flex items-center"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-mango-50/50 text-stone-500 uppercase font-semibold text-[10px] tracking-wider border-b border-mango-100">
                <tr>
                  <th className="p-3 pl-4">Invoice #</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Grand Total</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mango-100">
                {currentInvoices.slice(0, 5).map(inv => (
                  <tr key={inv.id} className="hover:bg-mango-50/50 transition-colors">
                    <td className="p-3 pl-4 font-mono font-bold text-ink">
                      {inv.invoiceNumber}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-stone-800">{inv.customerName}</div>
                      <div className="text-[10px] text-stone-500 font-mono">{inv.customerGstin || 'Consumer'}</div>
                    </td>
                    <td className="p-3 text-stone-500">{formatDate(inv.invoiceDate)}</td>
                    <td className="p-3 text-right font-bold text-ink">{formatINR(inv.grandTotal)}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          inv.status === 'PAID'
                            ? 'bg-amber-500/15 text-mango-600 border border-amber-500/30'
                            : 'bg-orange-500/15 text-orange-600 border border-orange-500/30'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3 pr-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => onSelectInvoiceForPrint(inv)}
                        className="p-1.5 rounded-lg bg-mango-50/60 hover:bg-mango-100 text-stone-700 hover:text-ink transition-colors"
                        title={t.printPdf}
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          const text = `Invoice ${inv.invoiceNumber} for ${formatINR(inv.grandTotal)} from ${activeBusiness.name}.`;
                          window.open(`https://wa.me/${inv.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                        }}
                        className="p-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-mango-600 transition-colors"
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
        <div className="bg-white border border-mango-100 rounded-3xl shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-mango-100">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-mango-600" />
                <h3 className="font-extrabold text-sm text-ink">{t.lowStockAlerts}</h3>
              </div>
              <span className="bg-amber-500/15 text-mango-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                {lowStockProducts.length} Alert
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {lowStockProducts.map(p => (
                <div key={p.id} className="bg-mango-50/40 border border-mango-100 p-3 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-ink line-clamp-1">{p.name}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5 font-mono">
                      SKU: {p.sku} • Min: {p.minStockAlert}
                    </div>
                    <div className="text-rose-600 font-bold text-xs mt-1">
                      Remaining: {p.currentStock} {p.unit}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      adjustProductStock(p.id, 25, 'Quick Reorder');
                      showToast(`Added +25 ${p.unit} to ${p.name}`);
                    }}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-mango-600 rounded-xl text-[10px] font-bold border border-amber-500/30 transition-all shrink-0"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>+25 Restock</span>
                  </button>
                </div>
              ))}

              {lowStockProducts.length === 0 && (
                <div className="text-center py-8 text-stone-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-mango-600 mx-auto mb-2 opacity-80" />
                  <p>All inventory levels healthy.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-mango-100 text-right">
            <button
              onClick={() => onNavigateTab('inventory')}
              className="text-xs text-stone-500 hover:text-stone-800 font-medium"
            >
              Manage full inventory →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
