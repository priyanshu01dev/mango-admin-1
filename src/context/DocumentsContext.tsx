import React, { createContext, useContext, useMemo } from 'react';
import { useBilling } from './BillingContext';
import { TradeDocument, DocType, DocStatus, Expense, InvoiceSettings } from '../types/documents';
import { PaymentMode } from '../types';
import { del, patch, post } from '../api/client';
import { fromItems, fromSettings, toSettings, expandPrefix } from '../api/mappers';

export const DOC_LABEL: Record<DocType, string> = {
  PROFORMA: 'Proforma Invoice',
  SALES_ORDER: 'Sales Order',
  DELIVERY_CHALLAN: 'Delivery Challan',
  CREDIT_NOTE: 'Credit Note / Sales Return',
  PURCHASE_ORDER: 'Purchase Order',
  PURCHASE_BILL: 'Purchase Bill',
  DEBIT_NOTE: 'Debit Note / Purchase Return'
};

export const isPurchaseDoc = (t: DocType) => t === 'PURCHASE_BILL' || t === 'PURCHASE_ORDER' || t === 'DEBIT_NOTE';

export type NewDocument = Omit<TradeDocument, 'id' | 'number' | 'createdAt' | 'status' | 'businessId'> & { status?: DocStatus };

interface DocumentsContextType {
  documents: TradeDocument[];
  expenses: Expense[];
  settings: InvoiceSettings;
  /** Preview of the next number (the server allocates the real one when saving). */
  nextDocNumber: (type: DocType) => string;
  nextInvoiceNumber: () => string;
  createDocument: (doc: NewDocument) => Promise<boolean>;
  cancelDocument: (id: string, reason: string) => void;
  payPurchaseBill: (id: string, amount: number, mode: PaymentMode, reference: string) => void;
  convertToInvoice: (id: string) => void;
  convertPoToBill: (id: string, supplierBillNo: string) => void;
  markDelivered: (id: string) => void;
  addExpense: (e: Omit<Expense, 'id' | 'number' | 'businessId'>) => Promise<boolean>;
  deleteExpense: (id: string) => void;
  updateSettings: (s: InvoiceSettings) => void;
  resetDocuments: () => void;
}

const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined);

export const DocumentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tradeDocs, expenses, current, act, reload } = useBilling();

  const settings = useMemo(() => toSettings(current?.business.invoiceSettings ?? {}, current?.numbering ?? {}), [current]);

  const value: DocumentsContextType = {
    documents: tradeDocs,
    expenses,
    settings,
    nextDocNumber: type => current?.numbering[type] ?? expandPrefix(settings.docPrefixes[type]) + '…',
    nextInvoiceNumber: () => current?.numbering.INV ?? expandPrefix(settings.prefix) + '…',
    createDocument: doc =>
      act(
        () =>
          post('/api/documents', {
            docType: doc.docType,
            partyId: doc.partyId,
            date: doc.date,
            dueDate: doc.dueDate,
            items: fromItems(doc.items),
            reference: doc.reference,
            reason: doc.reason,
            restock: doc.restock,
            itcEligible: doc.itcEligible,
            vehicleNumber: doc.vehicleNumber,
            notes: doc.notes,
            amountPaid: doc.docType === 'PURCHASE_BILL' && doc.amountPaid ? doc.amountPaid : undefined
          }),
        `${DOC_LABEL[doc.docType]} saved`
      ),
    cancelDocument: (id, reason) => void act(() => post(`/api/documents/${id}/cancel`, { reason }), 'Document cancelled'),
    payPurchaseBill: (id, amount, mode, reference) => {
      const bill = tradeDocs.find(d => d.id === id);
      if (!bill) return;
      void act(
        () => post('/api/payments', { type: 'PAYMENT_OUT', partyId: bill.partyId, billId: id, amount, mode, reference: reference || undefined }),
        `Paid ₹${amount.toLocaleString('en-IN')} to ${bill.partyName}`
      );
    },
    convertToInvoice: id => void act(() => post(`/api/documents/${id}/convert`), 'Tax invoice created'),
    convertPoToBill: (id, supplierBillNo) => void act(() => post(`/api/documents/${id}/receive`, { supplierBillNo }), 'Purchase bill created from PO'),
    markDelivered: id => void act(() => post(`/api/documents/${id}/delivered`), 'Marked as delivered'),
    addExpense: e =>
      act(
        () =>
          post('/api/expenses', {
            date: e.date,
            category: e.category,
            vendorName: e.vendorName,
            vendorGstin: e.vendorGstin,
            description: e.description,
            amount: e.amount,
            gstRate: e.gstRate,
            mode: e.mode,
            itcEligible: e.itcEligible,
            reference: e.reference
          }),
        'Expense recorded'
      ),
    deleteExpense: id => void act(() => del(`/api/expenses/${id}`), 'Expense deleted'),
    updateSettings: s => void act(() => patch('/api/businesses/current/settings', fromSettings(s)), 'Invoice settings saved'),
    resetDocuments: () => void reload()
  };

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
};

export const useDocuments = () => {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments must be used within a DocumentsProvider');
  return ctx;
};
