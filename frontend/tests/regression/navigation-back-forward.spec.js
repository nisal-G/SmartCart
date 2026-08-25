import { adminTest, customerTest, expect } from '../fixtures.js';
import * as db from '../e2e-env/db.cjs';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';

customerTest.describe('Back/forward navigation — customer', () => {
  customerTest('Products -> Product Details -> Back returns to the products list', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('link', { name: /TEST QA/ }).first().click();
    await expect(page).toHaveURL(/\/products\/[a-f0-9]{24}/);

    await page.goBack();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  });

  customerTest('Product -> Cart -> Checkout -> back does not create a broken state', async ({ page, context }) => {
    const vegId = db.getSeedInfo().catalog.categories.vegetables.id;
    await context.request.delete(`${BACKEND_API_URL}/cart`);
    await page.goto(`/products?category=${vegId}`);
    await page.getByRole('link', { name: /TEST QA Tomato/ }).click();
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByText('Added to cart.')).toBeVisible();

    await page.goto('/cart');
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
  });

  customerTest('Orders -> Order Details -> Back returns to the order list', async ({ page }) => {
    const product = await db.createProductDirect({ price: 15 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 15, quantity: 1 }],
    });

    await page.goto('/orders');
    await page.locator('li', { has: page.locator(`[title="${order._id}"]`) }).getByRole('link', { name: 'View details' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${order._id}$`));

    await page.goBack();
    await expect(page).toHaveURL(/\/orders$/);
  });
});

adminTest.describe('Back/forward navigation — admin', () => {
  adminTest('Dashboard -> Products -> Back returns to the dashboard', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: 'Manage products →' }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText('Total products')).toBeVisible();
  });

  adminTest('Products -> Edit -> Back returns to the products list', async ({ page, context }) => {
    const category = await context.request
      .get(`${BACKEND_API_URL}/categories`)
      .then((r) => r.json())
      .then((d) => d.categories.find((c) => c.name === 'TEST QA Vegetables'));
    const created = await context.request
      .post(`${BACKEND_API_URL}/products`, {
        data: { name: `TEST QA Nav Target ${Date.now()}`, price: 9, category: category._id },
      })
      .then((r) => r.json());

    await page.goto('/admin/products');
    const row = page.locator('tr', { hasText: created.product.name });
    await row.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/products/${created.product._id}/edit$`));

    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/products$/);

    // Clean up.
    await context.request.delete(`${BACKEND_API_URL}/products/${created.product._id}`);
  });

  adminTest('Dashboard -> Categories -> Back returns to the dashboard', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: 'Manage categories →' }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin$/);
  });

  adminTest('Dashboard -> Orders -> Back returns to the dashboard', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: 'Manage orders →' }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin$/);
  });

  adminTest('Orders -> Details -> Back returns to the order list', async ({ page }) => {
    const product = await db.createProductDirect({ price: 25 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 25, quantity: 1 }],
    });

    await page.goto('/admin/orders');
    await page
      .locator('tr', { has: page.locator(`[title="${order._id}"]`) })
      .getByRole('link', { name: 'View details' })
      .click();
    await expect(page).toHaveURL(new RegExp(`/admin/orders/${order._id}$`));

    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/orders$/);
  });
});
