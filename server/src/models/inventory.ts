import mongoose, { Schema } from 'mongoose';

const { ObjectId } = Schema.Types;
const opts = { timestamps: true, versionKey: false } as const;

/** Godowns / warehouses / branches (spec §8.3 P1). Every business gets a default "Main godown". */
const godownSchema = new Schema(
  {
    businessId: { type: ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true }
  },
  opts
);
godownSchema.index({ businessId: 1, name: 1 }, { unique: true });
export const Godown = mongoose.model('Godown', godownSchema);

/** Stock of one product in one godown. Product.stock stays the business-wide total. */
const productStockSchema = new Schema(
  {
    businessId: { type: ObjectId, required: true },
    productId: { type: ObjectId, ref: 'Product', required: true },
    godownId: { type: ObjectId, ref: 'Godown', required: true },
    quantity: { type: Number, default: 0 }
  },
  { versionKey: false }
);
productStockSchema.index({ productId: 1, godownId: 1 }, { unique: true });
productStockSchema.index({ businessId: 1, godownId: 1 });
export const ProductStock = mongoose.model('ProductStock', productStockSchema);

/** Batch / lot with expiry for batch-tracked items (pharma, FMCG, food). */
const batchSchema = new Schema(
  {
    businessId: { type: ObjectId, required: true, index: true },
    productId: { type: ObjectId, ref: 'Product', required: true },
    batchNo: { type: String, required: true, uppercase: true, trim: true },
    mfgDate: { type: String, default: '' },
    expiryDate: { type: String, default: '' }, // YYYY-MM-DD
    mrp: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 }
  },
  opts
);
batchSchema.index({ productId: 1, batchNo: 1 }, { unique: true });
batchSchema.index({ businessId: 1, expiryDate: 1 });
export const Batch = mongoose.model('Batch', batchSchema);

/** Party-wise price lists (wholesale, dealer, retail…). */
const priceListSchema = new Schema(
  {
    businessId: { type: ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    items: [{ _id: false, productId: { type: ObjectId, ref: 'Product', required: true }, price: { type: Number, required: true, min: 0 } }],
    active: { type: Boolean, default: true }
  },
  opts
);
priceListSchema.index({ businessId: 1, name: 1 }, { unique: true });
export const PriceList = mongoose.model('PriceList', priceListSchema);
