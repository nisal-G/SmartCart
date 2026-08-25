import { adminTest, expect } from '../fixtures.js';
import * as db from '../e2e-env/db.cjs';

adminTest.describe('Admin orders — list, pagination, status filter', () => {
  adminTest('list loads and shows the customer, total, order status, and payment status', async ({ page }) => {
    const product = await db.createProductDirect({ price: 321 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 321, quantity: 2 }],
      status: 'confirmed',
      paymentStatus: 'paid',
    });

    await page.goto('/admin/orders');
    const row = page.locator('tr', { has: page.locator(`[title="${order._id}"]`) });
    await expect(row).toBeVisible();
    await expect(row.getByText('TEST QA Customer')).toBeVisible();
    await expect(row.getByText('LKR 642.00', { exact: true })).toBeVisible(); // 321 x 2
    await expect(row.getByText('Confirmed', { exact: true })).toBeVisible();
    await expect(row.getByText('Paid', { exact: true })).toBeVisible();
  });

  adminTest('pagination pages through more than 10 orders', async ({ page }) => {
    const product = await db.createProductDirect({ price: 5 });
    await Promise.all(
      Array.from({ length: 11 }, () =>
        db.createOrderDirect({ items: [{ product: product._id, name: product.name, price: 5, quantity: 1 }] })
      )
    );

    await page.goto('/admin/orders');
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
    const next = page.getByRole('button', { name: 'Next' });
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
  });

  adminTest('status filter narrows the list and updates the URL', async ({ page }) => {
    const product = await db.createProductDirect({ price: 77 });
    const cancelled = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 77, quantity: 1 }],
      status: 'cancelled',
    });

    await page.goto('/admin/orders');
    await page.getByLabel('Order status').selectOption({ label: 'Cancelled' });
    await expect(page).toHaveURL(/status=cancelled/);

    const row = page.locator('tr', { has: page.locator(`[title="${cancelled._id}"]`) });
    await expect(row).toBeVisible();
    await expect(row.getByText('Cancelled', { exact: true })).toBeVisible();

    // Switching back to "All statuses" clears the param.
    await page.getByLabel('Order status').selectOption({ label: 'All statuses' });
    await expect(page).not.toHaveURL(/status=/);
  });

  adminTest('View details navigates to the correct order', async ({ page }) => {
    const product = await db.createProductDirect({ price: 88 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 88, quantity: 1 }],
    });

    await page.goto('/admin/orders');
    const row = page.locator('tr', { has: page.locator(`[title="${order._id}"]`) });
    await row.getByRole('link', { name: 'View details' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/orders/${order._id}$`));
  });
});
