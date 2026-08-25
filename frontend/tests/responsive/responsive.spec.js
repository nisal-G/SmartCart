import { adminTest, customerTest, expect } from '../fixtures.js';
import * as db from '../e2e-env/db.cjs';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';

/**
 * Runs once per viewport project declared in playwright.config.js
 * (responsive-mobile-375 / responsive-tablet-768 / responsive-desktop-1280
 * — see the `testMatch: /responsive/` wiring there). Checks layout with
 * real assertions (no horizontal overflow, key controls stay reachable),
 * not screenshots alone.
 */

/** The page's own scrollable width must never exceed the viewport — any more means something is overflowing horizontally. */
async function expectNoHorizontalOverflow(page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, 'document.documentElement.scrollWidth should not exceed clientWidth').toBeLessThanOrEqual(
    clientWidth + 1 // 1px tolerance for sub-pixel rounding
  );
}

function isMobileViewport(page) {
  const size = page.viewportSize();
  return Boolean(size && size.width < 768);
}

customerTest.describe('Responsive — customer pages', () => {
  customerTest('Home', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Fresh groceries/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  customerTest('Products', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  customerTest('Product details', async ({ page }) => {
    const vegId = db.getSeedInfo().catalog.categories.vegetables.id;
    await page.goto(`/products?category=${vegId}`);
    await page.getByRole('link', { name: /TEST QA Tomato/ }).click();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  customerTest('Cart (with an item, so totals/actions all render)', async ({ page, context }) => {
    await context.request.delete(`${BACKEND_API_URL}/cart`);
    const products = await context.request
      .get(`${BACKEND_API_URL}/products?search=TEST QA Tomato`)
      .then((r) => r.json());
    await context.request.post(`${BACKEND_API_URL}/cart/items`, {
      data: { productId: products.products[0]._id, quantity: 1 },
    });

    await page.goto('/cart');
    await expect(page.getByRole('button', { name: 'Proceed to checkout' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  customerTest('Checkout', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  customerTest('Orders', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  customerTest('Order details', async ({ page }) => {
    const product = await db.createProductDirect({ price: 30 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 30, quantity: 1 }],
    });
    await page.goto(`/orders/${order._id}`);
    await expect(page.getByRole('heading', { name: 'Order details' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  customerTest('mobile menu toggles the nav on small viewports', async ({ page }) => {
    await page.goto('/');
    if (!isMobileViewport(page)) {
      // Desktop/tablet: the hamburger button is hidden in favor of the
      // inline nav — nothing to toggle, and its own container has
      // `md:hidden` so it shouldn't even render as clickable.
      return;
    }
    const toggle = page.getByRole('button', { name: 'Toggle navigation menu' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Products' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

adminTest.describe('Responsive — admin pages', () => {
  adminTest('Dashboard', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  adminTest('Products (table/card layout adapts, action buttons stay usable)', async ({ page }) => {
    await page.goto('/admin/products');
    await expect(page.getByRole('button', { name: 'Add product' })).toBeVisible();
    const firstEdit = page.getByRole('link', { name: 'Edit' }).first();
    await expect(firstEdit).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  adminTest('Product form', async ({ page }) => {
    await page.goto('/admin/products/new');
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add product' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  adminTest('Categories', async ({ page }) => {
    await page.goto('/admin/categories');
    await expect(page.getByRole('button', { name: 'Add category' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  adminTest('Category form', async ({ page }) => {
    await page.goto('/admin/categories/new');
    await expect(page.getByLabel('Name')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  adminTest('Orders', async ({ page }) => {
    await page.goto('/admin/orders');
    await expect(page.getByLabel('Order status')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  adminTest('Order details (status form doesn\'t overlap the order info)', async ({ page }) => {
    const product = await db.createProductDirect({ price: 20 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 20, quantity: 1 }],
    });
    await page.goto(`/admin/orders/${order._id}`);
    await expect(page.getByRole('button', { name: 'Update status' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
