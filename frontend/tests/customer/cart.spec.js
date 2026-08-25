import { customerTest, expect } from '../fixtures.js';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';
import * as db from '../e2e-env/db.cjs';

/**
 * Product -> Add to Cart -> Cart -> Update Quantity -> Remove -> Clear Cart.
 * Every assertion reads real state back from the backend (page reload after
 * a mutation, or the badge/total the UI derives from CartContext's
 * server-owned state) rather than assuming the click "worked".
 */
async function addProductToCart(page, productName) {
  // Category-scoped, not the default unfiltered /products page 1: other
  // suites create their own fixture products over a full run, which can
  // push a specific baseline product off page 1 (see the identical note
  // in product-browsing.spec.js). "TEST QA Vegetables" only ever gets
  // products explicitly assigned to it, so it stays small and stable.
  const vegId = db.getSeedInfo().catalog.categories.vegetables.id;
  await page.goto(`/products?category=${vegId}`);
  await page.getByRole('link', { name: new RegExp(productName) }).click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText('Added to cart.')).toBeVisible();
}

customerTest.describe('Customer cart', () => {
  // Each test starts from a clean, known cart state. Reset via the API
  // directly (same cookies as `page`, since APIRequestContext shares the
  // browser context) rather than through the UI's own "Clear cart" button
  // — standard Playwright practice: use the API for setup/teardown state a
  // test isn't itself exercising, and keep UI interaction for what is.
  customerTest.beforeEach(async ({ context }) => {
    const res = await context.request.delete(`${BACKEND_API_URL}/cart`);
    expect(res.ok()).toBe(true);
  });

  customerTest('empty cart shows the empty state', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByText('Your cart is empty')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue shopping' })).toBeVisible();
  });

  customerTest('added product appears in the cart with correct subtotal, and the navbar badge updates', async ({ page }) => {
    await addProductToCart(page, 'TEST QA Onion'); // price 90

    await expect(page.getByRole('link', { name: 'Cart' }).getByText('1', { exact: true })).toBeVisible();

    await page.goto('/cart');
    await expect(page.getByText('TEST QA Onion')).toBeVisible();
    await expect(page.getByText('LKR 90.00', { exact: true }).first()).toBeVisible(); // subtotal for qty 1
  });

  customerTest('quantity increase/decrease updates subtotal and total; cannot go below 1', async ({ page }) => {
    await addProductToCart(page, 'TEST QA Onion'); // price 90
    await page.goto('/cart');

    const decreaseBtn = page.getByRole('button', { name: /Decrease quantity of TEST QA Onion/ });
    const increaseBtn = page.getByRole('button', { name: /Increase quantity of TEST QA Onion/ });

    await expect(decreaseBtn).toBeDisabled(); // qty is 1, can't go lower via the UI

    await increaseBtn.click();
    await expect(page.locator('li', { hasText: 'TEST QA Onion' }).getByText('2', { exact: true })).toBeVisible();
    await expect(page.getByText('LKR 180.00', { exact: true }).first()).toBeVisible();

    await decreaseBtn.click();
    await expect(page.locator('li', { hasText: 'TEST QA Onion' }).getByText('1', { exact: true })).toBeVisible();
    await expect(decreaseBtn).toBeDisabled();
  });

  customerTest('remove item empties the cart and shows the empty state', async ({ page }) => {
    await addProductToCart(page, 'TEST QA Onion');
    await page.goto('/cart');

    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('Your cart is empty')).toBeVisible();
  });

  customerTest('clear cart requires confirmation, then empties the cart', async ({ page }) => {
    await addProductToCart(page, 'TEST QA Onion');
    await page.goto('/cart');

    await page.getByRole('button', { name: 'Clear cart' }).click();
    await expect(page.getByRole('button', { name: 'Confirm clear cart' })).toBeVisible();

    // Cancel leaves the cart untouched.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('TEST QA Onion')).toBeVisible();

    await page.getByRole('button', { name: 'Clear cart' }).click();
    await page.getByRole('button', { name: 'Confirm clear cart' }).click();
    await expect(page.getByText('Your cart is empty')).toBeVisible();
  });

  customerTest('cart state survives a page refresh (server-owned, not just in-memory)', async ({ page }) => {
    await addProductToCart(page, 'TEST QA Onion');
    await page.goto('/cart');
    await expect(page.getByText('TEST QA Onion')).toBeVisible();

    await page.reload();
    await expect(page.getByText('TEST QA Onion')).toBeVisible();
  });
});
