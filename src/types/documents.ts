import { InvoiceItem, PaymentMode } from './index';

// Spec §8.4 (sales documents) and §8.5 (purchase & expenses)
export type DocType =
  | 'PROFORMA'
  | 'SALES_ORDER'
  | 'DELIVERY_CHALLAN'
  | 'CREDIT_NOTE' // sales return
  | 'PURCHASE_ORDER'
  | 'PURCHASE_BILL'
  | 'DEBIT_NOTE'; // purchase return

export type DocStatus =
  | 'DRAFT'
  | 'OPEN' // sent / pending
  | 'CONVERTED'
  | 'DELIVERED'
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'ISSUED'
  | 'CANCELLED';

export interface TradeDocument {
  id: string;
  docType: DocType;
  number: string;
  businessId: string;
  partyId: string;
  partyName: string;
  partyGstin?: string;
  partyStateCode: string;
  date: string;
  dueDate?: string;
  isInterState: boolean;
  items: InvoiceItem[];
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalGst: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  status: DocStatus;
  reference?: string; // linked invoice / supplier bill no.
  reason?: string; // credit/debit note reason, challan purpose
  restock?: boolean; // credit note: put goods back in stock
  itcEligible?: boolean; // purchase bill: GST input claimable
  vehicleNumber?: string;
  convertedTo?: string; // number of the document it became
  notes?: string;
  createdAt: string;
}

export const EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Salaries & Wages',
  'Transport & Freight',
  'Packaging',
  'Office Supplies',
  'Internet & Phone',
  'Repairs & Maintenance',
  'Marketing',
  'Professional Fees (CA / Legal)',
  'Bank Charges',
  'Travel',
  'Miscellaneous'
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: string;
  businessId: string;
  number: string;
  date: string;
  category: ExpenseCategory;
  vendorName: string;
  vendorGstin?: string;
  description: string;
  amount: number; // taxable value
  gstRate: number;
  gstAmount: number;
  total: number;
  mode: PaymentMode;
  itcEligible: boolean;
  reference?: string;
}

export type InvoiceTemplate = 'A4_CLASSIC' | 'A4_MODERN' | 'A5' | 'THERMAL_3IN' | 'THERMAL_2IN';

export interface InvoiceSettings {
  prefix: string; // e.g. "INV/26-27/"
  nextNumber: number;
  padding: number;
  financialYearReset: boolean;
  template: InvoiceTemplate;
  showUpiQr: boolean;
  showBankDetails: boolean;
  showSignature: boolean;
  defaultDueDays: number;
  defaultNotes: string;
  roundOff: boolean;
  docPrefixes: Record<DocType, string>;
}
