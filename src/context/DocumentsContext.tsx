import React, { createContext, useContext, useEffect, useState } from 'react';
import { useBilling } from './BillingContext';
import { TradeDocument, DocType, DocStatus, Expense, InvoiceSettings } from '../types/documents';
import { PaymentMode, Invoice } from '../types';
import { INITIAL_DOCUMENTS, INITIAL_EXPENSES, INITIAL_INVOICE_SETTINGS } from '../data/documentsData';
import { docTotals, localDate } from '../utils/gst';

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

function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    if (!saved) return initial;
    try {
      return JSON.parse(saved) as T;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

export type NewDocument = Omit<TradeDocument, 'id' | 'number' | 'createdAt' | 'status' | 'businessId'> & { status?: DocStatus };

interface DocumentsContextType {
  documents: TradeDocument[];
  expenses: Expense[];
  settings: InvoiceSettings;
  nextDocNumber: (type: DocType) => string;
  nextInvoiceNumber: () => string;
  createDocument: (doc: NewDocument) => TradeDocument;
  cancelDocument: (id: string, reason: string) => void;
  payPurchaseBill: (id: string, amount: number, mode: PaymentMode, reference: string) => void;
  convertToInvoice: (id: string) => Invoice | null;
  convertPoToBill: (id: string, supplierBillNo: string) => void;
  markDelivered: (id: string) => void;
  addExpense: (e: Omit<Expense, 'id' | 'number' | 'businessId'>) => void;
  deleteExpense: (id: string) => void;
  updateSettings: (s: InvoiceSettings) => void;
  resetDocuments: () => void;
}

const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined);

const pad = (n: number, len: number) => String(n).padStart(len, '0');

export const DocumentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeBusiness, invoices, addInvoice, applyStockMovements, adjustPartyBalance, recordPayment, showToast, logAudit, parties } = useBilling();

  const [documents, setDocuments] = usePersisted('mango_documents', INITIAL_DOCUMENTS);
  const [expenses, setExpenses] = usePersisted('mango_expenses', INITIAL_EXPENSES);
  const [settings, setSettings] = usePersisted('mango_invoice_settings', INITIAL_INVOICE_SETTINGS);

  /** Next serial for a prefix, never re-using a number that already exists (cancelled ones included). */
  const nextSerial = (prefix: string, existing: string[], floor: number) => {
    const used = existing
      .filter(n => n.startsWith(prefix))
      .map(n => parseInt(n.slice(prefix.length), 10))
      .filter(n => !isNaN(n));
    return Math.max(floor, used.length ? Math.max(...used) + 1 : floor);
  };

  const nextDocNumber = (type: DocType) => {
    const prefix = settings.docPrefixes[type];
    const n = nextSerial(prefix, documents.filter(d => d.docType === type).map(d => d.number), 1);
    return prefix + pad(n, settings.padding);
  };

  const nextInvoiceNumber = () => {
    const n = nextSerial(settings.prefix, invoices.map(i => i.invoiceNumber), settings.nextNumber);
    return settings.prefix + pad(n, settings.padding);
  };

  const stockSign = (doc: Pick<TradeDocument, 'docType' | 'restock'>): number => {
    if (doc.docType === 'PURCHASE_BILL') return 1;
    if (doc.docType === 'DEBIT_NOTE') return -1;
    if (doc.docType === 'CREDIT_NOTE') return doc.restock ? 1 : 0;
    return 0;
  };
  const balanceDelta = (doc: Pick<TradeDocument, 'docType' | 'grandTotal'>): number => {
    if (doc.docType === 'PURCHASE_BILL') return -doc.grandTotal; // we owe supplier
    if (doc.docType === 'DEBIT_NOTE') return doc.grandTotal; // supplier owes us back
    if (doc.docType === 'CREDIT_NOTE') return -doc.grandTotal; // customer's dues reduce
    return 0;
  };

  const createDocument = (input: NewDocument): TradeDocument => {
    const number = nextDocNumber(input.docType);
    let status: DocStatus = input.status ?? 'OPEN';
    if (input.docType === 'PURCHASE_BILL') {
      status = input.amountPaid >= input.grandTotal ? 'PAID' : input.amountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
    }
    if (input.docType === 'CREDIT_NOTE' || input.docType === 'DEBIT_NOTE') status = 'ISSUED';

    const doc: TradeDocument = {
      ...input,
      id: 'doc-' + Date.now(),
      number,
      businessId: activeBusiness.id,
      status,
      createdAt: new Date().toISOString()
    };
    setDocuments(prev => [doc, ...prev]);

    const sign = stockSign(doc);
    if (sign) applyStockMovements(doc.items.map(i => ({ productId: i.productId, name: i.name, quantity: sign * i.quantity })));
    const delta = balanceDelta(doc);
    if (delta) adjustPartyBalance(doc.partyId, delta);

    if (doc.docType === 'PURCHASE_BILL' && doc.amountPaid > 0) {
      recordPayment({
        businessId: activeBusiness.id,
        type: 'PAYMENT_OUT',
        partyId: doc.partyId,
        partyName: doc.partyName,
        invoiceNumber: doc.number,
        amount: doc.amountPaid,
        paymentDate: doc.date,
        mode: 'NEFT_RTGS',
        referenceNumber: 'PAID-WITH-BILL',
        notes: `Paid against supplier bill ${doc.reference ?? doc.number}`
      });
    }

    showToast(`${DOC_LABEL[doc.docType]} ${number} saved`);
    logAudit(`${doc.docType}_CREATE`, `Created ${DOC_LABEL[doc.docType]} ${number} for ${doc.partyName} (₹${doc.grandTotal})`);
    return doc;
  };

  const cancelDocument = (id: string, reason: string) => {
    const doc = documents.find(d => d.id === id);
    if (!doc || doc.status === 'CANCELLED' || doc.status === 'CONVERTED') return;
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, status: 'CANCELLED', notes: `CANCELLED: ${reason}${d.notes ? ' | ' + d.notes : ''}` } : d)));
    const sign = stockSign(doc);
    if (sign) applyStockMovements(doc.items.map(i => ({ productId: i.productId, name: i.name, quantity: -sign * i.quantity })));
    const delta = balanceDelta(doc);
    if (delta) adjustPartyBalance(doc.partyId, -delta);
    showToast(`${doc.number} cancelled`);
    logAudit(`${doc.docType}_CANCEL`, `Cancelled ${doc.number}. Reason: ${reason}`, 'WARNING');
  };

  const payPurchaseBill = (id: string, amount: number, mode: PaymentMode, reference: string) => {
    const doc = documents.find(d => d.id === id);
    if (!doc || amount <= 0) return;
    const paid = Math.min(doc.grandTotal, doc.amountPaid + amount);
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, amountPaid: paid, status: paid >= d.grandTotal ? 'PAID' : 'PARTIALLY_PAID' } : d)));
    recordPayment({
      businessId: doc.businessId,
      type: 'PAYMENT_OUT',
      partyId: doc.partyId,
      partyName: doc.partyName,
      invoiceNumber: doc.number,
      amount,
      paymentDate: localDate(),
      mode,
      referenceNumber: reference || 'PAY-OUT-' + Date.now().toString().slice(-6),
      notes: `Payment against ${doc.number}${doc.reference ? ' / ' + doc.reference : ''}`
    });
  };

  const convertToInvoice = (id: string): Invoice | null => {
    const doc = documents.find(d => d.id === id);
    if (!doc || doc.status === 'CONVERTED' || doc.status === 'CANCELLED' || isPurchaseDoc(doc.docType) || doc.docType === 'CREDIT_NOTE') return null;
    const party = parties.find(p => p.id === doc.partyId);

    const t = docTotals(doc.items, settings.roundOff);
    const invoiceNumber = nextInvoiceNumber();
    const inv = addInvoice({
      invoiceNumber,
      businessId: doc.businessId,
      customerId: doc.partyId,
      customerName: doc.partyName,
      customerGstin: doc.partyGstin,
      customerPhone: party?.phone ?? '',
      customerAddress: party?.billingAddress ?? '',
      customerStateCode: doc.partyStateCode,
      invoiceDate: localDate(),
      dueDate: localDate(settings.defaultDueDays),
      isInterState: doc.isInterState,
      items: doc.items,
      ...t,
      amountPaid: 0,
      balanceDue: t.grandTotal,
      status: 'UNPAID',
      notes: `Converted from ${DOC_LABEL[doc.docType]} ${doc.number}. ${settings.defaultNotes}`
    });
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, status: 'CONVERTED', convertedTo: invoiceNumber } : d)));
    return inv;
  };

  const convertPoToBill = (id: string, supplierBillNo: string) => {
    const po = documents.find(d => d.id === id);
    if (!po || po.docType !== 'PURCHASE_ORDER' || po.status !== 'OPEN') return;
    const bill = createDocument({
      ...po,
      docType: 'PURCHASE_BILL',
      date: localDate(),
      reference: supplierBillNo,
      itcEligible: true,
      amountPaid: 0,
      notes: `Against ${po.number}`
    });
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, status: 'CONVERTED', convertedTo: bill.number } : d)));
  };

  const markDelivered = (id: string) => {
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, status: 'DELIVERED' } : d)));
    showToast('Marked as delivered');
  };

  const addExpense = (e: Omit<Expense, 'id' | 'number' | 'businessId'>) => {
    const prefix = 'EXP/' + settings.prefix.split('/')[1] + '/';
    const n = nextSerial(prefix, expenses.map(x => x.number), 1);
    const exp: Expense = { ...e, id: 'exp-' + Date.now(), number: prefix + pad(n, settings.padding), businessId: activeBusiness.id };
    setExpenses(prev => [exp, ...prev]);
    showToast(`Expense ${exp.number} recorded`);
    logAudit('EXPENSE_ADD', `${exp.category}: ₹${exp.total} to ${exp.vendorName}`);
  };

  const deleteExpense = (id: string) => {
    const exp = expenses.find(x => x.id === id);
    setExpenses(prev => prev.filter(x => x.id !== id));
    if (exp) logAudit('EXPENSE_DELETE', `Deleted expense ${exp.number} (₹${exp.total})`, 'WARNING');
  };

  const updateSettings = (s: InvoiceSettings) => {
    setSettings(s);
    showToast('Invoice settings saved');
    logAudit('INVOICE_SETTINGS', `Prefix ${s.prefix}, next no. ${s.nextNumber}, template ${s.template}`);
  };

  const resetDocuments = () => {
    setDocuments(INITIAL_DOCUMENTS);
    setExpenses(INITIAL_EXPENSES);
    setSettings(INITIAL_INVOICE_SETTINGS);
  };

  return (
    <DocumentsContext.Provider
      value={{
        documents,
        expenses,
        settings,
        nextDocNumber,
        nextInvoiceNumber,
        createDocument,
        cancelDocument,
        payPurchaseBill,
        convertToInvoice,
        convertPoToBill,
        markDelivered,
        addExpense,
        deleteExpense,
        updateSettings,
        resetDocuments
      }}
    >
      {children}
    </DocumentsContext.Provider>
  );
};

export const useDocuments = () => {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments must be used within a DocumentsProvider');
  return ctx;
};
