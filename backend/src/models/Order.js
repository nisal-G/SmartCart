const mongoose = require('mongoose');

const { Schema } = mongoose;

// Fulfillment status only — deliberately does NOT include anything payment
// related (no 'paid', no 'failed'). Whether an order was ever paid is
// `payment.status` below; overloading this field with payment states would
// make it ambiguous whether e.g. 'cancelled' means "shopper/admin cancelled
// the order" or "the payment was cancelled at the gateway" — two different
// facts that can each change independently. An admin still moves this
// field by hand via PATCH /api/orders/:id/status (see orderController);
// nothing in the PayHere integration writes to it.
const ORDER_STATUSES = ['pending', 'confirmed', 'cancelled'];

// The PayHere payment lifecycle (see services/payhereService.js), kept
// separate from ORDER_STATUSES above. 'pending' is the default for every
// order — including ones for which a PayHere payment was never even
// started — so "has this order been paid?" always has one obvious field to
// check regardless of how far checkout actually got.
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'cancelled', 'charged_back'];

/**
 * The PayHere (or, in principle, any future gateway) payment state for one
 * Order. Only ever written by paymentController from a verified PayHere
 * notification (see handlePayhereNotify) — never trusted from a client
 * request. Holds nothing sensitive: no card data, no merchant secret, just
 * the gateway's own reference id and the outcome it reported, so this is
 * safe to return as-is in order DTOs.
 */
const paymentSchema = new Schema(
  {
    provider: { type: String, enum: ['payhere'], default: 'payhere' },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'pending',
      required: true,
    },
    paymentId: { type: String }, // PayHere's payment_id, once a notification names one
    method: { type: String }, // e.g. 'VISA', 'MASTER' — PayHere's `method` field
    currency: { type: String },
    amount: { type: Number }, // amount PayHere actually confirmed (audit trail; order.total stays authoritative)
    statusMessage: { type: String }, // PayHere's human-readable status_message, for support/debugging
    paidAt: { type: Date },
  },
  { _id: false }
);

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
    // Every order gets a `payment` sub-document from creation (default
    // `{ status: 'pending' }` via paymentSchema's own defaults) even though
    // payment isn't initialized until POST /api/payments/payhere/session is
    // called — see orderController.checkout, which creates the order before
    // any payment attempt exists.
    payment: {
      type: paymentSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

// Supports "get my orders" (newest first) and the admin "get all orders" list.
orderSchema.index({ user: 1, createdAt: -1 });
// Sparse (most orders have no PayHere payment id yet) — supports looking an
// order up by PayHere's payment_id for support/debugging.
orderSchema.index({ 'payment.paymentId': 1 }, { sparse: true });

const Order = mongoose.model('Order', orderSchema);
Order.STATUSES = ORDER_STATUSES;
Order.PAYMENT_STATUSES = PAYMENT_STATUSES;

module.exports = Order;
