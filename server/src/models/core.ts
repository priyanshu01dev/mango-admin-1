import mongoose, { Schema, InferSchemaType, Types } from 'mongoose';

const { ObjectId } = Schema.Types;
const opts = { timestamps: true, versionKey: false } as const;

// ---------------- Users & auth ----------------

export const PLATFORM_ROLES = ['SUPER_ADMIN', 'SUPPORT'] as const;
export const BUSINESS_ROLES = ['OWNER', 'ADMIN', 'SALESMAN', 'ACCOUNTANT'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, default: '' },
    phone: { type: String, unique: true, sparse: true }, // E.164 e.g. +919811023456
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    platformRole: { type: String, enum: [...PLATFORM_ROLES, null], default: null },
    status: { type: String, enum: ['ACTIVE', 'BLOCKED'], default: 'ACTIVE' },
    language: { type: String, enum: ['en', 'hi'], default: 'en' },
    lastLoginAt: Date
  },
  opts
);
export const User = mongoose.model('User', userSchema);
export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

const otpSchema = new Schema(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, expires: 0 } // TTL index: Mongo deletes after expiry
  },
  opts
);
export const OtpCode = mongoose.model('OtpCode', otpSchema);

const refreshSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    userAgent: String,
    expiresAt: { type: Date, required: true, expires: 0 },
    revokedAt: Date
  },
  opts
);
export const RefreshToken = mongoose.model('RefreshToken', refreshSchema);

// ---------------- Business (tenant) ----------------

const invoiceSettingsSchema = new Schema(
  {
    prefix: { type: String, default: 'INV/{FY}/' }, // {FY} → 26-27
    padding: { type: Number, default: 4, min: 1, max: 8 },
    financialYearReset: { type: Boolean, default: true },
    template: { type: String, enum: ['A4_CLASSIC', 'A4_MODERN', 'A5', 'THERMAL_3IN', 'THERMAL_2IN'], default: 'A4_CLASSIC' },
    showUpiQr: { type: Boolean, default: true },
    showBankDetails: { type: Boolean, default: true },
    showSignature: { type: Boolean, default: true },
    roundOff: { type: Boolean, default: true },
    defaultDueDays: { type: Number, default: 15 },
    defaultNotes: { type: String, default: '' },
    terms: { type: String, default: '' },
    allowNegativeStock: { type: Boolean, default: false },
    docPrefixes: {
      PROFORMA: { type: String, default: 'PF/{FY}/' },
      SALES_ORDER: { type: String, default: 'SO/{FY}/' },
      DELIVERY_CHALLAN: { type: String, default: 'DC/{FY}/' },
      CREDIT_NOTE: { type: String, default: 'CN/{FY}/' },
      PURCHASE_ORDER: { type: String, default: 'PO/{FY}/' },
      PURCHASE_BILL: { type: String, default: 'PB/{FY}/' },
      DEBIT_NOTE: { type: String, default: 'DN/{FY}/' },
      QUOTATION: { type: String, default: 'QT/{FY}/' },
      EXPENSE: { type: String, default: 'EXP/{FY}/' }
    }
  },
  { _id: false }
);

const businessSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    tradeName: { type: String, default: '' },
    gstin: { type: String, default: '', uppercase: true, trim: true },
    pan: { type: String, default: '', uppercase: true, trim: true },
    gstType: { type: String, enum: ['REGULAR', 'COMPOSITION', 'UNREGISTERED'], default: 'REGULAR' },
    aatoBand: { type: String, enum: ['UPTO_5CR', '5_TO_10CR', 'ABOVE_10CR'], default: 'UPTO_5CR' },
    industry: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    stateCode: { type: String, required: true, match: /^\d{2}$/ },
    pincode: { type: String, default: '' },
    bank: {
      name: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifsc: { type: String, default: '' },
      branch: { type: String, default: '' }
    },
    upiId: { type: String, default: '' },
    signatureText: { type: String, default: '' },
    invoiceSettings: { type: invoiceSettingsSchema, default: () => ({}) },
    // subscription state (platform)
    planId: { type: String, enum: ['free', 'silver', 'gold', 'platinum'], default: 'free' },
    planCycle: { type: String, enum: ['TRIAL', '1Y', '2Y', '3Y', 'LIFETIME'], default: 'TRIAL' },
    planValidUntil: { type: String, default: '' }, // YYYY-MM-DD
    trialPlanId: { type: String, enum: ['silver', 'gold', 'platinum', null], default: null },
    trialEndsOn: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CHURNED'], default: 'ACTIVE' },
    suspendReason: String,
    adminNotes: { type: String, default: '' },
    ownerId: { type: ObjectId, ref: 'User', required: true, index: true },
    firstInvoiceAt: Date,
    lastActiveAt: Date
  },
  opts
);
businessSchema.index({ gstin: 1 }, { unique: true, partialFilterExpression: { gstin: { $gt: '' } } });
export const Business = mongoose.model('Business', businessSchema);
export type BusinessDoc = InferSchemaType<typeof businessSchema> & { _id: Types.ObjectId };

const membershipSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    businessId: { type: ObjectId, ref: 'Business', required: true, index: true },
    role: { type: String, enum: BUSINESS_ROLES, required: true },
    status: { type: String, enum: ['ACTIVE', 'REMOVED'], default: 'ACTIVE' }
  },
  opts
);
membershipSchema.index({ userId: 1, businessId: 1 }, { unique: true });
export const Membership = mongoose.model('Membership', membershipSchema);

/** Atomic counters for gap-free document numbering (never reused, even after cancellation). */
const counterSchema = new Schema({ businessId: { type: ObjectId, required: true }, key: { type: String, required: true }, seq: { type: Number, default: 0 } }, { versionKey: false });
counterSchema.index({ businessId: 1, key: 1 }, { unique: true });
export const Counter = mongoose.model('Counter', counterSchema);

const auditSchema = new Schema(
  {
    businessId: { type: ObjectId, ref: 'Business', index: true },
    userId: { type: ObjectId, ref: 'User' },
    userName: String,
    action: { type: String, required: true },
    details: { type: String, default: '' },
    status: { type: String, enum: ['SUCCESS', 'WARNING', 'FAILED'], default: 'SUCCESS' },
    ip: String
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);
auditSchema.index({ createdAt: -1 });
export const AuditLog = mongoose.model('AuditLog', auditSchema);
