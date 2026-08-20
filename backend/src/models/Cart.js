const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * A single product line within a user's cart (SRS §3.3).
 *
 * Deliberately holds ONLY a product reference + quantity — no price/name
 * snapshot. The cart is a pre-checkout, frequently-changing working set
 * (unlike a future Order, which SHOULD snapshot price/name at purchase
 * time), so it always reflects the product's *current* price. Storing a
 * duplicate price here would either drift from the real price (stale) or
 * require write-through updates on every product price change — both worse
 * than just reading Product.price on demand. See cartController's
 * `buildCartResponse` for where totals are actually computed.
 */
const cartItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be a whole number',
      },
    },
  },
  { _id: false }
);

/**
 * A user's single active shopping cart (SRS §3.3). One cart per user is
 * enforced by the unique index below; `total` is a denormalized cache kept
 * in sync by cartController on every read/write (recomputed from live
 * Product prices, never trusted from the client).
 */
const cartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [cartItemSchema],
    total: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Enforces "one cart per user" at the DB level and makes the lazy
// get-or-create upsert in cartController race-safe.
cartSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model('Cart', cartSchema);
