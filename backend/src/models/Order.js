const mongoose = require('mongoose');

const { Schema } = mongoose;

// Kept intentionally small (SRS §3.4 only covers "show order summary before
// payment" — no payment gateway yet, see checkout controller). Extend this
// list only when a real workflow needs the extra state.
const ORDER_STATUSES = ['pending', 'confirmed', 'cancelled'];

/**
 * A single product line within an Order — a permanent historical record of
 * what was purchased.
 *
 * Unlike Cart's line items (see Cart.js), this DOES snapshot `name` and
 * `price` at checkout time. An Order must keep showing what the shopper
 * actually paid even if the Product is later repriced, renamed, or deleted
 * entirely — see orderController.checkout for where the snapshot is taken.
 */
const orderItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price must not be negative'],
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
 * A confirmed purchase created from a user's cart at checkout (SRS §3.4).
 * `total` is computed server-side from the item price snapshots below —
 * see orderController, which never trusts a client-supplied total.
 */
const orderSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total must not be negative'],
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'pending',
      required: true,
    },
  },
  { timestamps: true }
);

// Supports "get my orders" (newest first) and the admin "get all orders" list.
orderSchema.index({ user: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
Order.STATUSES = ORDER_STATUSES;

module.exports = Order;
