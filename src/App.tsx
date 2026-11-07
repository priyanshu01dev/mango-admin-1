import React, { useEffect, useState } from 'react';
import { BillingProvider, BUSINESS_SCREENS, useBilling } from './context/BillingContext';
import { Sidebar, NavTab, NAV_ORDER, tabAllowed } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { Invoices } from './components/Invoices';
import { Quotations } from './components/Quotations';
import { EWayBillEInvoice } from './components/EWayBillEInvoice';
import { Inventory } from './components/Inventory';
import { CustomersSuppliers } from './components/CustomersSuppliers';
import { Payments } from './components/Payments';
import { GSTReports } from './components/GSTReports';
import { Subscriptions } from './components/Subscriptions';
import { AndroidApiExplorer } from './components/AndroidApiExplorer';
import { AuditSettings } from './components/AuditSettings';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { Login } from './components/Login';
import { Staff } from './components/Staff';
import { BusinessStaff } from './components/BusinessStaff';
import { NoAccess } from './components/NoAccess';
import { Hospitality } from './components/Hospitality';
import { Licences } from './components/Licences';
import { Marketing } from './components/Marketing';
import { Loyalty } from './components/Loyalty';
import { Delivery } from './components/Delivery';
import { Support } from './components/Support';
import { Loader2, AlertTriangle, CloudOff } from 'lucide-react';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const { selectedInvoiceForPrint, setSelectedInvoiceForPrint, admin, authReady, activeBusiness, businesses, error, reload, hasSnapshot, loading, language, can } = useBilling();
  const hi = language === 'hi';
  const firstAllowed = NAV_ORDER.find((t) => tabAllowed(t, can));

  // After sign-in (or a permission change) land on the first screen this admin may open.
  useEffect(() => {
    if (admin && !tabAllowed(activeTab, can) && firstAllowed) setActiveTab(firstAllowed);
  }, [admin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authReady) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-6 h-6 text-slate-500 animate-spin" /></div>;
  if (!admin) return <Login />;
  const allowed = tabAllowed(activeTab, can);
  const isBusinessTab = BUSINESS_SCREENS.includes(activeTab);
  if (allowed && isBusinessTab && !activeBusiness.id) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6 text-slate-300">
        {error ? <AlertTriangle className="w-8 h-8 text-rose-400 mb-3" /> : <Loader2 className="w-6 h-6 text-slate-500 animate-spin mb-3" />}
        <p className="text-sm">{error ?? (businesses.length === 0 && !loading ? (hi ? 'लोड हो रहा है…' : 'Loading…') : (hi ? 'लोड हो रहा है…' : 'Loading…'))}</p>
        {error && <button onClick={reload} className="mt-4 px-4 py-2 bg-slate-800 rounded-lg text-xs">{hi ? 'फिर कोशिश करें' : 'Try again'}</button>}
      </div>
    );
  }

  const handleOpenNewInvoice = () => {
    setActiveTab('invoices');
    setIsCreateInvoiceModalOpen(true);
  };
  const show = (tab: NavTab) => allowed && activeTab === tab;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header onOpenNewInvoice={handleOpenNewInvoice} />

        {/* Scrollable Main View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className={`max-w-7xl mx-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {error && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl p-3 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={reload} className="underline">{hi ? 'फिर कोशिश करें' : 'Retry'}</button>
              </div>
            )}
            {!allowed && <NoAccess screen={firstAllowed ? activeTab : null} onBack={firstAllowed ? () => setActiveTab(firstAllowed) : undefined} />}

            {allowed && isBusinessTab && !hasSnapshot && !loading && (
              <div className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs rounded-xl p-3 flex items-center space-x-2">
                <CloudOff className="w-4 h-4 shrink-0" />
                <span>{hi ? 'इस बिजनेस ने अभी तक ऐप से डेटा सिंक नहीं किया है।' : "This business hasn't synced any data from the app yet."}</span>
              </div>
            )}
            {show('dashboard') && (
              <Dashboard
                onOpenNewInvoice={handleOpenNewInvoice}
                onNavigateTab={setActiveTab}
                onSelectInvoiceForPrint={setSelectedInvoiceForPrint}
              />
            )}

            {show('invoices') && (
              <Invoices
                onSelectInvoiceForPrint={setSelectedInvoiceForPrint}
                isCreateModalOpen={isCreateInvoiceModalOpen}
                setIsCreateModalOpen={setIsCreateInvoiceModalOpen}
              />
            )}

            {show('quotations') && <Quotations />}

            {show('eway') && <EWayBillEInvoice />}

            {show('inventory') && <Inventory />}

            {show('parties') && <CustomersSuppliers />}

            {show('payments') && <Payments />}

            {show('gst') && <GSTReports />}

            {show('subscriptions') && <Subscriptions />}

            {show('attendance') && <BusinessStaff />}

            {show('hospitality') && <Hospitality />}

            {show('licences') && <Licences />}

            {show('marketing') && <Marketing />}

            {show('loyalty') && <Loyalty />}

            {show('delivery') && <Delivery />}

            {show('support') && <Support />}

            {show('api') && <AndroidApiExplorer />}

            {show('audit') && <AuditSettings />}

            {show('staff') && <Staff />}
          </div>
        </main>
      </div>

      {/* Invoice Print & Preview Modal (Indian GST Rule 46 Compliant) */}
      {selectedInvoiceForPrint && (
        <InvoicePrintModal
          invoice={selectedInvoiceForPrint}
          onClose={() => setSelectedInvoiceForPrint(null)}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <BillingProvider>
      <AppContent />
    </BillingProvider>
  );
}
