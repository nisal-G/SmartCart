import { test as base, expect } from '@playwright/test';
import { adminTest, customerTest } from '../fixtures.js';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';

const test = base;

const ADMIN_ROUTES = ['/admin', '/admin/products', '/admin/categories', '/admin/orders', '/admin/users'];
const CUSTOMER_PROTECTED_ROUTES = ['/cart', '/checkout', '/orders'];

test.describe('Authorization — unauthenticated visitor', () => {
  for (const route of ADMIN_ROUTES) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  for (const route of CUSTOMER_PROTECTED_ROUTES) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test('/orders/:id redirects to /login', async ({ page }) => {
    await page.goto('/orders/507f1f77bcf86cd799439011');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('/admin/orders/:id redirects to /login', async ({ page }) => {
    await page.goto('/admin/orders/507f1f77bcf86cd799439011');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('API-level: GET /orders/all (admin-only) returns 401, not data', async ({ request }) => {
    const res = await request.get(`${BACKEND_API_URL}/orders/all`);
    expect(res.status()).toBe(401);
  });

  test('API-level: GET /orders (own orders) returns 401', async ({ request }) => {
    const res = await request.get(`${BACKEND_API_URL}/orders`);
    expect(res.status()).toBe(401);
  });
});

customerTest.describe('Authorization — authenticated normal customer (role "user")', () => {
  for (const route of ADMIN_ROUTES) {
    customerTest(`${route} denies admin access (redirected away, never rendered)`, async ({ page }) => {
      await page.goto(route);
      await expect(page).not.toHaveURL(new RegExp(route.replace(/\//g, '\\/') + '$'));
      await expect(page.getByRole('heading', { name: 'Admin' })).toHaveCount(0);
    });
  }

  customerTest('a customer session CAN reach the customer-protected routes (no role restriction there)', async ({
    page,
  }) => {
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/cart$/);
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/orders$/);
  });

  customerTest('API-level: GET /orders/all (admin-only) returns 403 for a logged-in customer', async ({ context }) => {
    const res = await context.request.get(`${BACKEND_API_URL}/orders/all`);
    expect(res.status()).toBe(403);
  });

  customerTest('API-level: PATCH /orders/:id/status (admin-only) returns 403 for a logged-in customer', async ({
    context,
  }) => {
    const res = await context.request.patch(`${BACKEND_API_URL}/orders/507f1f77bcf86cd799439011/status`, {
      data: { status: 'confirmed' },
    });
    expect(res.status()).toBe(403);
  });
});

adminTest.describe('Authorization — authenticated admin', () => {
  for (const route of ADMIN_ROUTES) {
    adminTest(`${route} grants access`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, '\\/') + '$'));
      await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
    });
  }

  adminTest('an admin session CAN also reach the customer-protected routes', async ({ page }) => {
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/cart$/);
  });
});
