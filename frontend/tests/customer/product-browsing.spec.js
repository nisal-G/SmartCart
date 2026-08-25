import { expect } from '@playwright/test';
import { test as base } from '@playwright/test';
import { customerTest } from '../fixtures.js';
import { watchConsole } from '../e2e-env/console-watch.js';
import * as db from '../e2e-env/db.cjs';

const test = base;

// Other suites (admin order/product fixtures in particular) create their
// own products/categories over a full run, which can push a specific
// baseline product off page 1 of the default, unfiltered /products list.
// Tests that need to click a specific baseline product go through this
// category-scoped URL instead — "TEST QA Vegetables" only ever gets
// products explicitly assigned to it (see global-setup.cjs), so it stays
// a small, stable set regardless of what else the suite creates elsewhere.
function vegetablesProductsUrl() {
  return `/products?category=${db.getSeedInfo().catalog.categories.vegetables.id}`;
}

/**
 * Home -> Products -> category filter -> Product Details -> Add to Cart.
 * See tests/e2e-env/global-setup.cjs for the seeded "TEST QA Vegetables/
 * Fruits/Bakery" catalog this test targets by name (deterministic, not "any
 * product").
 */
test.describe('Customer product browsing (logged out)', () => {
  test('category tiles on Home link into Products with the right ?category= filter', async ({ page }) => {
    const getErrors = watchConsole(page);
    await page.goto('/');

    // Scoped to the "Shop by category" section specifically — "Recently
    // added" product cards below it also render their category's name, so
    // an unscoped role query matches both.
    const categorySection = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Shop by category' }) });
    const vegTile = categorySection.getByRole('link', { name: /TEST QA Vegetables/i });
    await expect(vegTile).toBeVisible();
    const href = await vegTile.getAttribute('href');
    expect(href).toMatch(/\/products\?category=/);

    await vegTile.click();
    await expect(page).toHaveURL(/\/products\?category=/);
    await expect(page.getByRole('tab', { name: 'TEST QA Vegetables', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Every rendered product card belongs to the selected category.
    await expect(page.getByText('TEST QA Tomato')).toBeVisible();
    await expect(page.getByText('TEST QA Apple')).not.toBeVisible();

    expect(getErrors()).toEqual([]);
  });

  test('category filter pill updates the URL and the product list', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'TEST QA Fruits', exact: true }).click();
    await expect(page).toHaveURL(/category=/);
    await expect(page.getByText('TEST QA Mango')).toBeVisible();
    await expect(page.getByText('TEST QA Tomato')).not.toBeVisible();

    // Switching back to "All" clears the query param entirely.
    await page.getByRole('tab', { name: 'All' }).click();
    await expect(page).not.toHaveURL(/category=/);
  });

  test('pagination controls page through the catalog (asserted relatively — other suites add their own fixture products)', async ({
    page,
  }) => {
    await page.goto('/products');
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
    const next = page.getByRole('button', { name: 'Next' });
    const previous = page.getByRole('button', { name: 'Previous' });
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled(); // the seeded 14-product catalog alone exceeds one 12-item page

    await next.click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
    await expect(previous).toBeEnabled();
  });

  test('an inactive product shows the "Unavailable" badge in the grid', async ({ page }) => {
    await page.goto('/products?category=');
    await page.getByRole('tab', { name: 'TEST QA Vegetables', exact: true }).click();
    const card = page.locator('a[href^="/products/"]', { hasText: 'TEST QA Unavailable Veg' });
    // exact: true — the product's own name ("TEST QA Unavailable Veg")
    // otherwise substring-matches "Unavailable" too.
    await expect(card.getByText('Unavailable', { exact: true })).toBeVisible();
  });

  test('product details page renders product info and Add to Cart control', async ({ page }) => {
    await page.goto(vegetablesProductsUrl());
    await page.getByRole('link', { name: /TEST QA Tomato/ }).click();
    await expect(page).toHaveURL(/\/products\/[a-f0-9]{24}/);

    await expect(page.getByRole('heading', { name: 'TEST QA Tomato' })).toBeVisible();
    // Regression guard: formatCurrency must render the app's real charge
    // currency (LKR, per backend PAYHERE_CURRENCY), not the Intl default of
    // USD — see the fix in src/utils/formatCurrency.js and its report entry.
    await expect(page.getByText('LKR 120.00', { exact: true })).toBeVisible();
    await expect(page.getByText('In stock')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
  });

  test('quantity selector increases/decreases and floors at 1', async ({ page }) => {
    await page.goto(vegetablesProductsUrl());
    await page.getByRole('link', { name: /TEST QA Tomato/ }).click();

    const qty = page.locator('span[aria-live="polite"]').first();
    await expect(qty).toHaveText('1');
    await page.getByRole('button', { name: 'Decrease quantity' }).click();
    await expect(qty).toHaveText('1'); // floors at 1, never 0
    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(qty).toHaveText('3');
  });

  test('an inactive product hides the add-to-cart controls and shows "Currently unavailable"', async ({ page }) => {
    await page.goto('/products?category=');
    await page.getByRole('tab', { name: 'TEST QA Vegetables', exact: true }).click();
    await page.getByRole('link', { name: /TEST QA Unavailable Veg/ }).click();

    await expect(page.getByText('Currently unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(0);
  });

  test('Add to Cart while logged out redirects to /login and preserves the return path', async ({ page }) => {
    await page.goto(vegetablesProductsUrl());
    await page.getByRole('link', { name: /TEST QA Tomato/ }).click();
    const productUrl = page.url();

    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // Admin-login success on this page redirects to `from` when present —
    // exercised end-to-end in auth/session.spec.js; here we only need the
    // redirect itself to have actually happened, not stayed on the product page.
    expect(page.url()).not.toBe(productUrl);
  });
});

customerTest.describe('Customer product browsing (logged in)', () => {
  customerTest('Add to Cart succeeds for an authenticated customer and updates the navbar badge', async ({ page }) => {
    await page.goto(vegetablesProductsUrl());
    await page.getByRole('link', { name: /TEST QA Potato/ }).click();

    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByText('Added to cart.')).toBeVisible();

    // Navbar cart link gains a numeric badge once itemCount > 0.
    await expect(page.getByRole('link', { name: 'Cart' }).getByText(/^\d+$/)).toBeVisible();
  });
});
