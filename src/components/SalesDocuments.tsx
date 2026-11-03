import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { useDocuments } from '../context/DocumentsContext';
import { DocType } from '../types/documents';
import { PageHeader, SegmentedTabs } from './admin/ui';
import { DocumentList } from './documents/DocumentList';
import { FileStack } from 'lucide-react';
import { RecurringInvoices } from './RecurringInvoices';

const TABS: { id: DocType; label: string; description: string }[] = [
  { id: 'PROFORMA', label: 'Proforma', description: 'Advance / quotation-style invoice for payment before supply. Not a tax invoice, so no GST liability until converted.' },
  { id: 'SALES_ORDER', label: 'Sales orders', description: 'Confirmed customer orders. Mark delivered or convert straight into a GST tax invoice.' },
  { id: 'DELIVERY_CHALLAN', label: 'Delivery challans', description: 'Goods sent without sale (approval, job work, branch transfer). Stock moves when invoiced. Needs an e-way bill above ₹50,000.' },
  { id: 'CREDIT_NOTE', label: 'Credit notes / returns', description: 'Sales returns and post-sale discounts against an invoice. Reduces customer dues and output GST (GSTR-1 CDNR).' }
];

export const SalesDocuments: React.FC = () => {
  const { activeBusiness } = useBilling();
  const { documents } = useDocuments();
  const [tab, setTab] = useState<DocType | 'RECURRING'>('PROFORMA');
  const count = (t: DocType) => documents.filter(d => d.docType === t && d.businessId === activeBusiness.id && d.status !== 'CANCELLED').length;
  const active = TABS.find(t => t.id === tab);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={FileStack}
        title="Sales documents"
        subtitle="Proforma invoices, sales orders, delivery challans and credit notes. All convertible, printable and shareable on WhatsApp."
        actions={<SegmentedTabs value={tab} onChange={setTab} options={[...TABS.map(t => ({ id: t.id as DocType | 'RECURRING', label: t.label, count: count(t.id) })), { id: 'RECURRING' as const, label: 'Recurring' }]} />}
      />
      {tab === 'RECURRING' ? <RecurringInvoices /> : <DocumentList key={tab} docType={tab} description={active!.description} />}
    </div>
  );
};
