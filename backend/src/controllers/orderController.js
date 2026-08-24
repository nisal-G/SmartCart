const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');

/** Loads the request error the global handler renders with the given status. */
function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

/**
 * Money helper: converts a price to integer cents so quantities/sums never
 * accumulate binary-floating-point drift (e.g. 0.1 + 0.2 !== 0.3). Mirrors
 * cartController's `toCents` — see Cart.js for why totals are never done in
 * plain decimal.
 */
function toCents(amount) {
  return Math.round(amount * 100);
}

/**
 * Builds the price-snapshotted order items for checkout and the
 * server-computed total, from the *current* live Product documents — never
 * from anything the client sent.
 *
 * Throws (not silently drops) if a cart line item's product no longer
 * exists or is unavailable: unlike browsing a cart (which prunes dead
 * items on read, see cartController.buildCartResponse), checkout is about
 * to create a permanent record, so the shopper must be told plainly rather
 * than have items silently disappear from what they're about to pay for.
 */
function buildOrderItems(cartItems, products) {
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  let totalCents = 0;
  const items = cartItems.map((cartItem) => {
    const product = productMap.get(String(cartItem.product));
    if (!product) {
      throw requestError(
        404,
        'One or more products in your cart no longer exist. Please update your cart and try again.'
      );
    }
    // The Product model has no availability flag today; this check is
    // forward-compatible with one (e.g. `isActive`) being added later,
    // same as cartController.requireAvailableProduct.
    if (product.isActive === false) {
      throw requestError(400, `"${product.name}" is currently unavailable`);
    }

    totalCents += toCents(product.price) * cartItem.quantity;

    return {
      product: product._id,
      name: product.name,
      price: product.price,
      quantity: cartItem.quantity,
    };
  });

  return { items, total: totalCents / 100 };
}

/** Strips internal fields not useful to API clients from an order document. */
function toOrderDTO(order) {
  const obj = order.toObject ? order.toObject() : order;
  delete obj.__v;
  return obj;
}

// --- Handlers ------------------------------------------------------------

/**
 * POST /api/orders — converts the authenticated user's cart into an Order.
 *
 * Runs inside a MongoDB transaction (the project's MONGODB_URI is an Atlas
 * `mongodb+srv://` connection, i.e. always backed by a replica set, so
 * transactions are available) so the order is created and the cart is
 * cleared atomically: if anything fails, neither happens, and the cart is
 * never cleared without a corresponding order existing.
 */
const checkout = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    throw requestError(400, 'Your cart is empty');
  }
  if (!cart.items || cart.items.length === 0) {
    throw requestError(400, 'Your cart is empty');
  }

  const productIds = cart.items.map((item) => item.product);
  const products = await Product.find({ _id: { $in: productIds } });

  // Computed entirely from live Product prices — the client's cart/total is
  // never trusted (SRS §3.4 / project security requirements).
  const { items, total } = buildOrderItems(cart.items, products);

  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const created = await Order.create(
        [{ user: req.user._id, items, total, status: 'pending' }],
        { session }
      );
      [order] = created;

      // Only clear the cart once the order write above has succeeded
      // inside the same transaction — if the transaction aborts for any
      // reason, this update is rolled back along with the order.
      await Cart.updateOne(
        { _id: cart._id },
        { $set: { items: [], total: 0 } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  res.status(201).json({ order: toOrderDTO(order) });
});

/** GET /api/orders — the authenticated user's own orders, newest first. */
const getMyOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  const filter = { user: req.user._id };
  if (req.query.status) filter.status = req.query.status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    orders: orders.map(toOrderDTO),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

/**
 * GET /api/orders/:id — a single order, scoped to the authenticated user so
 * one shopper can never read another's order (admins use GET /orders/all
 * instead — see getAllOrders).
 */
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  res.status(200).json({ order: toOrderDTO(order) });
});

/** GET /api/orders/all — admin-only: every user's orders, newest first. */
const getAllOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    orders: orders.map(toOrderDTO),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

/**
 * GET /api/orders/all/:id — admin-only: any single order, e.g. for a
 * support/detail view. Distinct from GET /api/orders/:id so a normal
 * user's route never accidentally exposes another user's order.
 */
const getOrderByIdAdmin = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  res.status(200).json({ order: toOrderDTO(order) });
});

/** PATCH /api/orders/:id/status — admin-only: transition an order's status. */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  order.status = req.body.status;
  await order.save();

  res.status(200).json({ order: toOrderDTO(order) });
});

module.exports = {
  checkout,
  getMyOrders,
  getOrderById,
  getAllOrders,
  getOrderByIdAdmin,
  updateOrderStatus,
};
