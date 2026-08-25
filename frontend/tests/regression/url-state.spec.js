import { adminTest, customerTest, expect } from '../fixtures.js';
import * as db from '../e2e-env/db.cjs';

/**
 * URL-driven state must reproduce correctly when the URL is loaded fresh
 * (not just reached by clicking through the UI) — the real test of "is
 * this actually state, or just a side effect of a click handler".
 */
customerTest.describe('URL state — customer', () => {
  customerTest('/products?category=<id> filters on a cold load', async ({ page }) => {
    const vegId = db.getSeedInfo().catalog.categories.vegetables.id;
    await page.goto(`/products?category=${vegId}`);
    await expect(page.getByRole('tab', { name: 'TEST QA Vegetables', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByText('TEST QA Tomato')).toBeVisible();
    await expect(page.getByText('TEST QA Apple')).not.toBeVisible();
  });

  customerTest('/products?page=<n> loads the given page on a cold load', async ({ page }) => {
    await page.goto('/products?page=2');
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
  });

  customerTest('/orders?page=<n> loads the given page on a cold load', async ({ page }) => {
    const product = await db.createProductDirect({ price: 8 });
    await Promise.all(
      Array.from({ length: 11 }, () =>
        db.createOrderDirect({ items: [{ product: product._id, name: product.name, price: 8, quantity: 1 }] })
      )
    );
    await page.goto('/orders?page=2');
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
  });
});

adminTest.describe('URL state — admin', () => {
  adminTest('/admin/products?page=<n> loads the given page on a cold load', async ({ page }) => {
    await page.goto('/admin/products?page=2');
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
  });

  adminTest('/admin/orders?status=<status> filters on a cold load', async ({ page }) => {
    const product = await db.createProductDirect({ price: 9 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 9, quantity: 1 }],
      status: 'cancelled',
    });
    await page.goto('/admin/orders?status=cancelled');
    await expect(page.getByLabel('Order status')).toHaveValue('cancelled');
    await expect(page.locator('tr', { has: page.locator(`[title="${order._id}"]`) })).toBeVisible();
  });

  adminTest('/admin/orders?page=<n> loads the given page on a cold load', async ({ page }) => {
    const product = await db.createProductDirect({ price: 7 });
    await Promise.all(
      Array.from({ length: 11 }, () =>
        db.createOrderDirect({ items: [{ product: product._id, name: product.name, price: 7, quantity: 1 }] })
      )
    );
    await page.goto('/admin/orders?page=2');
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
  });
});
