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

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const { selectedInvoiceForPrint, setSelectedInvoiceForPrint } = useBilling();

  const handleOpenNewInvoice = () => {
    setActiveTab('invoices');
    setIsCreateInvoiceModalOpen(true);
  };

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
          <div className="max-w-7xl mx-auto">
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
