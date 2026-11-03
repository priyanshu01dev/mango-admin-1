import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useBilling } from './BillingContext';
import { useAuth } from './AuthContext';
import { get, patch, post, put, errMsg } from '../api/client';
import {
  PlanConfig,
  Merchant,
  MerchantStatus,
  PlanId,
  BillingCycle,
  SubscriptionRecord,
  Coupon,
  AddOn,
  SupportTicket,
  TicketStatus,
  FeatureFlag,
  Broadcast,
  BroadcastSegment,
  ComplianceRules
} from '../types/admin';
import {
  toMerchant,
  toPlan,
  fromPlan,
  toSubscription,
  toCoupon,
  toTicket,
  toFlag,
  fromFlag,
  toBroadcast,
  toCompliance,
  fromCompliance,
  toAddOn
} from '../api/mappers';
import { localDate } from '../utils/gst';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

export interface IntegrationStatus {
  key: string;
  name: string;
  category: string;
  provider: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  status: 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR' | 'MOCK';
  envVars: string[];
  note: string;
}

export interface PlatformAnalytics {
  totals: { businesses: number; paid: number; trials: number; suspended: number; users: number };
  activation: { signups30: number; activated30: number; rate: number };
  revenue: { arr: number; mrr: number };
  planMix: Record<string, number>;
  invoicesPerDay: { _id: string; invoices: number; value: number }[];
  signupsPerDay: { _id: string; signups: number }[];
  activatedPerDay: { _id: string; activated: number }[];
  activeMerchantsPerDay: { _id: string; activeMerchants: number }[];
  thisMonth: { eInvoices: number; eWayBills: number };
  retention: { cohort: string; size: number; retention: number[] }[];
  openTickets: number;
}

interface AdminContextType {
  loading: boolean;
  today: string;
  reload: () => Promise<void>;
  analytics: PlatformAnalytics | null;
  segments: Record<BroadcastSegment, number>;

  plans: PlanConfig[];
  updatePlan: (plan: PlanConfig) => void;

  merchants: Merchant[];
  setMerchantStatus: (id: string, status: MerchantStatus, reason?: string) => void;
  extendTrial: (id: string, days: number) => void;
  changeMerchantPlan: (id: string, planId: PlanId, cycle: BillingCycle) => void;
  updateMerchantNotes: (id: string, notes: string) => void;

  subscriptions: SubscriptionRecord[];
  setSubscriptionAutoRenew: (id: string, autoRenew: boolean) => void;
  cancelSubscription: (id: string) => void;
  retryPayment: (id: string) => void;

  coupons: Coupon[];
  addCoupon: (c: Omit<Coupon, 'id' | 'redeemed'>) => void;
  toggleCoupon: (id: string) => void;

  addOns: AddOn[];
  updateAddOn: (a: AddOn) => void;

  tickets: SupportTicket[];
  replyTicket: (id: string, text: string, author: string) => void;
  setTicketStatus: (id: string, status: TicketStatus) => void;
  assignTicket: (id: string, assignee: string) => void;

  flags: FeatureFlag[];
  updateFlag: (flag: FeatureFlag) => void;

  broadcasts: Broadcast[];
  createBroadcast: (b: Omit<Broadcast, 'id' | 'delivered' | 'opened' | 'createdBy'>) => void;

  integrations: IntegrationStatus[];

  compliance: ComplianceRules;
  updateCompliance: (c: ComplianceRules) => void;

  resetAdminData: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const DEFAULT_COMPLIANCE: ComplianceRules = {
  irpReportingWindowDays: 30,
  irnCancelWindowHours: 24,
  eWayBillThreshold: 50000,
  eWayBillMaxDocAgeDays: 180,
  eInvoiceAatoThresholdCr: 5,
  b2cLargeThreshold: 50000,
  hsnDigitsBelow5Cr: 4,
  hsnDigitsAbove5Cr: 6,
  invoiceNumberMaxLength: 16,
  warnDaysBeforeIrpDeadline: 5
};

const EMPTY_SEGMENTS = { ALL: 0, FREE: 0, PAID: 0, TRIAL_EXPIRING: 0, PAST_DUE: 0, INACTIVE_14D: 0, EINVOICE_ELIGIBLE: 0 };

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isPlatformAdmin } = useAuth();
  const { showToast } = useBilling();
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [segments, setSegments] = useState<Record<BroadcastSegment, number>>(EMPTY_SEGMENTS);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [rawAddOns, setRawAddOns] = useState<Raw[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [compliance, setCompliance] = useState<ComplianceRules>(DEFAULT_COMPLIANCE);

  const reload = useCallback(async () => {
    if (!isPlatformAdmin) return;
    setLoading(true);
    try {
      const [a, seg, pl, m, s, c, ad, t, f, b, i, comp] = await Promise.all([
        get<PlatformAnalytics>('/api/admin/analytics'),
        get<Record<BroadcastSegment, number>>('/api/admin/segments'),
        get<Raw[]>('/api/admin/plans'),
        get<{ items: Raw[] }>('/api/admin/merchants?limit=200'),
        get<Raw[]>('/api/admin/subscriptions'),
        get<Raw[]>('/api/admin/coupons'),
        get<Raw[]>('/api/admin/addons'),
        get<Raw[]>('/api/admin/tickets'),
        get<Raw[]>('/api/admin/flags'),
        get<Raw[]>('/api/admin/broadcasts'),
        get<IntegrationStatus[]>('/api/admin/integrations'),
        get<Raw>('/api/admin/compliance')
      ]);
      setAnalytics(a);
      setSegments(seg);
      setPlans(pl.map(toPlan));
      setMerchants(m.items.map(toMerchant));
      setSubscriptions(s.map(toSubscription));
      setCoupons(c.map(toCoupon));
      setRawAddOns(ad);
      setAddOns(ad.map(toAddOn));
      setTickets(t.map(toTicket));
      setFlags(f.map(toFlag));
      setBroadcasts(b.map(toBroadcast));
      setIntegrations(i);
      setCompliance(toCompliance(comp));
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [isPlatformAdmin, showToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Admin mutation: call the API, toast, reload. */
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) showToast(ok);
      await reload();
    } catch (e) {
      showToast(errMsg(e));
    }
  };

  const merchantName = (id: string) => merchants.find(m => m.id === id)?.businessName ?? 'Merchant';

  const value: AdminContextType = {
    loading,
    today: localDate(),
    reload,
    analytics,
    segments,
    plans,
    updatePlan: p => void act(() => put(`/api/admin/plans/${p.id}`, fromPlan(p)), `Plan "${p.name}" saved`),

    merchants,
    setMerchantStatus: (id, status, reason) => void act(() => post(`/api/admin/merchants/${id}/status`, { status: status === 'TRIAL' ? 'ACTIVE' : status, reason }), `${merchantName(id)} → ${status}`),
    extendTrial: (id, days) => void act(() => post(`/api/admin/merchants/${id}/extend-trial`, { days }), `Trial extended by ${days} days`),
    changeMerchantPlan: (id, planId, cycle) =>
      void act(
        () => (planId === 'free' ? post(`/api/admin/merchants/${id}/downgrade`) : post(`/api/admin/merchants/${id}/subscription`, { planId, cycle: cycle === 'TRIAL' ? '1Y' : cycle })),
        planId === 'free' ? 'Moved to Free plan' : 'Plan activated and GST invoice issued'
      ),
    updateMerchantNotes: (id, notes) => void act(() => patch(`/api/admin/merchants/${id}/notes`, { notes }), 'Internal note saved'),

    subscriptions,
    setSubscriptionAutoRenew: (id, autoRenew) => void act(() => patch(`/api/admin/subscriptions/${id}`, { autoRenew }), `Auto-renew ${autoRenew ? 'on' : 'off'}`),
    cancelSubscription: id => void act(() => patch(`/api/admin/subscriptions/${id}`, { status: 'CANCELLED', autoRenew: false }), 'Subscription cancelled'),
    retryPayment: () => showToast('Payment gateway (Razorpay / Play Billing) is not connected yet, so a charge cannot be retried.'),

    coupons,
    addCoupon: c =>
      void act(
        () => post('/api/admin/coupons', { code: c.code, type: c.type, value: c.value, appliesTo: c.appliesTo.filter(p => p !== 'free'), maxRedemptions: c.maxRedemptions, validUntil: c.validUntil, description: c.description }),
        `Coupon ${c.code} created`
      ),
    toggleCoupon: id => {
      const c = coupons.find(x => x.id === id);
      if (c) void act(() => patch(`/api/admin/coupons/${id}`, { active: !c.active }));
    },

    addOns,
    updateAddOn: a =>
      void act(
        () => put('/api/admin/addons', rawAddOns.map(x => (x.id === a.id ? { id: a.id, name: a.name, description: a.description, price: a.price, unit: a.unit, active: a.active } : x))),
        `Add-on "${a.name}" saved`
      ),

    tickets,
    replyTicket: (id, text) => void act(() => post(`/api/admin/tickets/${id}/reply`, { text }), 'Reply sent'),
    setTicketStatus: (id, status) => void act(() => patch(`/api/admin/tickets/${id}`, { status }), `Ticket ${status.replace(/_/g, ' ').toLowerCase()}`),
    assignTicket: (id, assignee) => void act(() => patch(`/api/admin/tickets/${id}`, { assignee }), `Assigned to ${assignee}`),

    flags,
    updateFlag: f => void act(() => put(`/api/admin/flags/${f.key}`, fromFlag(f))),

    broadcasts,
    createBroadcast: b =>
      void act(
        () =>
          post('/api/admin/broadcasts', {
            title: b.title,
            message: b.message,
            channels: b.channels,
            segment: b.segment,
            language: b.language,
            send: b.status === 'SENT' ? 'NOW' : b.status === 'SCHEDULED' ? 'SCHEDULE' : 'DRAFT',
            scheduledAt: b.status === 'SCHEDULED' && b.scheduledAt ? new Date(b.scheduledAt).toISOString() : undefined
          }),
        b.status === 'SENT' ? 'Broadcast queued for delivery' : b.status === 'SCHEDULED' ? 'Broadcast scheduled' : 'Draft saved'
      ),

    integrations,
    compliance,
    updateCompliance: c => void act(() => put('/api/admin/compliance', fromCompliance(c)), 'Compliance rules published'),
    resetAdminData: () => void reload()
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within an AdminProvider');
  return ctx;
};
