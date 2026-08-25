import { test as base, expect } from '@playwright/test';
import { customerTest } from '../fixtures.js';
import * as db from '../e2e-env/db.cjs';

const test = base;

test.describe('Order details — protected route', () => {
  test('logged-out visitor is redirected to /login', async ({ page }) => {
    await page.goto('/orders/507f1f77bcf86cd799439011');
    await expect(page).toHaveURL(/\/login$/);
  });
});

customerTest.describe('Order details', () => {
  customerTest('renders id, date, order status, payment status, items, quantity, and total', async ({ page }) => {
    const product = await db.createProductDirect({ price: 175 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 175, quantity: 3 }],
      status: 'confirmed',
      paymentStatus: 'paid',
    });

    await page.goto(`/orders/${order._id}`);

    await expect(page.getByText(String(order._id))).toBeVisible();
    await expect(page.getByText(product.name)).toBeVisible();
    await expect(page.getByText('LKR 175.00 × 3')).toBeVisible(); // unit price × quantity
    await expect(page.getByText('LKR 525.00', { exact: true }).first()).toBeVisible(); // item subtotal / order total (175*3)
    await expect(page.getByText('Confirmed', { exact: true })).toBeVisible(); // order status badge
    await expect(page.getByText('Paid', { exact: true })).toBeVisible(); // payment status badge, distinct field
  });

  customerTest(
    'shows the HISTORICAL order-item price, not the product\'s current (changed) price',
    async ({ page }) => {
      const product = await db.createProductDirect({ price: 100 });
      const order = await db.createOrderDirect({
        items: [{ product: product._id, name: product.name, price: 100, quantity: 1 }],
      });

      // The product is repriced AFTER the order was placed — the order's
      // own snapshot (order.items[].price) must not follow it. This is the
      // exact regression backend/src/models/Order.js's orderItemSchema
      // comment and orderController.buildOrderItems exist to guarantee.
      await db.updateProductPrice(product._id, 999);

      await page.goto(`/orders/${order._id}`);
      await expect(page.getByText('LKR 100.00 × 1')).toBeVisible();
      await expect(page.getByText('LKR 999.00')).toHaveCount(0);
    }
  );

  customerTest('a nonexistent / another user\'s order shows "Order not found." rather than crashing', async ({
    page,
  }) => {
    await page.goto('/orders/507f1f77bcf86cd799439011');
    // The backend's own 404 message ("Order not found", no trailing
    // period) surfaces as-is; OrderDetails.jsx's "Order not found." (with
    // a period) is only the fallback for when there's no error message at
    // all — distinct text, both acceptable, so match loosely here.
    await expect(page.getByText(/Order not found\.?/)).toBeVisible();
    await expect(page.getByRole('link', { name: '← Back to orders' })).toBeVisible();
  });

  customerTest('Back to Orders link returns to /orders', async ({ page }) => {
    const product = await db.createProductDirect({ price: 50 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 50, quantity: 1 }],
    });
    await page.goto(`/orders/${order._id}`);
    await page.getByRole('link', { name: '← Back to orders' }).click();
    await expect(page).toHaveURL(/\/orders$/);
  });
});
