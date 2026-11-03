import mongoose, { Schema, InferSchemaType, Types } from 'mongoose';

const { ObjectId } = Schema.Types;
const opts = { timestamps: true, versionKey: false } as const;
const money = { type: Number, default: 0 };

// ---------------- Masters ----------------

const partySchema = new Schema(
  {
    businessId: { type: ObjectId, ref: 'Business', required: true, index: true },
    type: { type: String, enum: ['CUSTOMER', 'SUPPLIER'], required: true },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    gstin: { type: String, default: '', uppercase: true },
    pan: { type: String, default: '', uppercase: true },
    billingAddress: { type: String, default: '' },
    shippingAddress: { type: String, default: '' },
    state: { type: String, default: '' },
    stateCode: { type: String, required: true, match: /^\d{2}$/ },
    openingBalance: money,
    balance: money, // + receivable (they owe us), − payable (we owe them)
    creditLimit: { type: Number, default: 0 },
    creditDays: { type: Number, default: 0 },
    status: { type: String, enum: ['ACTIVE', 'BLOCKED'], default: 'ACTIVE' }
  },
  opts
);
partySchema.index({ businessId: 1, name: 1 });
export const Party = mongoose.model('Party', partySchema);
export type PartyDoc = InferSchemaType<typeof partySchema> & { _id: Types.ObjectId };

const productSchema = new Schema(
  {
    businessId: { type: ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, default: '' },
    hsnCode: { type: String, required: true, match: /^\d{4,8}$/ },
    category: { type: String, default: '' },
    unit: { type: String, default: 'PCS' }, // UQC
    purchasePrice: money,
    sellingPrice: money,
    mrp: money,
    priceIncludesTax: { type: Boolean, default: false },
    taxRate: { type: Number, enum: [0, 0.25, 3, 5, 12, 18, 28], default: 18 },
    cessRate: { type: Number, default: 0 },
    isService: { type: Boolean, default: false },
    stock: { type: Number, default: 0 },
    minStock: { type: Number, default: 0 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
  },
  opts
);
productSchema.index({ businessId: 1, sku: 1 }, { unique: true, partialFilterExpression: { sku: { $gt: '' } } });
export const Product = mongoose.model('Product', productSchema);
export type ProductDoc = InferSchemaType<typeof productSchema> & { _id: Types.ObjectId };

/** Item ledger: every stock change with its source document. */
const stockMoveSchema = new Schema(
  {
    businessId: { type: ObjectId, required: true, index: true },
    productId: { type: ObjectId, ref: 'Product', required: true, index: true },
    quantity: { type: Number, required: true }, // + in, − out
    reason: { type: String, required: true },
    refType: String,
    refId: ObjectId,
    refNumber: String,
    date: { type: String, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);
export const StockMovement = mongoose.model('StockMovement', stockMoveSchema);

// ---------------- Documents ----------------

const lineSchema = new Schema(
  {
    id: String,
    productId: { type: ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    hsnCode: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, default: 'PCS' },
    price: { type: Number, required: true },
    discountPercent: { type: Number, default: 0 },
    priceIncludesTax: { type: Boolean, default: false },
    gstRate: { type: Number, required: true },
    taxableAmount: Number,
    cgstAmount: Number,
    sgstAmount: Number,
    igstAmount: Number,
    totalAmount: Number
  },
  { _id: false }
);

const partySnapshot = {
  partyId: { type: ObjectId, ref: 'Party' },
  partyName: { type: String, required: true },
  partyGstin: { type: String, default: '' },
  partyPhone: { type: String, default: '' },
  partyAddress: { type: String, default: '' },
  partyStateCode: { type: String, required: true }
};

const totals = {
  subTotal: money,
  totalDiscount: money,
  taxableTotal: money,
  cgstTotal: money,
  sgstTotal: money,
  igstTotal: money,
  totalGst: money,
  roundOff: money,
  grandTotal: money
};

const invoiceSchema = new Schema(
  {
    businessId: { type: ObjectId, ref: 'Business', required: true },
    number: { type: String, required: true },
    kind: { type: String, enum: ['TAX_INVOICE', 'BILL_OF_SUPPLY'], default: 'TAX_INVOICE' },
    supplyType: { type: String, enum: ['REGULAR', 'EXPORT_WPAY', 'EXPORT_WOPAY', 'SEZ_WPAY', 'SEZ_WOPAY', 'DEEMED_EXPORT'], default: 'REGULAR' },
    exportDetails: {
      currency: { type: String, default: '' },
      exchangeRate: { type: Number, default: 0 },
      foreignValue: { type: Number, default: 0 },
      portCode: { type: String, default: '' },
      shippingBillNo: { type: String, default: '' },
      shippingBillDate: { type: String, default: '' },
      lutNumber: { type: String, default: '' }
    },
    publicToken: { type: String, index: { unique: true, sparse: true } },
    date: { type: String, required: true },
    dueDate: String,
    ...partySnapshot,
    placeOfSupply: { type: String, required: true },
    isInterState: { type: Boolean, required: true },
    reverseCharge: { type: Boolean, default: false },
    items: { type: [lineSchema], validate: [(v: unknown[]) => v.length > 0, 'At least one item'] },
    ...totals,
    billDiscount: money,
    charges: [
      {
        _id: false,
        label: String,
        amount: Number,
        gstRate: Number,
        taxableAmount: Number,
        cgstAmount: Number,
        sgstAmount: Number,
        igstAmount: Number,
        totalAmount: Number
      }
    ],
    chargesTotal: money,
    tcsRate: { type: Number, default: 0 },
    tcsAmount: money,
    shippingAddress: { type: String, default: '' },
    poNumber: { type: String, default: '' },
    poDate: { type: String, default: '' },
    transport: {
      mode: { type: String, enum: ['ROAD', 'RAIL', 'AIR', 'SHIP', ''], default: '' },
      vehicleNumber: { type: String, default: '' },
      transporterName: { type: String, default: '' },
      lrNumber: { type: String, default: '' },
      lrDate: { type: String, default: '' }
    },
    amountPaid: money,
    tdsDeducted: money, // TDS deducted by the buyer (counts towards settling the invoice)
    creditedAmount: money, // reduced by credit notes
    balanceDue: money,
    status: { type: String, enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'], default: 'UNPAID', index: true },
    cancelReason: String,
    cancelledAt: Date,
    notes: { type: String, default: '' },
    sourceDoc: { type: String, default: '' },
    eInvoice: {
      status: { type: String, enum: ['NOT_GENERATED', 'GENERATED', 'CANCELLED', 'FAILED'], default: 'NOT_GENERATED' },
      irn: String,
      ackNo: String,
      ackDate: String,
      signedQr: String,
      mock: { type: Boolean, default: false },
      error: String
    },
    eWayBill: {
      status: { type: String, enum: ['NOT_GENERATED', 'GENERATED', 'CANCELLED', 'FAILED'], default: 'NOT_GENERATED' },
      number: String,
      validUpto: String,
      vehicleNumber: String,
      transporterId: String,
      distanceKm: Number,
      mock: { type: Boolean, default: false }
    },
    createdBy: { type: ObjectId, ref: 'User' }
  },
  opts
);
invoiceSchema.index({ businessId: 1, number: 1 }, { unique: true });
invoiceSchema.index({ businessId: 1, date: -1 });
export const Invoice = mongoose.model('Invoice', invoiceSchema);
export type InvoiceDoc = InferSchemaType<typeof invoiceSchema> & { _id: Types.ObjectId };

export const DOC_TYPES = ['QUOTATION', 'PROFORMA', 'SALES_ORDER', 'DELIVERY_CHALLAN', 'CREDIT_NOTE', 'PURCHASE_ORDER', 'PURCHASE_BILL', 'DEBIT_NOTE'] as const;
export type DocType = (typeof DOC_TYPES)[number];

const documentSchema = new Schema(
  {
    businessId: { type: ObjectId, ref: 'Business', required: true },
    docType: { type: String, enum: DOC_TYPES, required: true },
    number: { type: String, required: true },
    date: { type: String, required: true },
    dueDate: String,
    ...partySnapshot,
    isInterState: { type: Boolean, required: true },
    items: { type: [lineSchema], validate: [(v: unknown[]) => v.length > 0, 'At least one item'] },
    ...totals,
    amountPaid: money,
    adjustedAmount: money, // purchase bill reduced by debit notes
    status: { type: String, enum: ['DRAFT', 'OPEN', 'CONVERTED', 'DELIVERED', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'ISSUED', 'CANCELLED'], default: 'OPEN' },
    reference: { type: String, default: '' }, // supplier bill no. / original invoice no.
    reason: { type: String, default: '' },
    restock: { type: Boolean, default: true },
    itcEligible: { type: Boolean, default: true },
    vehicleNumber: { type: String, default: '' },
    convertedTo: { type: String, default: '' },
    notes: { type: String, default: '' },
    cancelReason: String,
    createdBy: { type: ObjectId, ref: 'User' }
  },
  opts
);
documentSchema.index({ businessId: 1, docType: 1, number: 1 }, { unique: true });
documentSchema.index({ businessId: 1, docType: 1, date: -1 });
export const TradeDocument = mongoose.model('TradeDocument', documentSchema);
export type TradeDocumentDoc = InferSchemaType<typeof documentSchema> & { _id: Types.ObjectId };

const paymentSchema = new Schema(
  {
    businessId: { type: ObjectId, ref: 'Business', required: true, index: true },
    type: { type: String, enum: ['PAYMENT_IN', 'PAYMENT_OUT'], required: true },
    partyId: { type: ObjectId, ref: 'Party' }, // empty for walk-in cash sales
    partyName: String,
    refType: { type: String, enum: ['INVOICE', 'PURCHASE_BILL', 'ADVANCE'], default: 'ADVANCE' },
    refId: ObjectId,
    refNumber: String,
    amount: { type: Number, required: true, min: 0.01 },
    tdsAmount: { type: Number, default: 0 }, // TDS deducted by the customer on this receipt
    date: { type: String, required: true },
    mode: { type: String, enum: ['CASH', 'UPI', 'NEFT_RTGS', 'CHEQUE', 'CARD'], required: true },
    reference: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: { type: ObjectId, ref: 'User' }
  },
  opts
);
export const Payment = mongoose.model('Payment', paymentSchema);

const expenseSchema = new Schema(
  {
    businessId: { type: ObjectId, ref: 'Business', required: true, index: true },
    number: { type: String, required: true },
    date: { type: String, required: true },
    category: { type: String, required: true },
    vendorName: { type: String, required: true },
    vendorGstin: { type: String, default: '' },
    description: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, default: 0 },
    gstAmount: money,
    total: money,
    mode: { type: String, enum: ['CASH', 'UPI', 'NEFT_RTGS', 'CHEQUE', 'CARD'], default: 'UPI' },
    itcEligible: { type: Boolean, default: false },
    reference: { type: String, default: '' },
    createdBy: { type: ObjectId, ref: 'User' }
  },
  opts
);
expenseSchema.index({ businessId: 1, number: 1 }, { unique: true });
export const Expense = mongoose.model('Expense', expenseSchema);
