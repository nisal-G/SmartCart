import { test as base, expect } from '@playwright/test';
import { customerTest } from '../fixtures.js';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';
import * as db from '../e2e-env/db.cjs';

const test = base;

/**
 * API-level PayHere tests: exercise POST /api/payments/payhere/session
 * directly (the same endpoint Checkout.jsx calls) against the ephemeral
 * backend's fake-but-consistent merchant config (see global-setup.cjs) —
 * no real PayHere network call happens here (createPayhereSession is a
 * pure local hash computation). Real PayHere sandbox payment itself is
 * unavailable in this environment (backend/.env's real
 * PAYHERE_MERCHANT_SECRET is blank) — see the final report's PayHere
 * section for how these categories (real / API-level / frontend
 * simulation / unavailable) are kept distinct.
 */
customerTest.describe('PayHere session API (authenticated)', () => {
  customerTest('rejects a session request for another customer\'s / nonexistent order', async ({ context }) => {
    const res = await context.request.post(`${BACKEND_API_URL}/payments/payhere/session`, {
      data: {
        orderId: '507f1f77bcf86cd799439011', // well-formed but nonexistent
        customer: { phone: '0771234567', address: 'x', city: 'x', country: 'x' },
      },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    // Sanitized message only — never a stack trace / Mongo error.
    expect(body.message).not.toMatch(/mongo|stack|at\s+\w+\.js:\d+/i);
  });

  customerTest('rejects a session request for an already-paid order (409)', async ({ context }) => {
    const order = await db.createOrderDirect({
      items: [{ product: (await db.createProductDirect())._id, name: 'TEST QA Paid Item', price: 500, quantity: 1 }],
      paymentStatus: 'paid',
    });
    const res = await context.request.post(`${BACKEND_API_URL}/payments/payhere/session`, {
      data: {
        orderId: String(order._id),
        customer: { phone: '0771234567', address: 'x', city: 'x', country: 'x' },
      },
    });
    expect(res.status()).toBe(409);
  });

  customerTest('rejects a session request for a cancelled order (400)', async ({ context }) => {
    const order = await db.createOrderDirect({
      items: [{ product: (await db.createProductDirect())._id, name: 'TEST QA Cancelled Item', price: 300, quantity: 1 }],
      status: 'cancelled',
    });
    const res = await context.request.post(`${BACKEND_API_URL}/payments/payhere/session`, {
      data: {
        orderId: String(order._id),
        customer: { phone: '0771234567', address: 'x', city: 'x', country: 'x' },
      },
    });
    expect(res.status()).toBe(400);
  });

  customerTest('a valid session response never includes the Merchant Secret and includes a real hash', async ({
    context,
  }) => {
    const product = await db.createProductDirect({ price: 150 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 150, quantity: 1 }],
    });
    const res = await context.request.post(`${BACKEND_API_URL}/payments/payhere/session`, {
      data: {
        orderId: String(order._id),
        customer: { phone: '0771234567', address: '123 Test Lane', city: 'Colombo', country: 'Sri Lanka' },
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.payment.hash).toMatch(/^[A-F0-9]{32}$/);
    expect(body.payment.amount).toBe('150.00');
    expect(body.payment.order_id).toBe(String(order._id));
    expect(JSON.stringify(body)).not.toContain('test-merchant-secret-not-real');
    expect(JSON.stringify(body)).not.toContain('merchant_secret');
  });
});

test.describe('PayHere session API — unauthenticated', () => {
  test('requires authentication', async ({ request }) => {
    const res = await request.post(`${BACKEND_API_URL}/payments/payhere/session`, {
      data: { orderId: '507f1f77bcf86cd799439011', customer: {} },
    });
    expect(res.status()).toBe(401);
  });
});
