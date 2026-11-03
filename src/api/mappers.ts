/**
 * API (server) shapes → the UI types the existing screens were built on, and back.
 * Keeping the conversion here means the screens did not have to be rewritten.
 */
import type { BusinessProfile, Invoice, InvoiceItem, Party, Product, PaymentTransaction, Quotation, AuditLog, EWayBillRecord, EInvoiceRecord } from '../types';
import type { TradeDocument, Expense, InvoiceSettings, DocType, ExpenseCategory } from '../types/documents';
import type { Merchant, PlanConfig, SubscriptionRecord, Coupon, SupportTicket, FeatureFlag, Broadcast, ComplianceRules, AddOn } from '../types/admin';
import { fyLabel } from '../../shared/gst';
import { localDate } from '../utils/gst';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;
const id = (r: Raw) => String(r._id ?? r.id);
const day = (d?: string | Date) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const stamp = (d?: string | Date) => (d ? new Date(d).toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16) : '');

// ---------------- business ----------------

const PLAN_TO_LEGACY: Record<string, BusinessProfile['activePlan']> = { free: 'FREE_TRIAL', silver: 'STARTER', gold: 'GROWTH', platinum: 'ENTERPRISE' };

export function toBusiness(b: Raw): BusinessProfile {
  return {
    id: id(b),
    name: b.name ?? '',
    tradeName: b.tradeName ?? '',
    gstin: b.gstin ?? '',
    pan: b.pan ?? '',
    email: b.email ?? '',
    phone: b.phone ?? '',
    address: b.address ?? '',
    city: b.city ?? '',
    state: b.state ?? '',
    stateCode: b.stateCode ?? '',
    pincode: b.pincode ?? '',
    bankName: b.bank?.name ?? '',
    bankAccountNumber: b.bank?.accountNumber ?? '',
    bankIfsc: b.bank?.ifsc ?? '',
    bankBranch: b.bank?.branch ?? '',
    upiId: b.upiId ?? '',
    signatureText: b.signatureText ?? '',
    terms: b.invoiceSettings?.terms ?? '',
    activePlan: PLAN_TO_LEGACY[b.planId] ?? 'FREE_TRIAL',
    planValidUntil: b.planValidUntil || b.trialEndsOn || '',
    status: b.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE'
  };
}

export function fromBusiness(p: BusinessProfile) {
  return {
    name: p.name,
    tradeName: p.tradeName,
    gstin: p.gstin,
    pan: p.pan,
    email: p.email,
    phone: p.phone,
    address: p.address,
    city: p.city,
    stateCode: p.stateCode,
    pincode: p.pincode,
    bank: { name: p.bankName, accountNumber: p.bankAccountNumber, ifsc: p.bankIfsc, branch: p.bankBranch },
    upiId: p.upiId,
    signatureText: p.signatureText
  };
}

// ---------------- masters ----------------

export const toParty = (p: Raw): Party => ({
  id: id(p),
  businessId: String(p.businessId),
  type: p.type,
  name: p.name,
  contactPerson: p.contactPerson,
  phone: p.phone ?? '',
  email: p.email,
  gstin: p.gstin || undefined,
  pan: p.pan || undefined,
  billingAddress: p.billingAddress ?? '',
  state: p.state ?? '',
  stateCode: p.stateCode,
  openingBalance: p.openingBalance ?? 0,
  currentBalance: p.balance ?? 0,
  creditLimit: p.creditLimit,
  status: p.status
});

export const fromParty = (p: Omit<Party, 'id'> | Party) => ({
  type: p.type,
  name: p.name,
  contactPerson: p.contactPerson || undefined,
  phone: p.phone || undefined,
  email: p.email || undefined,
  gstin: p.gstin?.toUpperCase() || undefined,
  pan: p.pan?.toUpperCase() || undefined,
  billingAddress: p.billingAddress || undefined,
  stateCode: p.stateCode,
  openingBalance: p.openingBalance || undefined,
  creditLimit: p.creditLimit || undefined,
  status: p.status
});

export const toProduct = (p: Raw): Product => ({
  id: id(p),
  businessId: String(p.businessId),
  name: p.name,
  sku: p.sku ?? '',
  hsnCode: p.hsnCode,
  category: p.category ?? '',
  unit: p.unit ?? 'PCS',
  purchasePrice: p.purchasePrice ?? 0,
  sellingPrice: p.sellingPrice ?? 0,
  taxRate: p.taxRate ?? 18,
  currentStock: p.stock ?? 0,
  minStockAlert: p.minStock ?? 0,
  status: p.status
});

export const fromProduct = (p: Omit<Product, 'id'> | Product, includeStock: boolean) => ({
  name: p.name,
  sku: p.sku || undefined,
  hsnCode: p.hsnCode,
  category: p.category || undefined,
  unit: p.unit,
  purchasePrice: p.purchasePrice,
  sellingPrice: p.sellingPrice,
  taxRate: p.taxRate,
  minStock: p.minStockAlert,
  status: p.status,
  ...(includeStock ? { openingStock: p.currentStock } : {})
});

// ---------------- documents ----------------

const toItem = (i: Raw): InvoiceItem => ({
  id: String(i.id ?? i._id ?? Math.random()),
  productId: i.productId ? String(i.productId) : undefined,
  name: i.name,
  hsnCode: i.hsnCode,
  quantity: i.quantity,
  unit: i.unit ?? 'PCS',
  price: i.price,
  discountPercent: i.discountPercent ?? 0,
  priceIncludesTax: !!i.priceIncludesTax,
  gstRate: i.gstRate,
  taxableAmount: i.taxableAmount ?? 0,
  cgstAmount: i.cgstAmount ?? 0,
  sgstAmount: i.sgstAmount ?? 0,
  igstAmount: i.igstAmount ?? 0,
  totalAmount: i.totalAmount ?? 0
});

/** Only what the server needs: it recomputes tax and totals itself. */
export const fromItems = (items: InvoiceItem[]) =>
  items.map(i => ({ productId: i.productId || undefined, name: i.name, hsnCode: i.hsnCode, unit: i.unit, quantity: i.quantity, price: i.price, discountPercent: i.discountPercent || 0, gstRate: i.gstRate, priceIncludesTax: i.priceIncludesTax || undefined }));

export const toInvoice = (i: Raw): Invoice => ({
  id: id(i),
  invoiceNumber: i.number,
  businessId: String(i.businessId),
  customerId: i.partyId ? String(i.partyId) : '',
  customerName: i.partyName,
  customerGstin: i.partyGstin || undefined,
  customerPhone: i.partyPhone ?? '',
  customerAddress: i.partyAddress ?? '',
  customerStateCode: i.partyStateCode,
  invoiceDate: i.date,
  dueDate: i.dueDate ?? i.date,
  isInterState: i.isInterState,
  items: (i.items ?? []).map(toItem),
  subTotal: i.subTotal ?? 0,
  totalDiscount: i.totalDiscount ?? 0,
  taxableTotal: i.taxableTotal ?? 0,
  cgstTotal: i.cgstTotal ?? 0,
  sgstTotal: i.sgstTotal ?? 0,
  igstTotal: i.igstTotal ?? 0,
  totalGst: i.totalGst ?? 0,
  roundOff: i.roundOff ?? 0,
  grandTotal: i.grandTotal ?? 0,
  amountPaid: i.amountPaid ?? 0,
  balanceDue: i.balanceDue ?? 0,
  status: i.status,
  notes: [i.cancelReason ? `CANCELLED: ${i.cancelReason}` : '', i.notes ?? ''].filter(Boolean).join(' | '),
  eInvoiceStatus: i.eInvoice?.status === 'GENERATED' ? 'GENERATED' : i.eInvoice?.status === 'FAILED' ? 'FAILED' : 'NOT_GENERATED',
  irnNumber: i.eInvoice?.status === 'GENERATED' ? i.eInvoice.irn : undefined,
  irnMock: !!i.eInvoice?.mock,
  billDiscount: i.billDiscount ?? 0,
  charges: i.charges ?? [],
  chargesTotal: i.chargesTotal ?? 0,
  tcsRate: i.tcsRate ?? 0,
  tcsAmount: i.tcsAmount ?? 0,
  tdsDeducted: i.tdsDeducted ?? 0,
  shippingAddress: i.shippingAddress || undefined,
  poNumber: i.poNumber || undefined,
  transport: i.transport,
  eWayBillStatus: i.eWayBill?.status === 'GENERATED' ? 'GENERATED' : 'NOT_GENERATED',
  eWayBillNumber: i.eWayBill?.status === 'GENERATED' ? i.eWayBill.number : undefined,
  createdAt: i.createdAt
});

export const toEWayRecords = (invoices: Raw[], sellerGstin: string): EWayBillRecord[] =>
  invoices
    .filter(i => i.eWayBill?.status === 'GENERATED' || i.eWayBill?.status === 'CANCELLED')
    .map(i => ({
      id: id(i) + '-ewb',
      ewbNumber: i.eWayBill.number + (i.eWayBill.mock ? ' (MOCK)' : ''),
      invoiceNumber: i.number,
      invoiceId: id(i),
      fromGstin: sellerGstin,
      toGstin: i.partyGstin || 'URP',
      transporterName: '',
      transporterId: i.eWayBill.transporterId ?? '',
      vehicleNumber: i.eWayBill.vehicleNumber ?? '',
      approxDistanceKm: i.eWayBill.distanceKm ?? 0,
      supplyType: 'Outward',
      documentType: 'Tax Invoice',
      generatedDate: stamp(i.updatedAt),
      validUpto: stamp(i.eWayBill.validUpto),
      status: i.eWayBill.status === 'GENERATED' ? 'ACTIVE' : 'CANCELLED'
    }));

export const toEInvoiceRecords = (invoices: Raw[]): EInvoiceRecord[] =>
  invoices
    .filter(i => i.eInvoice?.status === 'GENERATED' || i.eInvoice?.status === 'CANCELLED')
    .map(i => ({
      id: id(i) + '-irn',
      irn: i.eInvoice.irn,
      ackNo: i.eInvoice.ackNo + (i.eInvoice.mock ? ' (MOCK)' : ''),
      ackDate: stamp(i.eInvoice.ackDate),
      invoiceNumber: i.number,
      invoiceId: id(i),
      buyerGstin: i.partyGstin,
      totalValue: i.grandTotal,
      status: i.eInvoice.status === 'GENERATED' ? 'ACTIVE' : 'CANCELLED',
      signedQrCodePayload: i.eInvoice.signedQr ?? ''
    }));

export const toQuotation = (d: Raw): Quotation => ({
  id: id(d),
  quotationNumber: d.number,
  businessId: String(d.businessId),
  customerId: String(d.partyId),
  customerName: d.partyName,
  customerGstin: d.partyGstin || undefined,
  customerPhone: d.partyPhone ?? '',
  customerAddress: d.partyAddress ?? '',
  customerStateCode: d.partyStateCode,
  date: d.date,
  validUntil: d.dueDate ?? d.date,
  isInterState: d.isInterState,
  items: (d.items ?? []).map(toItem),
  grandTotal: d.grandTotal,
  status: d.status === 'CONVERTED' ? 'CONVERTED' : d.status === 'CANCELLED' ? 'EXPIRED' : d.dueDate && d.dueDate < localDate() ? 'EXPIRED' : 'SENT',
  convertedInvoiceId: d.convertedTo || undefined,
  notes: d.notes
});

export const toTradeDoc = (d: Raw): TradeDocument => ({
  id: id(d),
  docType: d.docType,
  number: d.number,
  businessId: String(d.businessId),
  partyId: String(d.partyId),
  partyName: d.partyName,
  partyGstin: d.partyGstin || undefined,
  partyStateCode: d.partyStateCode,
  date: d.date,
  dueDate: d.dueDate,
  isInterState: d.isInterState,
  items: (d.items ?? []).map(toItem),
  taxableTotal: d.taxableTotal ?? 0,
  cgstTotal: d.cgstTotal ?? 0,
  sgstTotal: d.sgstTotal ?? 0,
  igstTotal: d.igstTotal ?? 0,
  totalGst: d.totalGst ?? 0,
  roundOff: d.roundOff ?? 0,
  grandTotal: d.grandTotal ?? 0,
  // debit notes reduce what we owe on a bill, just like a payment
  amountPaid: (d.amountPaid ?? 0) + (d.adjustedAmount ?? 0),
  status: d.status,
  reference: d.reference || undefined,
  reason: d.reason || undefined,
  restock: d.restock,
  itcEligible: d.itcEligible,
  vehicleNumber: d.vehicleNumber || undefined,
  convertedTo: d.convertedTo || undefined,
  notes: [d.cancelReason ? `CANCELLED: ${d.cancelReason}` : '', d.notes ?? ''].filter(Boolean).join(' | ') || undefined,
  createdAt: d.createdAt
});

export const toPayment = (p: Raw): PaymentTransaction => ({
  id: id(p),
  businessId: String(p.businessId),
  type: p.type,
  partyId: p.partyId ? String(p.partyId) : '',
  partyName: p.partyName ?? '',
  invoiceId: p.refType === 'INVOICE' ? String(p.refId) : undefined,
  invoiceNumber: p.refNumber || undefined,
  amount: p.amount,
  tdsAmount: p.tdsAmount || undefined,
  paymentDate: p.date,
  mode: p.mode,
  referenceNumber: p.reference || p.refNumber || '',
  notes: p.notes
});

export const toExpense = (e: Raw): Expense => ({
  id: id(e),
  businessId: String(e.businessId),
  number: e.number,
  date: e.date,
  category: e.category as ExpenseCategory,
  vendorName: e.vendorName,
  vendorGstin: e.vendorGstin || undefined,
  description: e.description ?? '',
  amount: e.amount,
  gstRate: e.gstRate ?? 0,
  gstAmount: e.gstAmount ?? 0,
  total: e.total ?? 0,
  mode: e.mode,
  itcEligible: !!e.itcEligible,
  reference: e.reference || undefined
});

export const toAudit = (a: Raw): AuditLog => ({
  id: id(a),
  timestamp: stamp(a.createdAt),
  userName: a.userName ?? 'System',
  role: '',
  ipAddress: a.ip ?? '',
  action: a.action,
  details: a.details ?? '',
  status: a.status ?? 'SUCCESS'
});

const UI_DOC_TYPES: DocType[] = ['PROFORMA', 'SALES_ORDER', 'DELIVERY_CHALLAN', 'CREDIT_NOTE', 'PURCHASE_ORDER', 'PURCHASE_BILL', 'DEBIT_NOTE'];

export function toSettings(s: Raw, numbering: Record<string, string>): InvoiceSettings {
  const nextInv = numbering.INV ?? '';
  const seq = parseInt(nextInv.match(/(\d+)$/)?.[1] ?? '1', 10);
  return {
    prefix: s.prefix ?? 'INV/{FY}/',
    nextNumber: seq,
    padding: s.padding ?? 4,
    financialYearReset: s.financialYearReset ?? true,
    template: s.template ?? 'A4_CLASSIC',
    showUpiQr: s.showUpiQr ?? true,
    showBankDetails: s.showBankDetails ?? true,
    showSignature: s.showSignature ?? true,
    defaultDueDays: s.defaultDueDays ?? 15,
    defaultNotes: s.defaultNotes ?? '',
    roundOff: s.roundOff ?? true,
    docPrefixes: Object.fromEntries(UI_DOC_TYPES.map(t => [t, s.docPrefixes?.[t] ?? `${t.slice(0, 2)}/{FY}/`])) as Record<DocType, string>
  };
}

export const fromSettings = (s: InvoiceSettings) => ({
  prefix: s.prefix,
  padding: s.padding,
  financialYearReset: s.financialYearReset,
  template: s.template,
  showUpiQr: s.showUpiQr,
  showBankDetails: s.showBankDetails,
  showSignature: s.showSignature,
  roundOff: s.roundOff,
  defaultDueDays: s.defaultDueDays,
  defaultNotes: s.defaultNotes,
  docPrefixes: s.docPrefixes
});

/** "{FY}" in a prefix → the current financial year, for previews. */
export const expandPrefix = (prefix: string) => prefix.replace('{FY}', fyLabel(localDate()));

// ---------------- platform admin ----------------

const AATO_LABEL: Record<string, Merchant['aatoBand']> = { UPTO_5CR: '< ₹5 Cr', '5_TO_10CR': '₹5–10 Cr', ABOVE_10CR: '> ₹10 Cr' };

export function toMerchant(b: Raw): Merchant {
  const today = localDate();
  const onTrial = !!b.trialPlanId && !!b.trialEndsOn && b.trialEndsOn >= today;
  const status: Merchant['status'] = b.status !== 'ACTIVE' ? b.status : onTrial ? 'TRIAL' : 'ACTIVE';
  const owner = b.ownerId && typeof b.ownerId === 'object' ? b.ownerId : {};
  return {
    id: id(b),
    businessName: b.tradeName || b.name,
    ownerName: owner.name || '—',
    phone: owner.phone || b.phone || '',
    email: owner.email || b.email || '',
    gstin: b.gstin ?? '',
    gstType: b.gstType,
    industry: b.industry || '—',
    city: b.city || '',
    state: b.state || '',
    planId: onTrial ? b.trialPlanId : b.planId,
    cycle: onTrial ? 'TRIAL' : b.planCycle === 'TRIAL' ? '1Y' : b.planCycle,
    status,
    signupDate: day(b.createdAt),
    trialEndsOn: onTrial ? b.trialEndsOn : undefined,
    planValidUntil: b.planCycle === 'LIFETIME' ? '2099-12-31' : onTrial ? b.trialEndsOn : b.planValidUntil || '',
    lastActive: day(b.lastActiveAt ?? b.updatedAt),
    platforms: [],
    language: 'English',
    aatoBand: AATO_LABEL[b.aatoBand] ?? '< ₹5 Cr',
    usage: {
      invoicesThisMonth: b.usage?.invoicesThisMonth ?? 0,
      users: b.usage?.users ?? 0,
      businesses: 1,
      eWayBillsThisYear: b.usage?.eWayBillsThisYear ?? 0,
      eInvoicesThisYear: b.usage?.eInvoicesThisYear ?? 0
    },
    lifetimeRevenue: b.lifetimeRevenue ?? 0,
    notes: b.adminNotes ?? ''
  };
}

export const toPlan = (p: Raw): PlanConfig => ({
  id: p._id,
  name: p.name,
  tagline: p.tagline ?? '',
  priceYearly: p.priceYearly ?? 0,
  price2Years: p.price2Years ?? 0,
  price3Years: p.price3Years ?? 0,
  priceLifetime: p.priceLifetime ?? 0,
  limits: {
    invoicesPerMonth: p.limits?.invoicesPerMonth ?? null,
    users: p.limits?.users ?? 1,
    businesses: p.limits?.businesses ?? 1,
    eWayBillsPerYear: p.limits?.eWayBillsPerYear ?? null,
    eInvoicesPerYear: p.limits?.eInvoicesPerYear ?? null
  },
  features: p.features ?? [],
  watermark: !!p.watermark,
  highlight: p.highlight || undefined,
  isActive: p.isActive !== false
});

export const fromPlan = (p: PlanConfig) => ({
  name: p.name,
  tagline: p.tagline,
  priceYearly: p.priceYearly,
  price2Years: p.price2Years,
  price3Years: p.price3Years,
  priceLifetime: p.priceLifetime,
  limits: p.limits,
  features: p.features,
  watermark: p.watermark,
  highlight: p.highlight,
  isActive: p.isActive
});

export const toSubscription = (s: Raw): SubscriptionRecord => ({
  id: id(s),
  invoiceNo: s.invoiceNo,
  merchantId: String(s.businessId),
  merchantName: s.businessName ?? '',
  merchantGstin: s.businessGstin ?? '',
  planId: s.planId,
  cycle: s.cycle,
  baseAmount: s.baseAmount ?? 0,
  discount: s.discount ?? 0,
  gstAmount: s.gstAmount ?? 0,
  totalAmount: s.totalAmount ?? 0,
  gateway: s.gateway,
  status: s.status,
  startDate: s.startDate,
  renewsOn: s.renewsOn,
  autoRenew: !!s.autoRenew,
  couponCode: s.couponCode || undefined,
  addOns: []
});

export const toCoupon = (c: Raw): Coupon => ({
  id: id(c),
  code: c.code,
  type: c.type,
  value: c.value,
  appliesTo: c.appliesTo ?? [],
  maxRedemptions: c.maxRedemptions,
  redeemed: c.redeemed ?? 0,
  validUntil: c.validUntil,
  active: !!c.active,
  description: c.description ?? ''
});

export const toTicket = (t: Raw): SupportTicket => ({
  id: id(t),
  ticketNo: t.ticketNo,
  merchantId: t.businessId ? String(t.businessId) : '',
  merchantName: t.businessName ?? '',
  phone: t.phone ?? '',
  subject: t.subject,
  category: t.category,
  priority: t.priority,
  status: t.status,
  channel: t.channel,
  assignee: t.assignee ?? 'Unassigned',
  createdAt: stamp(t.createdAt),
  updatedAt: stamp(t.updatedAt),
  messages: (t.messages ?? []).map((m: Raw) => ({ id: id(m), from: m.from, author: m.author ?? '', text: m.text, at: stamp(m.at) }))
});

export const toFlag = (f: Raw): FeatureFlag => ({
  key: String(f._id),
  name: f.name,
  description: f.description ?? '',
  phase: f.phase,
  enabled: !!f.enabled,
  rollout: f.rollout ?? 0,
  plans: f.plans ?? [],
  platforms: f.platforms ?? [],
  updatedAt: day(f.updatedAt)
});

export const fromFlag = (f: FeatureFlag) => ({ name: f.name, description: f.description, phase: f.phase, enabled: f.enabled, rollout: f.rollout, plans: f.plans, platforms: f.platforms });

export const toBroadcast = (b: Raw): Broadcast => ({
  id: id(b),
  title: b.title,
  message: b.message,
  channels: b.channels,
  segment: b.segment,
  language: b.language,
  status: b.status,
  scheduledAt: b.scheduledAt ? stamp(b.scheduledAt) : undefined,
  sentAt: b.sentAt ? stamp(b.sentAt) : b.status === 'QUEUED' ? stamp(b.createdAt) : undefined,
  recipients: b.recipients ?? 0,
  delivered: b.delivered ?? 0,
  opened: b.opened ?? 0,
  createdBy: ''
});

export const toCompliance = (c: Raw): ComplianceRules => ({
  irpReportingWindowDays: c.irpReportingWindowDays,
  irnCancelWindowHours: c.irnCancelWindowHours,
  eWayBillThreshold: c.eWayBillThreshold,
  eWayBillMaxDocAgeDays: c.eWayBillMaxDocAgeDays,
  eInvoiceAatoThresholdCr: c.eInvoiceAatoThresholdCr,
  b2cLargeThreshold: c.b2cLargeThreshold,
  hsnDigitsBelow5Cr: c.hsnDigitsUpto5Cr,
  hsnDigitsAbove5Cr: c.hsnDigitsAbove5Cr,
  invoiceNumberMaxLength: c.invoiceNumberMaxLength,
  warnDaysBeforeIrpDeadline: c.warnDaysBeforeIrpDeadline ?? 5
});

export const fromCompliance = (c: ComplianceRules) => ({
  irpReportingWindowDays: c.irpReportingWindowDays,
  irnCancelWindowHours: c.irnCancelWindowHours,
  eWayBillThreshold: c.eWayBillThreshold,
  eWayBillMaxDocAgeDays: c.eWayBillMaxDocAgeDays,
  eInvoiceAatoThresholdCr: c.eInvoiceAatoThresholdCr,
  b2cLargeThreshold: c.b2cLargeThreshold,
  hsnDigitsUpto5Cr: c.hsnDigitsBelow5Cr,
  hsnDigitsAbove5Cr: c.hsnDigitsAbove5Cr,
  invoiceNumberMaxLength: c.invoiceNumberMaxLength,
  warnDaysBeforeIrpDeadline: c.warnDaysBeforeIrpDeadline
});

export const toAddOn = (a: Raw): AddOn => ({ id: a.id, name: a.name, description: a.description, price: a.price, unit: a.unit, active: !!a.active, soldThisMonth: 0 });
