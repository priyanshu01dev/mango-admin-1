import React, { useState } from 'react';
import { BillingProvider, useBilling } from './context/BillingContext';
import { Sidebar, NavTab } from './components/Sidebar';
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
import { AdminProvider } from './context/AdminContext';
import { DocumentsProvider } from './context/DocumentsContext';
import { SalesDocuments } from './components/SalesDocuments';
import { Purchases } from './components/Purchases';
import { BusinessReports } from './components/BusinessReports';
import { InventoryHub } from './components/InventoryHub';
import { PosScreen } from './components/PosScreen';
import { PlatformOverview } from './components/admin/PlatformOverview';
import { Merchants } from './components/admin/Merchants';
import { SupportTickets } from './components/admin/SupportTickets';
import { FeatureFlags } from './components/admin/FeatureFlags';
import { Broadcasts } from './components/admin/Broadcasts';
import { Integrations } from './components/admin/Integrations';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { CreateBusiness } from './components/auth/CreateBusiness';
import { CheckCircle2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

const PLATFORM_TABS: NavTab[] = ['overview', 'merchants', 'subscriptions', 'support', 'flags', 'broadcasts', 'integrations'];

const AppContent: React.FC = () => {
  const { isPlatformAdmin, activeBusinessId } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>(isPlatformAdmin ? 'overview' : 'dashboard');
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const { selectedInvoiceForPrint, setSelectedInvoiceForPrint, quickNotification, hasBusiness, loading } = useBilling();

  const isPlatformTab = PLATFORM_TABS.includes(activeTab);
  // platform pages need a platform role; merchant pages need a business
  const blockedPlatform = (isPlatformTab || activeTab === 'api') && !isPlatformAdmin;
  const needsBusiness = !isPlatformTab && activeTab !== 'api' && !activeBusinessId;
  const waitingForBusiness = !isPlatformTab && activeTab !== 'api' && !!activeBusinessId && !hasBusiness;

  const handleOpenNewInvoice = () => {
    setActiveTab('invoices');
    setIsCreateInvoiceModalOpen(true);
  };

  return (
    <div className="flex h-screen bg-cream text-ink overflow-hidden font-sans">
      {/* Mango Top Accent Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-mango-500 to-orange-600 z-50" />

      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-cream">
        {/* Top Header */}
        <Header onOpenNewInvoice={handleOpenNewInvoice} />

        {/* Scrollable Main View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-cream">
          <div className="max-w-7xl mx-auto">
            {blockedPlatform && <div className="text-center text-stone-500 text-xs py-20">Platform admin access is required for this page.</div>}
            {needsBusiness && <CreateBusiness />}
            {waitingForBusiness && <div className="text-center text-stone-500 text-xs py-20">{loading ? 'Loading your business…' : 'Could not load this business.'}</div>}
            {!blockedPlatform && !needsBusiness && !waitingForBusiness && (<ErrorBoundary key={`${activeBusinessId ?? 'platform'}:${activeTab}`}>
            {activeTab === 'overview' && <PlatformOverview onNavigate={setActiveTab} />}
            {activeTab === 'merchants' && <Merchants />}
            {activeTab === 'support' && <SupportTickets />}
            {activeTab === 'flags' && <FeatureFlags />}
            {activeTab === 'broadcasts' && <Broadcasts />}
            {activeTab === 'integrations' && <Integrations />}
            {activeTab === 'dashboard' && (
              <Dashboard
                onOpenNewInvoice={handleOpenNewInvoice}
                onNavigateTab={setActiveTab}
                onSelectInvoiceForPrint={setSelectedInvoiceForPrint}
              />
            )}

            {activeTab === 'invoices' && (
              <Invoices
                onSelectInvoiceForPrint={setSelectedInvoiceForPrint}
                isCreateModalOpen={isCreateInvoiceModalOpen}
                setIsCreateModalOpen={setIsCreateInvoiceModalOpen}
              />
            )}

            {activeTab === 'quotations' && <Quotations />}

            {activeTab === 'salesdocs' && <SalesDocuments />}

            {activeTab === 'purchases' && <Purchases />}

            {activeTab === 'reports' && <BusinessReports />}

            {activeTab === 'eway' && <EWayBillEInvoice />}

            {activeTab === 'inventory' && <InventoryHub />}

            {activeTab === 'pos' && <PosScreen />}

            {activeTab === 'parties' && <CustomersSuppliers />}

            {activeTab === 'payments' && <Payments />}

            {activeTab === 'gst' && <GSTReports />}

            {activeTab === 'subscriptions' && <Subscriptions />}

            {activeTab === 'api' && <AndroidApiExplorer />}

            {activeTab === 'audit' && <AuditSettings />}
            </ErrorBoundary>)}
          </div>
        </main>
      </div>

      {/* Invoice Print & Preview Modal (Indian GST Rule 46 Compliant) */}
      {quickNotification && (
        <div
          role="status"
          aria-live="polite"
          className="toast-in fixed bottom-5 right-5 z-[60] flex items-center gap-2 bg-ink text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl max-w-sm no-print"
        >
          <CheckCircle2 className="w-4 h-4 text-mango-400 shrink-0" />
          {quickNotification}
        </div>
      )}

      {selectedInvoiceForPrint && (
        <InvoicePrintModal
          invoice={selectedInvoiceForPrint}
          onClose={() => setSelectedInvoiceForPrint(null)}
        />
      )}
    </div>
  );
};

const Gate: React.FC = () => {
  const { status } = useAuth();
  if (status === 'loading') {
    return <div className="min-h-screen bg-cream flex items-center justify-center text-xs text-stone-500">Loading Mango Invoice…</div>;
  }
  if (status === 'anonymous') return <LoginScreen />;
  return (
    <BillingProvider>
      <AdminProvider>
        <DocumentsProvider>
          <AppContent />
        </DocumentsProvider>
      </AdminProvider>
    </BillingProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
