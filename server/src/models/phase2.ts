import mongoose, { Schema } from 'mongoose';

const { ObjectId } = Schema.Types;
const opts = { timestamps: true, versionKey: false } as const;

/** Recurring invoice profile (spec §8.4 P1): generates a tax invoice on a schedule. */
const recurringSchema = new Schema(
  {
    businessId: { type: ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true },
    partyId: { type: ObjectId, ref: 'Party', required: true },
    partyName: String,
    items: [
      {
        _id: false,
        productId: { type: ObjectId, ref: 'Product' },
        name: String,
        hsnCode: String,
        unit: String,
        quantity: Number,
        price: Number,
        discountPercent: Number,
        gstRate: Number,
        priceIncludesTax: Boolean
      }
    ],
    frequency: { type: String, enum: ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'], required: true },
    nextRunOn: { type: String, required: true, index: true }, // YYYY-MM-DD (IST)
    endsOn: { type: String, default: '' },
    dueDays: { type: Number, default: 15 },
    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
    runs: { type: Number, default: 0 },
    lastInvoiceNumber: { type: String, default: '' },
    lastRunAt: Date,
    lastError: { type: String, default: '' },
    createdBy: { type: ObjectId, ref: 'User', required: true }
  },
  opts
);
export const RecurringInvoice = mongoose.model('RecurringInvoice', recurringSchema);
