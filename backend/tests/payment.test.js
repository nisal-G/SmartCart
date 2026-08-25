const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Cart = require('../src/models/Cart');
const Order = require('../src/models/Order');
const { connect, clearDatabase, closeDatabase } = require('./utils/db');
const { createUser, accessCookie } = require('./utils/auth');

const PAYHERE_ENV_KEYS = [
  'PAYHERE_MERCHANT_ID',
  'PAYHERE_MERCHANT_SECRET',
  'PAYHERE_SANDBOX',
  'PAYHERE_CURRENCY',
  'PAYHERE_RETURN_URL',
  'PAYHERE_CANCEL_URL',
  'PAYHERE_NOTIFY_URL',
];
const MERCHANT_ID = 'test-merchant-1211149';
const MERCHANT_SECRET = 'test-merchant-secret-do-not-use-in-prod';
const CURRENCY = 'LKR';

let originalEnv = {};

beforeAll(async () => {
  await connect();

  PAYHERE_ENV_KEYS.forEach((key) => {
    originalEnv[key] = process.env[key];
  });
  process.env.PAYHERE_MERCHANT_ID = MERCHANT_ID;
  process.env.PAYHERE_MERCHANT_SECRET = MERCHANT_SECRET;
  process.env.PAYHERE_SANDBOX = 'true';
  process.env.PAYHERE_CURRENCY = CURRENCY;
  process.env.PAYHERE_RETURN_URL = 'http://localhost:5173/payment/return';
  process.env.PAYHERE_CANCEL_URL = 'http://localhost:5173/payment/cancel';
  process.env.PAYHERE_NOTIFY_URL = 'http://localhost:5000/api/payments/payhere/notify';
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
  PAYHERE_ENV_KEYS.forEach((key) => {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  });
});

// --- fixtures ---------------------------------------------------------------

let categorySeq = 0;
async function createCategory() {
  categorySeq += 1;
  return Category.create({ name: `Category ${categorySeq}-${Date.now()}` });
}

async function createProduct(overrides = {}) {
  const category = overrides.category || (await createCategory());
  return Product.create({
    name: overrides.name || 'Test Product',
    description: 'A product used in tests',
    price: overrides.price ?? 100,
    category: category._id,
  });
}

/** Creates a pending order for `user` the same way POST /api/orders does, without going through HTTP. */
async function createOrderForUser(user, { price = 500 } = {}) {
  const product = await createProduct({ price });
  return Order.create({
    user: user._id,
    items: [{ product: product._id, name: product.name, price, quantity: 1 }],
    total: price,
  });
}

const validCustomer = {
  phone: '0771234567',
  address: '123 Galle Road',
  city: 'Colombo',
  country: 'Sri Lanka',
};

/** MD5 hex uppercased — a from-scratch reimplementation (not calling payhereService) so tests don't just validate the implementation against itself. */
function md5Upper(input) {
  return crypto.createHash('md5').update(input, 'utf8').digest('hex').toUpperCase();
}

/** Builds a correctly-signed PayHere notify_url payload for the given order + outcome. */
function buildNotification({
  orderId,
  amount,
  currency = CURRENCY,
  statusCode,
  paymentId = `PH${Date.now()}`,
  merchantId = MERCHANT_ID,
  merchantSecret = MERCHANT_SECRET,
  method = 'VISA',
  statusMessage = 'Success',
}) {
  const amountStr = Number(amount).toFixed(2);
  const hashedSecret = md5Upper(merchantSecret);
  const md5sig = md5Upper(`${merchantId}${orderId}${amountStr}${currency}${statusCode}${hashedSecret}`);

  return {
    merchant_id: merchantId,
    order_id: orderId,
    payment_id: paymentId,
    payhere_amount: amountStr,
    payhere_currency: currency,
    status_code: String(statusCode),
    md5sig,
    method,
    status_message: statusMessage,
  };
}

function notify(payload) {
  return request(app)
    .post('/api/payments/payhere/notify')
    .type('form')
    .send(payload);
}

// --- POST /api/payments/payhere/session -------------------------------------

describe('POST /api/payments/payhere/session', () => {
  test('an authenticated user can initialize a session for their own pending order', async () => {
    const { user, accessToken } = await createUser();
    const order = await createOrderForUser(user, { price: 1050 });

    const res = await request(app)
      .post('/api/payments/payhere/session')
      .set('Cookie', accessCookie(accessToken))
      .send({ orderId: String(order._id), customer: validCustomer });

    expect(res.status).toBe(200);
    const { payment } = res.body;
    expect(payment.merchant_id).toBe(MERCHANT_ID);
    expect(payment.order_id).toBe(String(order._id));
    expect(payment.amount).toBe('1050.00');
    expect(payment.currency).toBe(CURRENCY);
    expect(payment.sandbox).toBe(true);
    expect(payment.email).toBe(user.email);
    expect(payment.phone).toBe(validCustomer.phone);
    expect(payment.notify_url).toBe(process.env.PAYHERE_NOTIFY_URL);

    // The hash must match what a from-scratch reimplementation of PayHere's
    // documented formula produces for this exact order/amount/currency.
    const hashedSecret = md5Upper(MERCHANT_SECRET);
    const expectedHash = md5Upper(
      `${MERCHANT_ID}${String(order._id)}1050.00${CURRENCY}${hashedSecret}`
    );
    expect(payment.hash).toBe(expectedHash);
  });

  test('the amount comes from the order total, not anything the client sends', async () => {
    const { user, accessToken } = await createUser();
    const order = await createOrderForUser(user, { price: 250 });

    const res = await request(app)
      .post('/api/payments/payhere/session')
      .set('Cookie', accessCookie(accessToken))
      .send({ orderId: String(order._id), customer: validCustomer, amount: '1.00', total: 1 });

    expect(res.status).toBe(200);
    expect(res.body.payment.amount).toBe('250.00');
  });

  test('unauthenticated request is rejected', async () => {
    const { user } = await createUser();
    const order = await createOrderForUser(user);

    const res = await request(app)
      .post('/api/payments/payhere/session')
      .send({ orderId: String(order._id), customer: validCustomer });
    expect(res.status).toBe(401);
  });

  test('a nonexistent order is rejected', async () => {
    const { accessToken } = await createUser();
    const res = await request(app)
      .post('/api/payments/payhere/session')
      .set('Cookie', accessCookie(accessToken))
      .send({ orderId: '65a1f1e1e1e1e1e1e1e1e1e1', customer: validCustomer });
    expect(res.status).toBe(404);
  });

  test("a user cannot initialize a session for another user's order", async () => {
    const { user: owner } = await createUser();
    const { accessToken: otherToken } = await createUser();
    const order = await createOrderForUser(owner);

    const res = await request(app)
      .post('/api/payments/payhere/session')
      .set('Cookie', accessCookie(otherToken))
      .send({ orderId: String(order._id), customer: validCustomer });
    expect(res.status).toBe(404);
  });

  test('an invalid order id is rejected by validation', async () => {
    const { accessToken } = await createUser();
    const res = await request(app)
      .post('/api/payments/payhere/session')
      .set('Cookie', accessCookie(accessToken))
      .send({ orderId: 'not-a-valid-id', customer: validCustomer });
    expect(res.status).toBe(400);
  });

  test('missing customer billing details are rejected by validation', async () => {
    const { user, accessToken } = await createUser();
    const order = await createOrderForUser(user);

    const res = await request(app)
      .post('/api/payments/payhere/session')
      .set('Cookie', accessCookie(accessToken))
      .send({ orderId: String(order._id), customer: { phone: '0771234567' } });
    expect(res.status).toBe(400);
  });

  test('an order that has already been paid is rejected', async () => {
    const { user, accessToken } = await createUser();
    const order = await createOrderForUser(user);
    order.payment.status = 'paid';
    await order.save();

    const res = await request(app)
      .post('/api/payments/payhere/session')
      .set('Cookie', accessCookie(accessToken))
      .send({ orderId: String(order._id), customer: validCustomer });
    expect(res.status).toBe(409);
  });

  test('a cancelled order is rejected', async () => {
    const { user, accessToken } = await createUser();
    const order = await createOrderForUser(user);
    order.status = 'cancelled';
    await order.save();

    const res = await request(app)
      .post('/api/payments/payhere/session')
      .set('Cookie', accessCookie(accessToken))
      .send({ orderId: String(order._id), customer: validCustomer });
    expect(res.status).toBe(400);
  });

  test('responds 503 when PayHere is not configured', async () => {
    const savedSecret = process.env.PAYHERE_MERCHANT_SECRET;
    delete process.env.PAYHERE_MERCHANT_SECRET;
    try {
      const { user, accessToken } = await createUser();
      const order = await createOrderForUser(user);

      const res = await request(app)
        .post('/api/payments/payhere/session')
        .set('Cookie', accessCookie(accessToken))
        .send({ orderId: String(order._id), customer: validCustomer });
      expect(res.status).toBe(503);
    } finally {
      process.env.PAYHERE_MERCHANT_SECRET = savedSecret;
    }
  });

  test('the merchant secret is never present in the response', async () => {
    const { user, accessToken } = await createUser();
    const order = await createOrderForUser(user);

    const res = await request(app)
      .post('/api/payments/payhere/session')
      .set('Cookie', accessCookie(accessToken))
      .send({ orderId: String(order._id), customer: validCustomer });

    expect(JSON.stringify(res.body)).not.toContain(MERCHANT_SECRET);
  });
});

// --- POST /api/payments/payhere/notify --------------------------------------

describe('POST /api/payments/payhere/notify', () => {
  test('a valid successful notification marks the order as paid', async () => {
    const { user } = await createUser();
    const order = await createOrderForUser(user, { price: 450 });

    const res = await notify(
      buildNotification({ orderId: String(order._id), amount: 450, statusCode: 2 })
    );
    expect(res.status).toBe(200);

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('paid');
    expect(updated.payment.paidAt).toBeInstanceOf(Date);
    expect(updated.payment.method).toBe('VISA');
    // Fulfillment status is untouched by a payment notification.
    expect(updated.status).toBe('pending');
  });

  test('an invalid signature does not mark the order as paid', async () => {
    const { user } = await createUser();
    const order = await createOrderForUser(user, { price: 450 });
    const payload = buildNotification({ orderId: String(order._id), amount: 450, statusCode: 2 });
    payload.md5sig = '0'.repeat(32);

    const res = await notify(payload);
    expect(res.status).toBe(400);

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('pending');
  });

  test('an incorrect merchant_id is rejected and does not mark the order paid', async () => {
    const { user } = await createUser();
    const order = await createOrderForUser(user, { price: 450 });
    const payload = buildNotification({
      orderId: String(order._id),
      amount: 450,
      statusCode: 2,
      merchantId: 'someone-elses-merchant-id',
    });

    const res = await notify(payload);
    expect(res.status).toBe(400);

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('pending');
  });

  test('an incorrect (but validly signed) amount is rejected and does not mark the order paid', async () => {
    const { user } = await createUser();
    const order = await createOrderForUser(user, { price: 450 });
    // Signed correctly FOR 100, but the order total is 450 — simulates a
    // notification whose signature is genuinely valid for the data it
    // carries, which just doesn't match this order.
    const payload = buildNotification({ orderId: String(order._id), amount: 100, statusCode: 2 });

    const res = await notify(payload);
    expect(res.status).toBe(400);

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('pending');
  });

  test('an incorrect (but validly signed) currency is rejected and does not mark the order paid', async () => {
    const { user } = await createUser();
    const order = await createOrderForUser(user, { price: 450 });
    const payload = buildNotification({
      orderId: String(order._id),
      amount: 450,
      currency: 'USD',
      statusCode: 2,
    });

    const res = await notify(payload);
    expect(res.status).toBe(400);

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('pending');
  });

  test('a notification for an unknown order is rejected', async () => {
    const res = await notify(
      buildNotification({ orderId: '65a1f1e1e1e1e1e1e1e1e1e1', amount: 450, statusCode: 2 })
    );
    expect(res.status).toBe(404);
  });

  test('a malformed order id is rejected', async () => {
    const res = await notify(
      buildNotification({ orderId: 'not-an-object-id', amount: 450, statusCode: 2 })
    );
    expect(res.status).toBe(400);
  });

  test('a canceled payment (-1) sets payment status to cancelled, not paid', async () => {
    const { user } = await createUser();
    const order = await createOrderForUser(user, { price: 450 });

    const res = await notify(
      buildNotification({ orderId: String(order._id), amount: 450, statusCode: -1 })
    );
    expect(res.status).toBe(200);

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('cancelled');
  });

  test('a failed payment (-2) sets payment status to failed, not paid', async () => {
    const { user } = await createUser();
    const order = await createOrderForUser(user, { price: 450 });

    const res = await notify(
      buildNotification({ orderId: String(order._id), amount: 450, statusCode: -2 })
    );
    expect(res.status).toBe(200);

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('failed');
  });

  test('a pending payment (0) sets payment status to pending', async () => {
    const { user } = await createUser();
    const order = await createOrderForUser(user, { price: 450 });

    const res = await notify(
      buildNotification({ orderId: String(order._id), amount: 450, statusCode: 0 })
    );
    expect(res.status).toBe(200);

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('pending');
  });

  test('a charged-back payment (-3) after a paid order transitions payment status to charged_back', async () => {
    const { user } = await createUser();
    const order = await createOrderForUser(user, { price: 450 });
    const paymentId = 'PH-CHARGEBACK-1';

    const paidRes = await notify(
      buildNotification({ orderId: String(order._id), amount: 450, statusCode: 2, paymentId })
    );
    expect(paidRes.status).toBe(200);

    const chargebackRes = await notify(
      buildNotification({ orderId: String(order._id), amount: 450, statusCode: -3, paymentId })
    );
    expect(chargebackRes.status).toBe(200);

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('charged_back');
  });

  test('an unrecognized status code is rejected', async () => {
    const { user } = await createUser();
    const order = await createOrderForUser(user, { price: 450 });

    const res = await notify(
      buildNotification({ orderId: String(order._id), amount: 450, statusCode: 99 })
    );
    expect(res.status).toBe(400);

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('pending');
  });

  describe('idempotency', () => {
    test('processing the same successful notification twice does not create a duplicate order or change state', async () => {
      const { user } = await createUser();
      const order = await createOrderForUser(user, { price: 450 });
      const payload = buildNotification({ orderId: String(order._id), amount: 450, statusCode: 2 });

      const first = await notify(payload);
      expect(first.status).toBe(200);
      const afterFirst = await Order.findById(order._id);
      const firstPaidAt = afterFirst.payment.paidAt;

      const second = await notify(payload);
      expect(second.status).toBe(200);

      const afterSecond = await Order.findById(order._id);
      expect(afterSecond.payment.status).toBe('paid');
      expect(afterSecond.payment.paidAt.getTime()).toBe(firstPaidAt.getTime());
      expect(await Order.countDocuments({ user: user._id })).toBe(1);
    });

    test('a second, different payment attempt against an already-paid order is ignored', async () => {
      const { user } = await createUser();
      const order = await createOrderForUser(user, { price: 450 });

      const first = await notify(
        buildNotification({
          orderId: String(order._id),
          amount: 450,
          statusCode: 2,
          paymentId: 'PH-FIRST',
        })
      );
      expect(first.status).toBe(200);

      const second = await notify(
        buildNotification({
          orderId: String(order._id),
          amount: 450,
          statusCode: 2,
          paymentId: 'PH-SECOND',
        })
      );
      expect(second.status).toBe(200); // acknowledged so PayHere doesn't retry forever...

      const updated = await Order.findById(order._id);
      // ...but the original payment record is NOT overwritten by the second attempt.
      expect(updated.payment.paymentId).toBe('PH-FIRST');
    });

    test('a late/out-of-order lower-priority notification after paid does not regress the order', async () => {
      const { user } = await createUser();
      const order = await createOrderForUser(user, { price: 450 });
      const paymentId = 'PH-RACE-1';

      const paidRes = await notify(
        buildNotification({ orderId: String(order._id), amount: 450, statusCode: 2, paymentId })
      );
      expect(paidRes.status).toBe(200);

      // A 'pending' notification for the same payment_id arriving after 'paid'
      // (e.g. redelivered out of order) must not un-pay the order.
      const staleRes = await notify(
        buildNotification({ orderId: String(order._id), amount: 450, statusCode: 0, paymentId })
      );
      expect(staleRes.status).toBe(200);

      const updated = await Order.findById(order._id);
      expect(updated.payment.status).toBe('paid');
    });
  });

  describe('security', () => {
    test('does not require authentication (PayHere calls this server-to-server)', async () => {
      const { user } = await createUser();
      const order = await createOrderForUser(user, { price: 450 });

      // Deliberately no .set('Cookie', ...) — a correctly-signed notification
      // must be accepted with no session at all.
      const res = await notify(
        buildNotification({ orderId: String(order._id), amount: 450, statusCode: 2 })
      );
      expect(res.status).toBe(200);
    });

    test('the merchant secret is never present in the notify response', async () => {
      const { user } = await createUser();
      const order = await createOrderForUser(user, { price: 450 });

      const res = await notify(
        buildNotification({ orderId: String(order._id), amount: 450, statusCode: 2 })
      );
      expect(JSON.stringify(res.body)).not.toContain(MERCHANT_SECRET);
    });
  });
});

// --- Frontend cannot fake payment success ------------------------------------

describe('Frontend cannot fake payment success', () => {
  test('POST /api/orders ignores a client-supplied payment status and defaults to pending', async () => {
    const { user, accessToken } = await createUser();
    const product = await createProduct({ price: 300 });
    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 1 }],
      total: 0,
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', accessCookie(accessToken))
      .send({ payment: { status: 'paid' }, paymentStatus: 'paid' });

    expect(res.status).toBe(201);
    expect(res.body.order.payment.status).toBe('pending');
  });
});
