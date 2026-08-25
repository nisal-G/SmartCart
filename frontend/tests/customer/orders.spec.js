import { test as base, expect } from '@playwright/test';
import { customerTest, customer2Test } from '../fixtures.js';
import * as db from '../e2e-env/db.cjs';

const test = base;

test.describe('Order history — protected route', () => {
  test('logged-out visitor is redirected to /login', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login$/);
  });
});

customer2Test.describe('Order history — empty state', () => {
  // Uses the second, deliberately-untouched TEST QA Customer (see
  // fixtures.js/constants.cjs) so this doesn't depend on no other test in
  // the suite having placed an order for the primary one.
  customer2Test('shows the empty state when the customer has no orders', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByText("You haven't placed any orders yet.")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue shopping' })).toBeVisible();
  });
});

customerTest.describe('Order history — with orders', () => {
  customerTest('order status and payment status render as separate badges (never confused)', async ({ page }) => {
    const product = await db.createProductDirect({ price: 111 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 111, quantity: 1 }],
      status: 'confirmed',
      paymentStatus: 'paid',
    });

    await page.goto('/orders');
    const card = page.locator('li', { has: page.locator(`[title="${order._id}"]`) });
    await expect(card.getByText('Confirmed', { exact: true })).toBeVisible(); // order.status
    await expect(card.getByText('Paid', { exact: true })).toBeVisible(); // payment.status — a distinct badge
  });

  customerTest('View Details navigates to the correct order', async ({ page }) => {
    const product = await db.createProductDirect({ price: 222 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 222, quantity: 1 }],
    });

    await page.goto('/orders');
    const card = page.locator('li', { has: page.locator(`[title="${order._id}"]`) });
    await card.getByRole('link', { name: 'View details' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${order._id}$`));
  });

  customerTest('pagination pages through more than one page of orders', async ({ page }) => {
    const product = await db.createProductDirect({ price: 10 });
    // Enough orders to guarantee at least 2 pages regardless of how many
    // other tests in this suite already placed one for this customer
    // (default page size is 10 — see orderController.getMyOrders).
    await Promise.all(
      Array.from({ length: 12 }, () =>
        db.createOrderDirect({ items: [{ product: product._id, name: product.name, price: 10, quantity: 1 }] })
      )
    );

    await page.goto('/orders');
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
    const next = page.getByRole('button', { name: 'Next' });
    await expect(next).toBeEnabled();

    await next.click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
  });
});
