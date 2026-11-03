import mongoose, { Schema, InferSchemaType, Types } from 'mongoose';

const { ObjectId } = Schema.Types;
const opts = { timestamps: true, versionKey: false } as const;
const PLAN_IDS = ['free', 'silver', 'gold', 'platinum'];

const planSchema = new Schema(
  {
    _id: { type: String, enum: PLAN_IDS },
    name: { type: String, required: true },
    tagline: { type: String, default: '' },
    priceYearly: { type: Number, default: 0 },
    price2Years: { type: Number, default: 0 },
    price3Years: { type: Number, default: 0 },
    priceLifetime: { type: Number, default: 0 },
    limits: {
      invoicesPerMonth: { type: Number, default: null }, // null = unlimited
      users: { type: Number, default: 1 },
      businesses: { type: Number, default: 1 },
      eWayBillsPerYear: { type: Number, default: 0 }, // 0 = not in plan
      eInvoicesPerYear: { type: Number, default: 0 }
    },
    features: { type: [String], default: [] },
    watermark: { type: Boolean, default: false },
    highlight: String,
    isActive: { type: Boolean, default: true }
  },
  opts
);
export const Plan = mongoose.model('Plan', planSchema);
export type PlanDoc = InferSchemaType<typeof planSchema> & { _id: string };

const subscriptionSchema = new Schema(
  {
    invoiceNo: { type: String, required: true, unique: true }, // platform GST invoice to the merchant
    businessId: { type: ObjectId, ref: 'Business', required: true, index: true },
    businessName: String,
    businessGstin: String,
    sellerName: String, // the platform company issuing the invoice
    sellerGstin: String,
    sellerStateCode: String,
    planId: { type: String, enum: PLAN_IDS, required: true },
    cycle: { type: String, enum: ['1Y', '2Y', '3Y', 'LIFETIME'], required: true },
    baseAmount: Number,
    discount: { type: Number, default: 0 },
    gstAmount: Number,
    totalAmount: Number,
    couponCode: String,
    gateway: { type: String, enum: ['RAZORPAY', 'PLAY_BILLING', 'MANUAL'], default: 'MANUAL' },
    gatewayRef: { type: String, index: { unique: true, sparse: true } }, // one subscription per gateway payment
    status: { type: String, enum: ['ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'], default: 'ACTIVE' },
    startDate: String,
    renewsOn: String,
    autoRenew: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: 'User' }
  },
  opts
);
export const Subscription = mongoose.model('Subscription', subscriptionSchema);

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, match: /^[A-Z0-9]{4,16}$/ },
    type: { type: String, enum: ['PERCENT', 'FLAT'], required: true },
    value: { type: Number, required: true, min: 1 },
    appliesTo: { type: [String], enum: PLAN_IDS, default: [] },
    maxRedemptions: { type: Number, default: 100 },
    redeemed: { type: Number, default: 0 },
    validUntil: { type: String, required: true },
    active: { type: Boolean, default: true },
    description: { type: String, default: '' }
  },
  opts
);
export const Coupon = mongoose.model('Coupon', couponSchema);

const ticketSchema = new Schema(
  {
    ticketNo: { type: String, required: true, unique: true },
    businessId: { type: ObjectId, ref: 'Business', index: true },
    businessName: String,
    phone: String,
    subject: { type: String, required: true },
    category: { type: String, enum: ['E_INVOICE', 'EWAY_BILL', 'GSTR_FILING', 'SUBSCRIPTION', 'APP_BUG', 'PRINTING', 'ACCOUNT'], required: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'WAITING_ON_MERCHANT', 'RESOLVED', 'CLOSED'], default: 'OPEN', index: true },
    channel: { type: String, enum: ['WHATSAPP', 'IN_APP', 'EMAIL', 'CALL'], default: 'IN_APP' },
    assignee: { type: String, default: 'Unassigned' },
    messages: [
      {
        from: { type: String, enum: ['MERCHANT', 'AGENT', 'SYSTEM'] },
        author: String,
        text: String,
        at: { type: Date, default: Date.now }
      }
    ]
  },
  opts
);
export const Ticket = mongoose.model('Ticket', ticketSchema);

const flagSchema = new Schema(
  {
    _id: { type: String }, // flag key
    name: { type: String, required: true },
    description: { type: String, default: '' },
    phase: { type: String, enum: ['P0', 'P1', 'P2'], default: 'P1' },
    enabled: { type: Boolean, default: false },
    rollout: { type: Number, min: 0, max: 100, default: 0 },
    plans: { type: [String], enum: PLAN_IDS, default: [] },
    platforms: { type: [String], enum: ['Android', 'iOS', 'Web'], default: [] }
  },
  opts
);
export const FeatureFlag = mongoose.model('FeatureFlag', flagSchema);

const broadcastSchema = new Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    channels: { type: [String], enum: ['PUSH', 'WHATSAPP', 'SMS', 'EMAIL'], required: true },
    segment: { type: String, enum: ['ALL', 'FREE', 'PAID', 'TRIAL_EXPIRING', 'PAST_DUE', 'INACTIVE_14D', 'EINVOICE_ELIGIBLE'], required: true },
    language: { type: String, enum: ['English', 'Hindi'], default: 'English' },
    status: { type: String, enum: ['DRAFT', 'SCHEDULED', 'QUEUED', 'SENT'], default: 'DRAFT' },
    scheduledAt: Date,
    sentAt: Date,
    recipients: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    createdBy: { type: ObjectId, ref: 'User' }
  },
  opts
);
export const Broadcast = mongoose.model('Broadcast', broadcastSchema);

/** Singleton documents for platform-wide settings (compliance thresholds etc). */
const settingSchema = new Schema({ _id: String, value: Schema.Types.Mixed }, { ...opts, minimize: false });
export const Setting = mongoose.model('Setting', settingSchema);

export const DEFAULT_COMPLIANCE = {
  irpReportingWindowDays: 30,
  irnCancelWindowHours: 24,
  eWayBillThreshold: 50000,
  eWayBillMaxDocAgeDays: 180, // reported change — verify against latest GSTN advisory
  eInvoiceAatoThresholdCr: 5,
  b2cLargeThreshold: 50000, // Rule 46: unregistered buyer address
  b2clInvoiceThreshold: 100000, // GSTR-1 B2CL (inter-state B2C) — verify current notification
  hsnDigitsUpto5Cr: 4,
  hsnDigitsAbove5Cr: 6,
  invoiceNumberMaxLength: 16,
  warnDaysBeforeIrpDeadline: 5
};
export type ComplianceRules = typeof DEFAULT_COMPLIANCE;

export const objectId = (id: string) => new Types.ObjectId(id);
