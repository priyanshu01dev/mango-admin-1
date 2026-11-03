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
import { PlatformOverview } from './components/admin/PlatformOverview';
import { Merchants } from './components/admin/Merchants';
import { SupportTickets } from './components/admin/SupportTickets';
import { FeatureFlags } from './components/admin/FeatureFlags';
import { Broadcasts } from './components/admin/Broadcasts';
import { Integrations } from './components/admin/Integrations';
import { CheckCircle2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const { selectedInvoiceForPrint, setSelectedInvoiceForPrint, quickNotification } = useBilling();

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

            {activeTab === 'inventory' && <Inventory />}

            {activeTab === 'parties' && <CustomersSuppliers />}

            {activeTab === 'payments' && <Payments />}

            {activeTab === 'gst' && <GSTReports />}

            {activeTab === 'subscriptions' && <Subscriptions />}

            {activeTab === 'api' && <AndroidApiExplorer />}

            {activeTab === 'audit' && <AuditSettings />}
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

export default function App() {
  return (
    <BillingProvider>
      <AdminProvider>
        <DocumentsProvider>
          <AppContent />
        </DocumentsProvider>
      </AdminProvider>
    </BillingProvider>
  );
}
