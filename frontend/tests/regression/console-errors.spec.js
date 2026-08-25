import { adminTest, customerTest, expect } from '../fixtures.js';
import { watchConsole } from '../e2e-env/console-watch.js';
import * as db from '../e2e-env/db.cjs';

/**
 * A broad sweep: load every major page and assert no unexpected
 * console.error/pageerror was logged (see console-watch.js for what
 * "expected" means — anonymous/role-mismatched 401/403s only).
 */
customerTest.describe('Console error sweep — customer', () => {
  const pages = ['/', '/products', '/cart', '/checkout', '/orders'];
  for (const path of pages) {
    customerTest(`${path}`, async ({ page }) => {
      const getErrors = watchConsole(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(getErrors()).toEqual([]);
    });
  }

  customerTest('/products/:id and /orders/:id', async ({ page }) => {
    const getErrors = watchConsole(page);
    const vegId = db.getSeedInfo().catalog.categories.vegetables.id;
    await page.goto(`/products?category=${vegId}`);
    await page.getByRole('link', { name: /TEST QA Tomato/ }).click();
    await page.waitForLoadState('networkidle');

    const product = await db.createProductDirect({ price: 5 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 5, quantity: 1 }],
    });
    await page.goto(`/orders/${order._id}`);
    await page.waitForLoadState('networkidle');

    expect(getErrors()).toEqual([]);
  });
});

adminTest.describe('Console error sweep — admin', () => {
  const pages = ['/admin', '/admin/products', '/admin/products/new', '/admin/categories', '/admin/categories/new', '/admin/orders'];
  for (const path of pages) {
    adminTest(`${path}`, async ({ page }) => {
      const getErrors = watchConsole(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(getErrors()).toEqual([]);
    });
  }

  adminTest('/admin/orders/:id', async ({ page }) => {
    const getErrors = watchConsole(page);
    const product = await db.createProductDirect({ price: 6 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 6, quantity: 1 }],
    });
    await page.goto(`/admin/orders/${order._id}`);
    await page.waitForLoadState('networkidle');
    expect(getErrors()).toEqual([]);
  });
});

customerTest.describe('Failed-request sweep', () => {
  customerTest('no unexpected (non-4xx-auth) failed requests while browsing the storefront', async ({ page }) => {
    const unexpectedFailures = [];
    page.on('requestfailed', (req) => {
      unexpectedFailures.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
    });
    page.on('response', (res) => {
      const status = res.status();
      if (status >= 500) {
        unexpectedFailures.push(`${res.request().method()} ${res.url()}: HTTP ${status}`);
      }
    });

    await page.goto('/');
    await page.goto('/products');
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    expect(unexpectedFailures).toEqual([]);
  });
});
