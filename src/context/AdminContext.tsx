import React, { createContext, useContext, useEffect, useState } from 'react';
import { useBilling } from './BillingContext';
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
  Integration,
  ComplianceRules
} from '../types/admin';
import {
  INITIAL_PLANS,
  INITIAL_MERCHANTS,
  INITIAL_SUBSCRIPTIONS,
  INITIAL_COUPONS,
  INITIAL_ADDONS,
  INITIAL_TICKETS,
  INITIAL_FLAGS,
  INITIAL_BROADCASTS,
  INITIAL_INTEGRATIONS,
  INITIAL_COMPLIANCE,
  ADMIN_TODAY,
  GST_ON_SUBSCRIPTION,
  cycleAmount
} from '../data/adminData';

const nowStamp = () => new Date().toISOString().replace('T', ' ').slice(0, 16);

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

interface AdminContextType {
  today: string;
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

  integrations: Integration[];
  updateIntegration: (i: Integration) => void;
  testIntegration: (key: string) => void;

  compliance: ComplianceRules;
  updateCompliance: (c: ComplianceRules) => void;

  resetAdminData: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast, logAudit } = useBilling();

  const [plans, setPlans] = usePersisted('mango_admin_plans', INITIAL_PLANS);
  const [merchants, setMerchants] = usePersisted('mango_admin_merchants', INITIAL_MERCHANTS);
  const [subscriptions, setSubscriptions] = usePersisted('mango_admin_subscriptions', INITIAL_SUBSCRIPTIONS);
  const [coupons, setCoupons] = usePersisted('mango_admin_coupons', INITIAL_COUPONS);
  const [addOns, setAddOns] = usePersisted('mango_admin_addons', INITIAL_ADDONS);
  const [tickets, setTickets] = usePersisted('mango_admin_tickets', INITIAL_TICKETS);
  const [flags, setFlags] = usePersisted('mango_admin_flags', INITIAL_FLAGS);
  const [broadcasts, setBroadcasts] = usePersisted('mango_admin_broadcasts', INITIAL_BROADCASTS);
  const [integrations, setIntegrations] = usePersisted('mango_admin_integrations', INITIAL_INTEGRATIONS);
  const [compliance, setCompliance] = usePersisted('mango_admin_compliance', INITIAL_COMPLIANCE);

  const merchantName = (id: string) => merchants.find(m => m.id === id)?.businessName ?? id;

  const updatePlan = (plan: PlanConfig) => {
    setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
    showToast(`Plan "${plan.name}" saved`);
    logAudit('PLAN_UPDATE', `Updated plan ${plan.name}: ₹${plan.priceYearly}/yr, users ${plan.limits.users}, businesses ${plan.limits.businesses}`);
  };

  const setMerchantStatus = (id: string, status: MerchantStatus, reason?: string) => {
    setMerchants(prev => prev.map(m => (m.id === id ? { ...m, status } : m)));
    showToast(`${merchantName(id)} → ${status}`);
    logAudit('MERCHANT_STATUS', `${merchantName(id)} set to ${status}${reason ? ` (${reason})` : ''}`, status === 'SUSPENDED' ? 'WARNING' : 'SUCCESS');
  };

  const extendTrial = (id: string, days: number) => {
    setMerchants(prev =>
      prev.map(m => {
        if (m.id !== id) return m;
        const base = m.trialEndsOn && m.trialEndsOn > ADMIN_TODAY ? m.trialEndsOn : ADMIN_TODAY;
        const d = new Date(base + 'T00:00:00');
        d.setDate(d.getDate() + days);
        const until = d.toISOString().slice(0, 10);
        return { ...m, status: 'TRIAL', cycle: 'TRIAL', trialEndsOn: until, planValidUntil: until };
      })
    );
    showToast(`Trial extended by ${days} days for ${merchantName(id)}`);
    logAudit('TRIAL_EXTEND', `Extended trial of ${merchantName(id)} by ${days} days`);
  };

  const changeMerchantPlan = (id: string, planId: PlanId, cycle: BillingCycle) => {
    const plan = plans.find(p => p.id === planId)!;
    const m = merchants.find(x => x.id === id);
    if (!m) return;
    const start = new Date(ADMIN_TODAY + 'T00:00:00');
    const end = new Date(start);
    if (cycle === 'LIFETIME') end.setFullYear(2099, 11, 31);
    else end.setFullYear(end.getFullYear() + (cycle === '2Y' ? 2 : cycle === '3Y' ? 3 : 1));
    const until = end.toISOString().slice(0, 10);

    setMerchants(prev =>
      prev.map(x => (x.id === id ? { ...x, planId, cycle, status: 'ACTIVE', planValidUntil: until, trialEndsOn: undefined } : x))
    );

    if (planId !== 'free') {
      const base = cycleAmount(plan, cycle);
      const gst = Math.round(base * GST_ON_SUBSCRIPTION) / 100;
      const record: SubscriptionRecord = {
        id: 'sub-' + Date.now(),
        invoiceNo: `MI/SUB/26-27/${String(subscriptions.length + 301).padStart(5, '0')}`,
        merchantId: id,
        merchantName: m.businessName,
        merchantGstin: m.gstin,
        planId,
        cycle,
        baseAmount: base,
        discount: 0,
        gstAmount: gst,
        totalAmount: base + gst,
        gateway: 'MANUAL',
        status: 'ACTIVE',
        startDate: ADMIN_TODAY,
        renewsOn: until,
        autoRenew: cycle !== 'LIFETIME',
        addOns: []
      };
      setSubscriptions(prev => [record, ...prev.map(s => (s.merchantId === id && s.status === 'ACTIVE' ? { ...s, status: 'CANCELLED' as const, autoRenew: false } : s))]);
    }
    showToast(`${m.businessName} moved to ${plan.name} (${cycle})`);
    logAudit('PLAN_CHANGE', `Admin changed ${m.businessName} plan to ${plan.name} / ${cycle}`);
  };

  const updateMerchantNotes = (id: string, notes: string) => {
    setMerchants(prev => prev.map(m => (m.id === id ? { ...m, notes } : m)));
    showToast('Internal note saved');
  };

  const setSubscriptionAutoRenew = (id: string, autoRenew: boolean) => {
    setSubscriptions(prev => prev.map(s => (s.id === id ? { ...s, autoRenew } : s)));
    showToast(`Auto-renew ${autoRenew ? 'enabled' : 'disabled'}`);
  };

  const cancelSubscription = (id: string) => {
    const sub = subscriptions.find(s => s.id === id);
    setSubscriptions(prev => prev.map(s => (s.id === id ? { ...s, status: 'CANCELLED', autoRenew: false } : s)));
    showToast(`Subscription ${sub?.invoiceNo} cancelled`);
    logAudit('SUBSCRIPTION_CANCEL', `Cancelled subscription ${sub?.invoiceNo} of ${sub?.merchantName}`, 'WARNING');
  };

  const retryPayment = (id: string) => {
    const sub = subscriptions.find(s => s.id === id);
    if (!sub) return;
    setSubscriptions(prev => prev.map(s => (s.id === id ? { ...s, status: 'ACTIVE' } : s)));
    setMerchants(prev => prev.map(m => (m.id === sub.merchantId && m.status === 'PAST_DUE' ? { ...m, status: 'ACTIVE' } : m)));
    showToast(`Payment collected for ${sub.merchantName}`);
    logAudit('PAYMENT_RETRY', `Retried ${sub.gateway} charge for ${sub.invoiceNo} — success`);
  };

  const addCoupon = (c: Omit<Coupon, 'id' | 'redeemed'>) => {
    setCoupons(prev => [{ ...c, id: 'cpn-' + Date.now(), redeemed: 0 }, ...prev]);
    showToast(`Coupon ${c.code} created`);
    logAudit('COUPON_CREATE', `Created coupon ${c.code} (${c.type === 'PERCENT' ? c.value + '%' : '₹' + c.value})`);
  };

  const toggleCoupon = (id: string) => {
    setCoupons(prev => prev.map(c => (c.id === id ? { ...c, active: !c.active } : c)));
  };

  const updateAddOn = (a: AddOn) => {
    setAddOns(prev => prev.map(x => (x.id === a.id ? a : x)));
    showToast(`Add-on "${a.name}" updated`);
  };

  const replyTicket = (id: string, text: string, author: string) => {
    setTickets(prev =>
      prev.map(t =>
        t.id === id
          ? {
              ...t,
              status: t.status === 'OPEN' ? 'IN_PROGRESS' : t.status,
              updatedAt: nowStamp(),
              messages: [...t.messages, { id: 'msg-' + Date.now(), from: 'AGENT', author, text, at: nowStamp() }]
            }
          : t
      )
    );
    showToast('Reply sent');
  };

  const setTicketStatus = (id: string, status: TicketStatus) => {
    setTickets(prev => prev.map(t => (t.id === id ? { ...t, status, updatedAt: nowStamp() } : t)));
    showToast(`Ticket marked ${status.replace(/_/g, ' ').toLowerCase()}`);
  };

  const assignTicket = (id: string, assignee: string) => {
    setTickets(prev => prev.map(t => (t.id === id ? { ...t, assignee, updatedAt: nowStamp() } : t)));
    showToast(`Assigned to ${assignee}`);
  };

  const updateFlag = (flag: FeatureFlag) => {
    setFlags(prev => prev.map(f => (f.key === flag.key ? { ...flag, updatedAt: ADMIN_TODAY } : f)));
    logAudit('FEATURE_FLAG', `${flag.key}: ${flag.enabled ? 'ON' : 'OFF'} · ${flag.rollout}% · plans ${flag.plans.join('/')}`);
  };

  const createBroadcast = (b: Omit<Broadcast, 'id' | 'delivered' | 'opened' | 'createdBy'>) => {
    const sent = b.status === 'SENT';
    setBroadcasts(prev => [
      {
        ...b,
        id: 'bc-' + Date.now(),
        sentAt: sent ? nowStamp() : undefined,
        delivered: sent ? Math.round(b.recipients * 0.965) : 0,
        opened: 0,
        createdBy: 'Super Admin'
      },
      ...prev
    ]);
    showToast(sent ? `Broadcast sent to ${b.recipients.toLocaleString('en-IN')} merchants` : b.status === 'SCHEDULED' ? 'Broadcast scheduled' : 'Draft saved');
    logAudit('BROADCAST', `${b.status} "${b.title}" → ${b.segment} via ${b.channels.join(', ')}`);
  };

  const updateIntegration = (i: Integration) => {
    setIntegrations(prev => prev.map(x => (x.key === i.key ? i : x)));
    showToast(`${i.name} settings saved`);
    logAudit('INTEGRATION_UPDATE', `Updated ${i.name} (${i.provider}, ${i.environment})`);
  };

  const testIntegration = (key: string) => {
    setIntegrations(prev =>
      prev.map(x => (x.key === key ? { ...x, status: 'CONNECTED', lastChecked: nowStamp() } : x))
    );
    const i = integrations.find(x => x.key === key);
    showToast(`${i?.name}: connection OK`);
  };

  const updateCompliance = (c: ComplianceRules) => {
    setCompliance(c);
    showToast('Compliance guardrails saved');
    logAudit('COMPLIANCE_RULES', 'Updated GST compliance guardrails');
  };

  const resetAdminData = () => {
    setPlans(INITIAL_PLANS);
    setMerchants(INITIAL_MERCHANTS);
    setSubscriptions(INITIAL_SUBSCRIPTIONS);
    setCoupons(INITIAL_COUPONS);
    setAddOns(INITIAL_ADDONS);
    setTickets(INITIAL_TICKETS);
    setFlags(INITIAL_FLAGS);
    setBroadcasts(INITIAL_BROADCASTS);
    setIntegrations(INITIAL_INTEGRATIONS);
    setCompliance(INITIAL_COMPLIANCE);
  };

  return (
    <AdminContext.Provider
      value={{
        today: ADMIN_TODAY,
        plans,
        updatePlan,
        merchants,
        setMerchantStatus,
        extendTrial,
        changeMerchantPlan,
        updateMerchantNotes,
        subscriptions,
        setSubscriptionAutoRenew,
        cancelSubscription,
        retryPayment,
        coupons,
        addCoupon,
        toggleCoupon,
        addOns,
        updateAddOn,
        tickets,
        replyTicket,
        setTicketStatus,
        assignTicket,
        flags,
        updateFlag,
        broadcasts,
        createBroadcast,
        integrations,
        updateIntegration,
        testIntegration,
        compliance,
        updateCompliance,
        resetAdminData
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within an AdminProvider');
  return ctx;
};
