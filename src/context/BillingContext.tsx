import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  BusinessProfile,
  Invoice,
  Quotation,
  Product,
  Party,
  PaymentTransaction,
  EWayBillRecord,
  EInvoiceRecord,
  AuditLog,
  Language,
  SubscriptionPlan
} from '../types';
import type { TradeDocument, Expense } from '../types/documents';
import { useAuth } from './AuthContext';
import { get, patch, post, errMsg } from '../api/client';
import {
  toBusiness,
  fromBusiness,
  toParty,
  fromParty,
  toProduct,
  fromProduct,
  toInvoice,
  fromItems,
  toEWayRecords,
  toEInvoiceRecords,
  toQuotation,
  toTradeDoc,
  toPayment,
  toExpense,
  toAudit
} from '../api/mappers';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;
export type BusinessRoleName = 'OWNER' | 'ADMIN' | 'SALESMAN' | 'ACCOUNTANT';

interface CurrentBusiness {
  business: Raw;
  role: BusinessRoleName;
  plan: Raw & { onTrial: boolean };
  usage: Record<string, number>;
  numbering: Record<string, string>;
}

interface BillingContextType {
  loading: boolean;
  hasBusiness: boolean;
  role: BusinessRoleName | null;
  current: CurrentBusiness | null;
  reload: () => Promise<void>;

  language: Language;
  setLanguage: (lang: Language) => void;
  businesses: BusinessProfile[];
  activeBusiness: BusinessProfile;
  setActiveBusinessId: (id: string) => void;
  updateBusinessProfile: (profile: BusinessProfile) => void;

  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Promise<boolean>;
  updateInvoiceStatus: (id: string, status: Invoice['status']) => void;
  deleteInvoice: (id: string) => void;
  cancelInvoice: (id: string, reason: string) => void;
  generateEWayBill: (invoiceId: string, details: { transporterName: string; transporterId: string; vehicleNumber: string; approxDistanceKm: number }) => void;
  generateEInvoice: (invoiceId: string) => void;

  quotations: Quotation[];
  addQuotation: (quotation: Omit<Quotation, 'id'>) => void;
  convertQuotationToInvoice: (quotationId: string) => void;

  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (product: Product) => void;
  adjustProductStock: (productId: string, quantityChange: number, reason: string) => void;

  parties: Party[];
  addParty: (party: Omit<Party, 'id'>) => void;
  updateParty: (party: Party) => void;

  payments: PaymentTransaction[];
  recordPayment: (payment: Omit<PaymentTransaction, 'id'>) => void;

  // other documents and expenses (used by DocumentsContext)
  tradeDocs: TradeDocument[];
  expenses: Expense[];

  ewayBills: EWayBillRecord[];
  eInvoices: EInvoiceRecord[];
  subscriptionPlans: SubscriptionPlan[];
  auditLogs: AuditLog[];

  selectedInvoiceForPrint: Invoice | null;
  setSelectedInvoiceForPrint: (inv: Invoice | null) => void;

  quickNotification: string | null;
  showToast: (msg: string) => void;
  /** Runs an API call, shows a toast with the result and reloads data. Returns true on success. */
  act: (fn: () => Promise<unknown>, okMsg?: string) => Promise<boolean>;
  logAudit: (action: string, details: string, status?: 'SUCCESS' | 'WARNING' | 'FAILED') => void;
  resetAllToDefault: () => void;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

const EMPTY_BUSINESS: BusinessProfile = {
  id: '', name: 'No business yet', tradeName: '', gstin: '', pan: '', email: '', phone: '', address: '', city: '', state: '', stateCode: '07',
  pincode: '', bankName: '', bankAccountNumber: '', bankIfsc: '', bankBranch: '', upiId: '', terms: '', activePlan: 'FREE_TRIAL', planValidUntil: '', status: 'ACTIVE'
};

const ALL_DOC_TYPES = 'QUOTATION,PROFORMA,SALES_ORDER,DELIVERY_CHALLAN,CREDIT_NOTE,PURCHASE_ORDER,PURCHASE_BILL,DEBIT_NOTE';
const EMPTY_RAW = { parties: [], products: [], invoices: [], payments: [], docs: [], expenses: [], audit: [] };

/** Returns [] when the role may not see a list (403), so screens still render for salesmen / CAs. */
const listOrEmpty = async (path: string): Promise<Raw[]> => {
  try {
    const r = await get<{ items: Raw[] } | Raw[]>(path);
    return Array.isArray(r) ? r : r.items;
  } catch (e) {
    if ((e as { status?: number }).status === 403) return [];
    throw e;
  }
};

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeBusinessId, memberships, selectBusiness } = useAuth();

  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('mango_lang') as Language) || 'en');
  useEffect(() => localStorage.setItem('mango_lang', language), [language]);

  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<CurrentBusiness | null>(null);
  const [raw, setRaw] = useState<Record<keyof typeof EMPTY_RAW, Raw[]>>(EMPTY_RAW);

  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [quickNotification, setQuickNotification] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setQuickNotification(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setQuickNotification(null), 5000);
  }, []);

  const reload = useCallback(async () => {
    if (!activeBusinessId) {
      setCurrent(null);
      setRaw(EMPTY_RAW);
      return;
    }
    setLoading(true);
    try {
      const [cur, parties, products, invoices, payments, docs, expenses, audit] = await Promise.all([
        get<CurrentBusiness>('/api/businesses/current'),
        listOrEmpty('/api/parties?limit=200'),
        listOrEmpty('/api/products?limit=200'),
        listOrEmpty('/api/invoices?limit=200'),
        listOrEmpty('/api/payments?limit=200'),
        listOrEmpty(`/api/documents?type=${ALL_DOC_TYPES}&limit=200`),
        listOrEmpty('/api/expenses?limit=200'),
        listOrEmpty('/api/businesses/current/audit?limit=200')
      ]);
      setCurrent(cur);
      setRaw({ parties, products, invoices, payments, docs, expenses, audit });
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [activeBusinessId, showToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, okMsg?: string) => {
      try {
        await fn();
        if (okMsg) showToast(okMsg);
        await reload();
        return true;
      } catch (e) {
        showToast(errMsg(e));
        return false;
      }
    },
    [reload, showToast]
  );

  // ---------- mapped views ----------
  const activeBusiness = useMemo(() => (current ? toBusiness(current.business) : EMPTY_BUSINESS), [current]);
  const businesses = useMemo(
    () => memberships.map(m => (current && m.business._id === String(current.business._id) ? activeBusiness : toBusiness(m.business))),
    [memberships, current, activeBusiness]
  );
  const parties = useMemo(() => raw.parties.map(toParty), [raw.parties]);
  const products = useMemo(() => raw.products.map(toProduct), [raw.products]);
  const invoices = useMemo(() => raw.invoices.map(toInvoice), [raw.invoices]);
  const payments = useMemo(() => raw.payments.map(toPayment), [raw.payments]);
  const quotations = useMemo(() => raw.docs.filter(d => d.docType === 'QUOTATION').map(toQuotation), [raw.docs]);
  const tradeDocs = useMemo(() => raw.docs.filter(d => d.docType !== 'QUOTATION').map(toTradeDoc), [raw.docs]);
  const expenses = useMemo(() => raw.expenses.map(toExpense), [raw.expenses]);
  const auditLogs = useMemo(() => raw.audit.map(toAudit), [raw.audit]);
  const ewayBills = useMemo(() => toEWayRecords(raw.invoices, activeBusiness.gstin), [raw.invoices, activeBusiness.gstin]);
  const eInvoices = useMemo(() => toEInvoiceRecords(raw.invoices), [raw.invoices]);

  const hi = language === 'hi';

  // ---------- actions (same signatures the screens already use) ----------
  const value: BillingContextType = {
    loading,
    hasBusiness: !!activeBusinessId && !!current,
    role: current?.role ?? null,
    current,
    reload,
    language,
    setLanguage,
    businesses,
    activeBusiness,
    setActiveBusinessId: id => selectBusiness(id),
    updateBusinessProfile: profile =>
      void act(async () => {
        await patch('/api/businesses/current', fromBusiness(profile));
        if (profile.terms !== (current?.business.invoiceSettings?.terms ?? '')) await patch('/api/businesses/current/settings', { terms: profile.terms });
      }, hi ? 'बिजनेस प्रोफाइल अपडेट हुई' : 'Business profile saved'),

    invoices,
    addInvoice: inv => {
      // the number in the form is only a preview: let the server allocate it unless the user typed another one
      const preview = current?.numbering.INV;
      return act(
        () =>
          post('/api/invoices', {
            ...(inv.customerId
              ? { partyId: inv.customerId }
              : {
                  walkIn: {
                    name: inv.customerName,
                    phone: inv.customerPhone || undefined,
                    address: inv.customerAddress || undefined,
                    stateCode: inv.customerStateCode,
                    gstin: inv.customerGstin || undefined
                  }
                }),
            date: inv.invoiceDate,
            dueDate: inv.dueDate,
            ...(inv.invoiceNumber && inv.invoiceNumber !== preview ? { number: inv.invoiceNumber } : {}),
            items: fromItems(inv.items),
            amountPaid: inv.amountPaid || undefined,
            paymentMode: inv.amountPaid ? 'UPI' : undefined,
            notes: inv.notes || undefined
          }),
        hi ? 'इनवॉइस बनाई गई' : 'Invoice created'
      );
    },
    updateInvoiceStatus: () => showToast('Invoice status follows payments. Record a payment instead.'),
    deleteInvoice: () => showToast('Invoices cannot be deleted (GST Rule 46). Cancel with a reason instead.'),
    cancelInvoice: (id, reason) => void act(() => post(`/api/invoices/${id}/cancel`, { reason }), hi ? 'इनवॉइस रद्द की गई' : 'Invoice cancelled'),
    generateEWayBill: (invoiceId, d) =>
      void act(
        () =>
          post(`/api/invoices/${invoiceId}/ewaybill`, {
            vehicleNumber: d.vehicleNumber?.replace(/[\s-]/g, '').toUpperCase() || undefined,
            transporterId: d.transporterId?.trim().length === 15 ? d.transporterId.trim().toUpperCase() : undefined,
            distanceKm: Math.round(d.approxDistanceKm)
          }),
        'e-Way bill generated'
      ),
    generateEInvoice: invoiceId => void act(() => post(`/api/invoices/${invoiceId}/einvoice`), 'e-Invoice IRN generated'),

    quotations,
    addQuotation: q =>
      void act(
        () => post('/api/documents', { docType: 'QUOTATION', partyId: q.customerId, date: q.date, dueDate: q.validUntil, items: fromItems(q.items), notes: q.notes || undefined }),
        hi ? 'कोटेशन सेव हुआ' : 'Quotation saved'
      ),
    convertQuotationToInvoice: id => void act(() => post(`/api/documents/${id}/convert`), 'Quotation converted to invoice'),

    products,
    addProduct: p => void act(() => post('/api/products', fromProduct(p, true)), `Item ${p.name} added`),
    updateProduct: p => void act(() => patch(`/api/products/${p.id}`, fromProduct(p, false)), 'Item updated'),
    adjustProductStock: (id, qty, reason) =>
      void act(() => post(`/api/products/${id}/adjust`, { quantity: qty, reason: reason.length >= 2 ? reason : 'Manual adjustment' }), `Stock ${qty > 0 ? '+' : ''}${qty}`),

    parties,
    addParty: p => void act(() => post('/api/parties', fromParty(p)), `${p.name} added`),
    updateParty: p => {
      const { type: _t, openingBalance: _o, ...rest } = fromParty(p);
      void act(() => patch(`/api/parties/${p.id}`, rest), 'Party updated');
    },

    payments,
    recordPayment: p =>
      void act(
        () =>
          post('/api/payments', {
            type: p.type,
            partyId: p.partyId,
            invoiceId: p.type === 'PAYMENT_IN' ? p.invoiceId : undefined,
            amount: p.amount,
            date: p.paymentDate,
            mode: p.mode,
            reference: p.referenceNumber || undefined,
            notes: p.notes || undefined
          }),
        `Payment of ₹${p.amount.toLocaleString('en-IN')} recorded`
      ),

    tradeDocs,
    expenses,
    ewayBills,
    eInvoices,
    subscriptionPlans: [],
    auditLogs,
    selectedInvoiceForPrint,
    setSelectedInvoiceForPrint,
    quickNotification,
    showToast,
    act,
    // the server writes the audit trail for every change
    logAudit: () => undefined,
    resetAllToDefault: () => {
      reload().then(() => showToast(hi ? 'डेटा रीफ्रेश हुआ' : 'Data refreshed from the server'));
    }
  };

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (!context) throw new Error('useBilling must be used within a BillingProvider');
  return context;
};
