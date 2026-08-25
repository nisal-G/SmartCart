const path = require('path');
const fs = require('fs');
const { SEED_INFO_PATH } = require('./constants.cjs');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..', 'backend');
const backendPath = (...segments) => path.join(BACKEND_ROOT, ...segments);

/**
 * Direct-DB fixture helpers for spec files — a second connection (this runs
 * in Playwright's worker process, a separate OS process from the one
 * global-setup.cjs ran in) to the SAME throwaway replica set global setup
 * created, read back from tests/e2e-env/.runtime/seed-info.json.
 *
 * This mirrors exactly how backend/tests/*.test.js build their own fixtures
 * (Order.create(...), User.create(...) directly against the model) — it's
 * not "faking" anything a user does; it's test-data setup for state a
 * legitimate PayHere notification or a real checkout would otherwise have
 * produced (see e.g. setOrderPaymentStatus, used because we cannot run a
 * real PayHere payment in this environment — see final report).
 */

let connectPromise = null;
let seedInfo = null;

function getSeedInfo() {
  if (!seedInfo) {
    seedInfo = JSON.parse(fs.readFileSync(SEED_INFO_PATH, 'utf8'));
  }
  return seedInfo;
}

function ensureConnected() {
  if (!connectPromise) {
    const mongoose = require(backendPath('node_modules', 'mongoose'));
    connectPromise = mongoose.connect(getSeedInfo().mongodbUri).then(() => mongoose);
  }
  return connectPromise;
}

async function models() {
  await ensureConnected();
  return {
    User: require(backendPath('src', 'models', 'User.js')),
    Category: require(backendPath('src', 'models', 'Category.js')),
    Product: require(backendPath('src', 'models', 'Product.js')),
    Order: require(backendPath('src', 'models', 'Order.js')),
  };
}

let uniqueCounter = 0;
// A space before the counter (not a hyphen glued to the timestamp) keeps
// generated names realistic — a single long unbroken numeric run (e.g.
// "...1787654794413-2") has no CSS word-break opportunity and can force a
// flex/grid ancestor's automatic min-size wider than its content's
// `truncate` class accounts for, overflowing narrow viewports in a way a
// normal, space-separated product name never would (see
// responsive/responsive.spec.js's Order details case, which briefly hit
// exactly this with the old format — a test-data artifact, not a fix to
// application code, since no real admin types an unbroken 13-digit name).
function unique(label) {
  uniqueCounter += 1;
  // base36 (not the full 13-digit decimal ms timestamp) keeps this short —
  // a shorter unbroken run is less likely to be the widest thing in any
  // given layout, on top of the space-separation above.
  return `${label} ${Date.now().toString(36)} ${uniqueCounter}`;
}

/** Creates a "TEST QA Category" directly, bypassing the UI — for fixtures a test doesn't itself exercise. */
async function createCategoryDirect(overrides = {}) {
  const { Category } = await models();
  return Category.create({
    name: unique('TEST QA Category'),
    description: 'Seeded directly by the Playwright E2E harness.',
    ...overrides,
  });
}

/** Creates a "TEST QA Product" directly, in a given (or freshly-created) category. */
async function createProductDirect(overrides = {}) {
  const { Product } = await models();
  const { category, ...rest } = overrides;
  const categoryId = category || (await createCategoryDirect())._id;
  return Product.create({
    name: unique('TEST QA Product'),
    description: 'Seeded directly by the Playwright E2E harness.',
    price: 100,
    isActive: true,
    ...rest,
    category: categoryId,
  });
}

/**
 * Creates an Order exactly the shape orderController.checkout would have
 * produced (price-snapshotted items, server-style total), for the TEST QA
 * Customer by default. Used where a test's focus is reading order state
 * (order details historical pricing, payment-status pages, admin order
 * list) rather than the checkout flow itself — that flow has its own
 * dedicated real-UI test in customer/checkout.spec.js.
 */
async function createOrderDirect({ userId, items, status = 'pending', paymentStatus } = {}) {
  if (!items || items.length === 0) {
    throw new Error('createOrderDirect requires at least one item — pass `items`.');
  }
  const { Order } = await models();
  const info = getSeedInfo();
  const ownerId = userId || info.customer.id;
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order = await Order.create({
    user: ownerId,
    items,
    total,
    status,
  });

  if (paymentStatus) {
    order.payment.status = paymentStatus;
    if (paymentStatus === 'paid') order.payment.paidAt = new Date();
    if (paymentStatus !== 'pending') {
      order.payment.paymentId = `TESTQA-${order._id}`;
      order.payment.method = 'VISA';
      order.payment.currency = 'LKR';
      order.payment.amount = total;
    }
    await order.save();
  }

  return order;
}

/** Sets an order's payment.status directly — stands in for a PayHere notification we cannot send for real in this environment (see final report, PayHere section). */
async function setOrderPaymentStatus(orderId, paymentStatus, extra = {}) {
  const { Order } = await models();
  const order = await Order.findById(orderId);
  if (!order) throw new Error(`setOrderPaymentStatus: no order ${orderId}`);
  order.payment.status = paymentStatus;
  Object.assign(order.payment, extra);
  if (paymentStatus === 'paid' && !order.payment.paidAt) order.payment.paidAt = new Date();
  await order.save();
  return order;
}

/** Changes a product's current price directly — used to prove an existing order's price snapshot doesn't follow it (see OrderDetails "historical price" test). */
async function updateProductPrice(productId, price) {
  const { Product } = await models();
  await Product.updateOne({ _id: productId }, { $set: { price } });
}

async function findCategoryByName(name) {
  const { Category } = await models();
  return Category.findOne({ name });
}

async function deleteByName(modelName, name) {
  const all = await models();
  const Model = all[modelName];
  await Model.deleteMany({ name });
}

async function disconnect() {
  if (connectPromise) {
    const mongoose = require(backendPath('node_modules', 'mongoose'));
    await mongoose.disconnect();
    connectPromise = null;
  }
}

module.exports = {
  getSeedInfo,
  createCategoryDirect,
  createProductDirect,
  createOrderDirect,
  setOrderPaymentStatus,
  updateProductPrice,
  findCategoryByName,
  deleteByName,
  disconnect,
};
