// Super-admin (platform) types — spec §8.14 "Monetisation & admin (internal)"

export type PlanId = 'free' | 'silver' | 'gold' | 'platinum';
export type BillingCycle = 'TRIAL' | '1Y' | '2Y' | '3Y' | 'LIFETIME';
export type ClientPlatform = 'Android' | 'iOS' | 'Web';

export interface PlanLimits {
  invoicesPerMonth: number | null; // null = unlimited
  users: number;
  businesses: number;
  eWayBillsPerYear: number | null;
  eInvoicesPerYear: number | null;
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  tagline: string;
  priceYearly: number;
  price2Years: number;
  price3Years: number;
  priceLifetime: number;
  limits: PlanLimits;
  features: string[];
  watermark: boolean;
  highlight?: string;
  isActive: boolean;
}

export type MerchantStatus = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'SUSPENDED' | 'CHURNED';

export interface Merchant {
  id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  gstin: string;
  gstType: 'REGULAR' | 'COMPOSITION' | 'UNREGISTERED';
  industry: string;
  city: string;
  state: string;
  planId: PlanId;
  cycle: BillingCycle;
  status: MerchantStatus;
  signupDate: string;
  trialEndsOn?: string;
  planValidUntil: string;
  lastActive: string;
  platforms: ClientPlatform[];
  language: 'English' | 'Hindi';
  aatoBand: '< ₹5 Cr' | '₹5–10 Cr' | '> ₹10 Cr';
  usage: {
    invoicesThisMonth: number;
    users: number;
    businesses: number;
    eWayBillsThisYear: number;
    eInvoicesThisYear: number;
  };
  lifetimeRevenue: number;
  notes?: string;
}

export type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
export type PaymentGateway = 'RAZORPAY' | 'PLAY_BILLING' | 'MANUAL';

export interface SubscriptionRecord {
  id: string;
  invoiceNo: string; // GST invoice issued by the platform for the subscription
  merchantId: string;
  merchantName: string;
  merchantGstin: string;
  planId: PlanId;
  cycle: BillingCycle;
  baseAmount: number;
  discount: number;
  gstAmount: number; // 18% GST on subscription
  totalAmount: number;
  gateway: PaymentGateway;
  status: SubscriptionStatus;
  startDate: string;
  renewsOn: string;
  autoRenew: boolean;
  couponCode?: string;
  addOns: string[];
}

export interface Coupon {
  id: string;
  code: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  appliesTo: PlanId[];
  maxRedemptions: number;
  redeemed: number;
  validUntil: string;
  active: boolean;
  description: string;
}

export interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  active: boolean;
  soldThisMonth: number;
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_MERCHANT' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'E_INVOICE' | 'EWAY_BILL' | 'GSTR_FILING' | 'SUBSCRIPTION' | 'APP_BUG' | 'PRINTING' | 'ACCOUNT';

export interface TicketMessage {
  id: string;
  from: 'MERCHANT' | 'AGENT' | 'SYSTEM';
  author: string;
  text: string;
  at: string;
}

export interface SupportTicket {
  id: string;
  ticketNo: string;
  merchantId: string;
  merchantName: string;
  phone: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  channel: 'WHATSAPP' | 'IN_APP' | 'EMAIL' | 'CALL';
  assignee: string;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  phase: 'P0' | 'P1' | 'P2';
  enabled: boolean;
  rollout: number; // 0-100 %
  plans: PlanId[];
  platforms: ClientPlatform[];
  updatedAt: string;
}

export type BroadcastChannel = 'PUSH' | 'WHATSAPP' | 'SMS' | 'EMAIL';
export type BroadcastSegment =
  | 'ALL'
  | 'FREE'
  | 'PAID'
  | 'TRIAL_EXPIRING'
  | 'PAST_DUE'
  | 'INACTIVE_14D'
  | 'EINVOICE_ELIGIBLE';

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  channels: BroadcastChannel[];
  segment: BroadcastSegment;
  language: 'English' | 'Hindi';
  status: 'DRAFT' | 'SCHEDULED' | 'SENT';
  scheduledAt?: string;
  sentAt?: string;
  recipients: number;
  delivered: number;
  opened: number;
  createdBy: string;
}

export type IntegrationStatus = 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR';

export interface Integration {
  key: string;
  name: string;
  category: 'GSP (e-Invoice / e-Way Bill)' | 'Payments' | 'Messaging' | 'Auth / OTP' | 'Storage & Backup';
  provider: string;
  providerOptions: string[];
  environment: 'SANDBOX' | 'PRODUCTION';
  status: IntegrationStatus;
  lastChecked: string;
  fields: { label: string; key: string; value: string; secret?: boolean }[];
  note: string;
}

export interface ComplianceRules {
  irpReportingWindowDays: number; // 30-day IRP window for AATO >= ₹10 Cr
  irnCancelWindowHours: number; // 24h
  eWayBillThreshold: number; // ₹50,000
  eWayBillMaxDocAgeDays: number; // 180 days (verify against GSTN advisory)
  eInvoiceAatoThresholdCr: number; // ₹5 Cr
  b2cLargeThreshold: number; // ₹50,000 unregistered buyer address rule
  hsnDigitsBelow5Cr: number; // 4
  hsnDigitsAbove5Cr: number; // 6
  invoiceNumberMaxLength: number; // 16
  warnDaysBeforeIrpDeadline: number;
}

export interface DailyMetric {
  date: string; // YYYY-MM-DD
  invoices: number;
  signups: number;
  activated: number; // created first invoice within 7 days
  activeMerchants: number;
}

export interface RetentionCohort {
  cohort: string; // e.g. "May 2026"
  size: number;
  retention: number[]; // % for month 0..n
}
