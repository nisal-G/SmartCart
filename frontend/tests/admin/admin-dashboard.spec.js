import { adminTest, expect } from '../fixtures.js';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';

adminTest.describe('Admin dashboard', () => {
  adminTest('loads with AdminNav and links to Products/Categories/Orders', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();

    const adminNav = page.getByRole('navigation', { name: 'Admin navigation' });
    await expect(adminNav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(adminNav.getByRole('link', { name: 'Products' })).toBeVisible();
    await expect(adminNav.getByRole('link', { name: 'Categories' })).toBeVisible();
    await expect(adminNav.getByRole('link', { name: 'Orders' })).toBeVisible();
  });

  adminTest('statistics are the real values GET /products, /categories and /orders/all return', async ({
    page,
    context,
  }) => {
    const [productsRes, categoriesRes, ordersRes, pendingRes] = await Promise.all([
      context.request.get(`${BACKEND_API_URL}/products?limit=1`).then((r) => r.json()),
      context.request.get(`${BACKEND_API_URL}/categories`).then((r) => r.json()),
      context.request.get(`${BACKEND_API_URL}/orders/all?limit=1`).then((r) => r.json()),
      context.request.get(`${BACKEND_API_URL}/orders/all?limit=1&status=pending`).then((r) => r.json()),
    ]);

    await page.goto('/admin');
    await expect(page.getByText('Total products')).toBeVisible();

    // The label <p> and value <p> are direct siblings inside one card <div>
    // — walk up to that div rather than matching any ancestor div (the
    // whole 4-card grid also "has" each label as a descendant).
    const statCard = (label) => page.getByText(label, { exact: true }).locator('xpath=..');
    await expect(statCard('Total products').getByText(String(productsRes.pagination.total))).toBeVisible();
    await expect(statCard('Total categories').getByText(String(categoriesRes.categories.length))).toBeVisible();
    await expect(statCard('Total orders').getByText(String(ordersRes.pagination.total))).toBeVisible();
    await expect(statCard('Pending orders').getByText(String(pendingRes.pagination.total))).toBeVisible();
  });

  adminTest('Manage products / categories / orders links navigate correctly', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: 'Manage products →' }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);

    await page.goto('/admin');
    await page.getByRole('link', { name: 'Manage categories →' }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);

    await page.goto('/admin');
    await page.getByRole('link', { name: 'Manage orders →' }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);

    await page.goto('/admin');
    await page.getByRole('link', { name: 'View pending orders →' }).click();
    await expect(page).toHaveURL(/\/admin\/orders\?status=pending$/);
  });
});
