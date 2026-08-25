import { adminTest, customerTest, expect } from '../fixtures.js';
import * as db from '../e2e-env/db.cjs';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';

/**
 * Refreshing must always re-initialize correctly from the URL + backend —
 * never depend on in-memory-only React state (e.g. a value only set by a
 * previous click, with nothing to reconstruct it from a cold load).
 */
customerTest.describe('Page refresh — customer', () => {
  customerTest('/products', async ({ page }) => {
    await page.goto('/products');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  });

  customerTest('/products/:id', async ({ page }) => {
    const vegId = db.getSeedInfo().catalog.categories.vegetables.id;
    await page.goto(`/products?category=${vegId}`);
    await page.getByRole('link', { name: /TEST QA Tomato/ }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'TEST QA Tomato' })).toBeVisible();
  });

  customerTest('/cart', async ({ page, context }) => {
    await context.request.delete(`${BACKEND_API_URL}/cart`);
    const products = await context.request.get(`${BACKEND_API_URL}/products?search=TEST QA Tomato`).then((r) => r.json());
    await context.request.post(`${BACKEND_API_URL}/cart/items`, {
      data: { productId: products.products[0]._id, quantity: 1 },
    });
    await page.goto('/cart');
    await page.reload();
    await expect(page.getByText('TEST QA Tomato')).toBeVisible();
  });

  customerTest('/checkout', async ({ page }) => {
    await page.goto('/checkout');
    await page.reload();
    // Either the checkout form or (if the cart happened to be empty) its
    // empty-cart state — either is a correct cold re-initialization.
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  });

  customerTest('/orders', async ({ page }) => {
    await page.goto('/orders');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
  });

  customerTest('/orders/:id', async ({ page }) => {
    const product = await db.createProductDirect({ price: 10 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 10, quantity: 1 }],
    });
    await page.goto(`/orders/${order._id}`);
    await page.reload();
    await expect(page.getByText(String(order._id), { exact: true })).toBeVisible();
  });
});

adminTest.describe('Page refresh — admin', () => {
  adminTest('/admin', async ({ page }) => {
    await page.goto('/admin');
    await page.reload();
    await expect(page.getByText('Total products')).toBeVisible();
  });

  adminTest('/admin/products', async ({ page }) => {
    await page.goto('/admin/products');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Add product' })).toBeVisible();
  });

  adminTest('/admin/categories', async ({ page }) => {
    await page.goto('/admin/categories');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Add category' })).toBeVisible();
  });

  adminTest('/admin/orders', async ({ page }) => {
    await page.goto('/admin/orders');
    await page.reload();
    await expect(page.getByLabel('Order status')).toBeVisible();
  });

  adminTest('/admin/orders/:id', async ({ page }) => {
    const product = await db.createProductDirect({ price: 12 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 12, quantity: 1 }],
    });
    await page.goto(`/admin/orders/${order._id}`);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Update status' })).toBeVisible();
  });
});
