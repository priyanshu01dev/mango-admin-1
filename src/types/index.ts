export type Language = 'en' | 'hi';

export type UserRole = 'SUPER_ADMIN' | 'BILLING_MANAGER' | 'ACCOUNTANT' | 'SUPPORT_AGENT';

export type InvoiceStatus = 'PAID' | 'UNPAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED';

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'CONVERTED' | 'EXPIRED';

export type PaymentMode = 'CASH' | 'UPI' | 'NEFT_RTGS' | 'CHEQUE' | 'CARD';

export type PartyType = 'CUSTOMER' | 'SUPPLIER';

export interface BusinessProfile {
  id: string;
  name: string;
  tradeName: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  stateCode: string; // e.g. "07" for Delhi, "27" for Maharashtra
  pincode: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBranch: string;
  upiId: string;
  signatureText?: string;
  terms: string;
  /** Mango plan: FREE | SILVER | GOLD | PLATINUM */
  activePlan: string;
  planName?: string;
  /** active | trial | none */
  planStatus?: string;
  planValidUntil: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'KYC_PENDING';
  ownerName?: string;
  ownerPhone?: string;
  category?: string;
  lastSyncAt?: string | null;
  syncRevision?: number;
}

/** Plan as stored on the server (backend/src/domain/plans.ts). */
export interface MangoPlan {
  id: string;
  name: string;
  priceYearly: number;
  tagline: string;
  tag: string | null;
  highlight: boolean;
  features: string[];
  limits: Record<string, number | boolean>;
  active: boolean;
  businesses: number;
}

/** Per-screen access level. A missing screen key means no access. */
export type AccessLevel = 'view' | 'edit';
/** Admin panel screen keys — must match ADMIN_SCREENS in backend/src/lib/permissions.ts. */
export type AdminScreen =
  | 'dashboard' | 'invoices' | 'quotations' | 'eway' | 'inventory' | 'parties' | 'payments' | 'gst'
  | 'subscriptions' | 'attendance' | 'api' | 'audit' | 'businesses' | 'support' | 'app_config' | 'staff';
export type PermissionMap = Partial<Record<AdminScreen, AccessLevel>>;
/** Signed-in admin. Super admins implicitly have every screen at 'edit'. */
export interface AdminUser { id: string; name: string; email: string; isSuperAdmin: boolean; permissions: PermissionMap }

export interface InvoiceItem {
  id: string;
  productId?: string;
  name: string;
  hsnCode: string;
  quantity: number;
  unit: string; // PCS, KGS, BOX, MTR, NOS, PKT
  price: number; // Unit selling price before tax
  discountPercent: number; // e.g. 5%
  gstRate: number; // 0, 5, 12, 18, 28
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  businessId: string;
  customerId: string;
  customerName: string;
  customerGstin?: string;
  customerPhone: string;
  customerAddress: string;
  customerStateCode: string; // e.g. "07"
  invoiceDate: string;
  dueDate: string;
  isInterState: boolean; // true = IGST, false = CGST + SGST
  items: InvoiceItem[];
  subTotal: number;
  totalDiscount: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalGst: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  notes?: string;
  eInvoiceStatus?: 'NOT_GENERATED' | 'GENERATED' | 'FAILED';
  irnNumber?: string;
  eWayBillStatus?: 'NOT_GENERATED' | 'GENERATED' | 'EXPIRED';
  eWayBillNumber?: string;
  createdAt: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  businessId: string;
  customerId: string;
  customerName: string;
  customerGstin?: string;
  customerPhone: string;
  customerAddress: string;
  customerStateCode: string;
  date: string;
  validUntil: string;
  isInterState: boolean;
  items: InvoiceItem[];
  grandTotal: number;
  status: QuotationStatus;
  convertedInvoiceId?: string;
  notes?: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  hsnCode: string;
  category: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
  currentStock: number;
  minStockAlert: number;
  status: 'ACTIVE' | 'INACTIVE';
  isService?: boolean;
}

export interface Party {
  id: string;
  businessId: string;
  type: PartyType;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  gstin?: string;
  pan?: string;
  billingAddress: string;
  state: string;
  stateCode: string;
  openingBalance: number;
  currentBalance: number; // positive = receivable, negative = payable
  creditLimit?: number;
  status: 'ACTIVE' | 'BLOCKED';
}

export interface PaymentTransaction {
  id: string;
  businessId: string;
  type: 'PAYMENT_IN' | 'PAYMENT_OUT';
  partyId: string;
  partyName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  paymentDate: string;
  mode: PaymentMode;
  referenceNumber: string; // UTR / Cheque / UPI Ref
  notes?: string;
}

export interface EWayBillRecord {
  id: string;
  ewbNumber: string;
  invoiceNumber: string;
  invoiceId: string;
  fromGstin: string;
  toGstin: string;
  transporterName: string;
  transporterId: string;
  vehicleNumber: string;
  approxDistanceKm: number;
  supplyType: 'Outward' | 'Inward';
  documentType: 'Tax Invoice' | 'Bill of Supply' | 'Delivery Challan';
  generatedDate: string;
  validUpto: string;
  status: 'ACTIVE' | 'CANCELLED';
}

export interface EInvoiceRecord {
  id: string;
  irn: string;
  ackNo: string;
  ackDate: string;
  invoiceNumber: string;
  invoiceId: string;
  buyerGstin: string;
  totalValue: number;
  status: 'ACTIVE' | 'CANCELLED';
  signedQrCodePayload: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  invoiceLimit: number | 'Unlimited';
  eWayBillLimit: number | 'Unlimited';
  multiUserLimit: number;
  features: string[];
  activeUsersCount: number;
  badge?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  role: string;
  ipAddress: string;
  action: string;
  details: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
}

export interface ApiEndpointSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  category: 'Auth' | 'Invoices' | 'Inventory' | 'GST & E-Way' | 'Parties' | 'Payments';
  requestBodySample?: object;
  responseSample: object;
  headers: Record<string, string>;
}
