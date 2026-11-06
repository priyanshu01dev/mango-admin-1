import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AccessLevel,
  AdminScreen,
  AdminUser,
  AuditLog,
  BusinessProfile,
  EInvoiceRecord,
  EWayBillRecord,
  Invoice,
  Language,
  MangoPlan,
  Party,
  PaymentTransaction,
  Product,
  Quotation,
  SubscriptionPlan,
} from '../types';
import { api, ApiError, token, UNAUTHORIZED } from '../lib/api';

/**
 * Admin data comes from the Mango Invoice backend:
 *  - the list of businesses using the Android app
 *  - for the selected business, its books (invoices, parties, stock, payments…) as last synced from the phone
 *
 * A business's books are owned by the phone app (it is the source of truth and syncs to the server),
 * so they are READ-ONLY here. Admin actions that belong to the platform — plan changes, suspending a
 * business — go to the server and are recorded in the audit log.
 */
export interface TeamMember { name: string; phone: string; role: string; lastActive: string; active: boolean }

interface BillingContextType {
  language: Language;
  setLanguage: (lang: Language) => void;

  // auth
  admin: AdminUser | null;
  authReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** True if the signed-in admin has [level] (default view) on [screen]. The server enforces the same rules. */
  can: (screen: AdminScreen, level?: AccessLevel) => boolean;
  /** True if the admin can open any screen that shows a business's data. */
  hasBusinessAccess: boolean;
  /** Re-reads the signed-in admin (e.g. after changing your own permissions). */
  refreshMe: () => Promise<void>;

  // data state
  loading: boolean;
  error: string | null;
  reload: () => void;
  readOnly: true;
  hasSnapshot: boolean;

  businesses: BusinessProfile[];
  activeBusiness: BusinessProfile;
  setActiveBusinessId: (id: string) => void;
  updateBusinessProfile: (profile: BusinessProfile) => void;

  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Invoice;
  updateInvoiceStatus: (id: string, status: Invoice['status']) => void;
  deleteInvoice: (id: string) => void;
  generateEWayBill: (invoiceId: string, details: { transporterName: string; transporterId: string; vehicleNumber: string; approxDistanceKm: number }) => EWayBillRecord;
  generateEInvoice: (invoiceId: string) => EInvoiceRecord;

  quotations: Quotation[];
  addQuotation: (quotation: Omit<Quotation, 'id'>) => Quotation;
  convertQuotationToInvoice: (quotationId: string) => Invoice | null;

  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (product: Product) => void;
  adjustProductStock: (productId: string, quantityChange: number, reason: string) => void;

  parties: Party[];
  addParty: (party: Omit<Party, 'id'>) => void;
  updateParty: (party: Party) => void;

  payments: PaymentTransaction[];
  recordPayment: (payment: Omit<PaymentTransaction, 'id'>) => void;

  ewayBills: EWayBillRecord[];
  eInvoices: EInvoiceRecord[];
  team: TeamMember[];

  // platform (server) data & actions
  plans: MangoPlan[];
  subscriptionPlans: SubscriptionPlan[];
  changePlan: (planId: string, months: number, reason: string) => Promise<void>;
  setBusinessStatus: (status: 'active' | 'suspended', reason?: string) => Promise<void>;
  auditLogs: AuditLog[];

  selectedInvoiceForPrint: Invoice | null;
  setSelectedInvoiceForPrint: (inv: Invoice | null) => void;

  quickNotification: string | null;
  showToast: (msg: string) => void;
  resetAllToDefault: () => void;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

const EMPTY_BUSINESS: BusinessProfile = {
  id: '', name: '', tradeName: '', gstin: '', pan: '', email: '', phone: '', address: '', city: '', state: '', stateCode: '',
  pincode: '', bankName: '', bankAccountNumber: '', bankIfsc: '', bankBranch: '', upiId: '', terms: '', activePlan: 'FREE',
  planValidUntil: '', status: 'ACTIVE',
};

const PLAN_CODES: Record<string, string> = { free: 'FREE', silver: 'SILVER', gold: 'GOLD', platinum: 'PLATINUM' };

/** Screens that show one business's data (backend BUSINESS_SCREENS). */
export const BUSINESS_SCREENS: AdminScreen[] = ['dashboard', 'invoices', 'quotations', 'eway', 'inventory', 'parties', 'payments', 'gst', 'subscriptions', 'attendance', 'audit', 'businesses'];

export const canAccess = (admin: AdminUser | null, screen: AdminScreen, level: AccessLevel = 'view') => {
  if (!admin) return false;
  if (admin.isSuperAdmin) return true;
  const l = admin.permissions[screen];
  return level === 'view' ? l === 'view' || l === 'edit' : l === 'edit';
};

interface Workspace {
  business: BusinessProfile; invoices: Invoice[]; quotations: Quotation[]; products: Product[]; parties: Party[];
  payments: PaymentTransaction[]; ewayBills: EWayBillRecord[]; eInvoices: EInvoiceRecord[]; team: TeamMember[]; hasSnapshot: boolean;
}

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('mango_admin_lang') as Language) || 'hi');
  useEffect(() => { localStorage.setItem('mango_admin_lang', language); }, [language]);

  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [activeBusinessId, setActiveBusinessIdState] = useState<string>(() => localStorage.getItem('mango_admin_active_biz') || '');
  const [ws, setWs] = useState<Workspace | null>(null);
  const [plans, setPlans] = useState<MangoPlan[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [quickNotification, setQuickNotification] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setQuickNotification(msg);
    setTimeout(() => setQuickNotification(null), 4000);
  }, []);
  const hi = language === 'hi';

  // ── Auth ──
  const logout = useCallback(() => { token.clear(); setAdmin(null); setWs(null); setBusinesses([]); }, []);
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED, logout);
    if (!token.get()) { setAuthReady(true); return () => window.removeEventListener(UNAUTHORIZED, logout); }
    api<{ admin: AdminUser }>('/auth/me').then((r) => setAdmin(r.admin)).catch(() => token.clear()).finally(() => setAuthReady(true));
    return () => window.removeEventListener(UNAUTHORIZED, logout);
  }, [logout]);

  const refreshMe = useCallback(async () => {
    const r = await api<{ admin: AdminUser }>('/auth/me');
    setAdmin(r.admin);
  }, []);

  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; admin: AdminUser }>('/auth/login', { body: { email, password } });
    token.set(r.token);
    setAdmin(r.admin);
  };

  const can = useCallback((screen: AdminScreen, level: AccessLevel = 'view') => canAccess(admin, screen, level), [admin]);
  const hasBusinessAccess = BUSINESS_SCREENS.some((s) => canAccess(admin, s));

  // ── Businesses, plans, audit (only what this admin may see; the server refuses the rest) ──
  useEffect(() => {
    if (!admin) return;
    setError(null);
    if (!BUSINESS_SCREENS.some((s) => canAccess(admin, s))) { setBusinesses([]); return; }
    api<{ data: any[] }>('/businesses', { query: { pageSize: 200, sort: 'sales', dir: 'desc' } })
      .then((r) => {
        const list: BusinessProfile[] = r.data.map((b) => ({
          ...EMPTY_BUSINESS, id: b.id, name: b.name || 'Unnamed business', tradeName: b.name, gstin: b.gstin || 'Unregistered',
          city: b.city, state: b.state, stateCode: b.gstin?.slice(0, 2) ?? '', activePlan: PLAN_CODES[b.planId] ?? b.planId,
          planStatus: b.subStatus, planValidUntil: b.expiresAt ?? '', status: b.status === 'suspended' ? 'SUSPENDED' : 'ACTIVE',
          ownerName: b.ownerName, ownerPhone: b.ownerPhone, lastSyncAt: b.lastSyncAt,
        }));
        setBusinesses(list);
        setActiveBusinessIdState((cur) => (list.some((b) => b.id === cur) ? cur : list[0]?.id ?? ''));
      })
      .catch((e) => setError(e.message));
    if (canAccess(admin, 'subscriptions')) api<{ plans: MangoPlan[] }>('/plans').then((r) => setPlans(r.plans)).catch(() => {});
    if (canAccess(admin, 'audit')) {
      api<{ data: any[] }>('/audit', { query: { pageSize: 100 } }).then((r) => setAuditLogs(r.data.map((l) => ({
        id: l.id, timestamp: new Date(l.created_at).toLocaleString('en-IN'), userName: l.admin_name, role: 'Admin', ipAddress: l.ip ?? '—',
        action: String(l.action).toUpperCase().replace(/\s+/g, '_'), details: `${l.entity}${l.entity_id ? ' · ' + l.entity_id : ''}${Object.keys(l.meta ?? {}).length ? ' · ' + JSON.stringify(l.meta) : ''}`,
        status: 'SUCCESS' as const,
      })))).catch(() => {});
    }
  }, [admin, tick]);

  // ── Selected business's books ──
  useEffect(() => {
    if (!admin || !activeBusinessId || !BUSINESS_SCREENS.some((s) => canAccess(admin, s))) return;
    localStorage.setItem('mango_admin_active_biz', activeBusinessId);
    setLoading(true);
    api<Workspace>(`/businesses/${activeBusinessId}/workspace`)
      .then((w) => { setWs(w); setError(null); })
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [admin, activeBusinessId, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  const setActiveBusinessId = (id: string) => {
    setActiveBusinessIdState(id);
    const b = businesses.find((x) => x.id === id);
    if (b) showToast(hi ? `बिजनेस बदला: ${b.name}` : `Switched to ${b.name}`);
  };

  // ── Platform actions (server) ──
  const changePlan = async (planId: string, months: number, reason: string) => {
    await api(`/businesses/${activeBusinessId}/plan`, { body: { planId, months, reason } });
    showToast(hi ? 'प्लान बदल दिया गया' : 'Plan changed');
    reload();
  };
  const setBusinessStatus = async (status: 'active' | 'suspended', reason?: string) => {
    await api(`/businesses/${activeBusinessId}/status`, { method: 'PATCH', body: { status, reason } });
    showToast(status === 'suspended' ? (hi ? 'बिजनेस सस्पेंड किया गया' : 'Business suspended') : (hi ? 'बिजनेस फिर से चालू' : 'Business reactivated'));
    reload();
  };

  // ── Books are edited in the Android app, not here ──
  const readOnlyNotice = () => showToast(hi
    ? 'यह डेटा Mango Invoice ऐप से सिंक होता है — बदलाव ऐप में करें।'
    : 'This data syncs from the Mango Invoice app — make changes in the app.');
  const ro = <T,>(): T => { readOnlyNotice(); return undefined as T; };

  const subscriptionPlans: SubscriptionPlan[] = plans.map((p) => ({
    id: p.id, name: p.name, priceMonthly: Math.round(p.priceYearly / 12), priceYearly: p.priceYearly,
    invoiceLimit: 'Unlimited', eWayBillLimit: p.limits.eWayBill ? 'Unlimited' : 0, multiUserLimit: Number(p.limits.users ?? 1),
    features: p.features, activeUsersCount: p.businesses, badge: p.tag ?? undefined,
  }));

  return (
    <BillingContext.Provider
      value={{
        language, setLanguage,
        admin, authReady, login, logout, can, hasBusinessAccess, refreshMe,
        loading, error, reload, readOnly: true, hasSnapshot: ws?.hasSnapshot ?? false,
        businesses,
        activeBusiness: ws?.business ?? businesses.find((b) => b.id === activeBusinessId) ?? EMPTY_BUSINESS,
        setActiveBusinessId,
        updateBusinessProfile: () => ro(),
        invoices: ws?.invoices ?? [],
        addInvoice: () => ro(),
        updateInvoiceStatus: () => ro(),
        deleteInvoice: () => ro(),
        generateEWayBill: () => ro(),
        generateEInvoice: () => ro(),
        quotations: ws?.quotations ?? [],
        addQuotation: () => ro(),
        convertQuotationToInvoice: () => ro(),
        products: ws?.products ?? [],
        addProduct: () => ro(),
        updateProduct: () => ro(),
        adjustProductStock: () => ro(),
        parties: ws?.parties ?? [],
        addParty: () => ro(),
        updateParty: () => ro(),
        payments: ws?.payments ?? [],
        recordPayment: () => ro(),
        ewayBills: ws?.ewayBills ?? [],
        eInvoices: ws?.eInvoices ?? [],
        team: ws?.team ?? [],
        plans, subscriptionPlans, changePlan, setBusinessStatus, auditLogs,
        selectedInvoiceForPrint, setSelectedInvoiceForPrint,
        quickNotification, showToast,
        resetAllToDefault: reload,
      }}
    >
      {children}
    </BillingContext.Provider>
  );
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (!context) throw new Error('useBilling must be used within a BillingProvider');
  return context;
};
