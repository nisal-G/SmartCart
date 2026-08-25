import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminTest, expect } from '../fixtures.js';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE_PATH = path.join(__dirname, '..', 'e2e-env', 'fixtures', 'test-image.png');

// AdminProducts renders BOTH a desktop table (`hidden md:block`) and a
// mobile card list (`md:hidden`) at once — only one is actually visible at
// a given viewport, but both exist in the DOM, so an unscoped text query
// is ambiguous (strict-mode violation). The default "chromium" project is
// 1280px wide, so the table is the visible one; scope list-page
// assertions to it. (Both variants get their own dedicated coverage in
// responsive/responsive.spec.js.)
const productsTable = (page) => page.getByRole('table');

adminTest.describe('Admin products — list, search, filters, pagination', () => {
  adminTest('list loads and paginates (10/page) — at least the seeded 14-product catalog', async ({ page }) => {
    // Asserted relatively, not as an exact page count: other admin specs
    // (e.g. admin-order-status.spec.js) create their own fixture products
    // via db.cjs as order-item targets, growing the shared catalog over a
    // full suite run.
    await page.goto('/admin/products');
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
  });

  adminTest('search filters by product name', async ({ page }) => {
    await page.goto('/admin/products');
    await page.getByLabel('Search').fill('TEST QA Tomato');
    await page.getByRole('button', { name: 'Apply filters' }).click();

    await expect(page).toHaveURL(/search=/);
    await expect(productsTable(page).getByText('TEST QA Tomato', { exact: true })).toBeVisible();
    await expect(productsTable(page).getByText('TEST QA Apple', { exact: true })).toHaveCount(0);
  });

  adminTest('category filter shows only that category\'s products', async ({ page }) => {
    await page.goto('/admin/products');
    await page.getByLabel('Category').selectOption({ label: 'TEST QA Bakery' });
    await page.getByRole('button', { name: 'Apply filters' }).click();

    await expect(page).toHaveURL(/category=/);
    await expect(productsTable(page).getByText('TEST QA Bread', { exact: true })).toBeVisible();
    await expect(productsTable(page).getByText('TEST QA Tomato', { exact: true })).toHaveCount(0);
  });

  adminTest('price filters narrow the list to the given range', async ({ page }) => {
    await page.goto('/admin/products');
    await page.getByLabel('Min price').fill('200');
    await page.getByRole('button', { name: 'Apply filters' }).click();

    await expect(page).toHaveURL(/minPrice=200/);
    // TEST QA Apple (200) qualifies; TEST QA Tomato (120) doesn't.
    await expect(productsTable(page).getByText('TEST QA Apple', { exact: true })).toBeVisible();
    await expect(productsTable(page).getByText('TEST QA Tomato', { exact: true })).toHaveCount(0);
  });

  adminTest('Clear filters resets search/category/price and the URL', async ({ page }) => {
    await page.goto('/admin/products?search=Tomato');
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
  });
});

adminTest.describe('Admin products — add/edit/delete', () => {
  adminTest('empty required fields are rejected client-side, never round-tripped to the backend', async ({
    page,
  }) => {
    await page.goto('/admin/products/new');
    // Left entirely empty (not e.g. "-5"): a negative price is blocked by
    // the <input min="0.01"> browser-native constraint before the form
    // ever submits, which would test native HTML validation instead of
    // AdminProductForm's own validate().
    await page.getByRole('button', { name: 'Add product' }).click();

    await expect(page.getByText('Product name is required')).toBeVisible();
    await expect(page.getByText('Price is required')).toBeVisible();
    await expect(page.getByText('Category is required')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/products\/new$/);
  });

  adminTest('valid product creation with an image URL succeeds and shows the flash message', async ({ page }) => {
    const name = `TEST QA New Product ${Date.now()}`;
    await page.goto('/admin/products/new');
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Description').fill('Created by Playwright E2E.');
    await page.getByLabel('Price').fill('42.50');
    await page.getByLabel('Category').selectOption({ label: 'TEST QA Vegetables' });
    await page.getByLabel('Image URL').fill('https://example.com/image.jpg');
    await page.getByRole('button', { name: 'Add product' }).click();

    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(page.getByText('Product created successfully')).toBeVisible();

    // Clean up: find it and delete it (section 42 — clean up test data).
    // A newly-created product sorts first anyway (newest-first), so it's
    // already visible before the filtered fetch lands — wait for the list
    // to actually narrow to one row before interacting, or the Delete
    // click below can race the still-in-flight filtered request.
    await page.getByLabel('Search').fill(name);
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('No products', { exact: true })).toBeVisible();
  });

  adminTest('edit loads existing values, updates, and the change is reflected in the list', async ({ page, context }) => {
    // Create via API so this test only exercises the edit flow itself.
    const category = await context.request
      .get(`${BACKEND_API_URL}/categories`)
      .then((r) => r.json())
      .then((d) => d.categories.find((c) => c.name === 'TEST QA Vegetables'));
    const created = await context.request
      .post(`${BACKEND_API_URL}/products`, {
        data: { name: `TEST QA Edit Target ${Date.now()}`, price: 10, category: category._id },
      })
      .then((r) => r.json());
    const product = created.product;

    await page.goto(`/admin/products/${product._id}/edit`);
    await expect(page.getByLabel('Name')).toHaveValue(product.name);
    await expect(page.getByLabel('Price')).toHaveValue('10');

    await page.getByLabel('Price').fill('99.99');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(page.getByText('Product updated successfully')).toBeVisible();

    await page.getByLabel('Search').fill(product.name);
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(1);
    await expect(productsTable(page).getByText('LKR 99.99', { exact: true })).toBeVisible();

    // Clean up.
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
  });

  adminTest('delete requires confirmation, then removes the product', async ({ page, context }) => {
    const category = await context.request
      .get(`${BACKEND_API_URL}/categories`)
      .then((r) => r.json())
      .then((d) => d.categories.find((c) => c.name === 'TEST QA Vegetables'));
    const created = await context.request
      .post(`${BACKEND_API_URL}/products`, {
        data: { name: `TEST QA Delete Target ${Date.now()}`, price: 5, category: category._id },
      })
      .then((r) => r.json());
    const product = created.product;

    await page.goto(`/admin/products?search=${encodeURIComponent(product.name)}`);
    await expect(productsTable(page).getByText(product.name, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(productsTable(page).getByText(product.name, { exact: true })).toBeVisible(); // cancel leaves it

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('No products', { exact: true })).toBeVisible();
  });
});

adminTest.describe('Admin products — image upload hardening', () => {
  adminTest(
    'a selected file is sent as genuine multipart/form-data (regression guard for the historical api.js FormData/Content-Type bug)',
    async ({ page }) => {
      await page.goto('/admin/products/new');
      await page.getByLabel('Name').fill(`TEST QA Upload Product ${Date.now()}`);
      await page.getByLabel('Price').fill('15');
      await page.getByLabel('Category').selectOption({ label: 'TEST QA Vegetables' });
      await page.setInputFiles('#product-image-file', TEST_IMAGE_PATH);

      // Image URL input is disabled once a file is selected — the file
      // must take precedence, never silently ignored.
      await expect(page.getByLabel('Image URL')).toBeDisabled();

      const requestPromise = page.waitForRequest(
        (req) => req.method() === 'POST' && req.url().endsWith('/api/products')
      );
      await page.getByRole('button', { name: 'Add product' }).click();
      const request = await requestPromise;

      const contentType = request.headers()['content-type'] || '';
      expect(contentType).toMatch(/^multipart\/form-data; ?boundary=/);

      // Chromium/CDP doesn't reliably expose the raw bytes of a
      // multipart body containing a real file part (request.postData()/
      // postDataBuffer() are frequently null for these — a known
      // Playwright/CDP limitation, not something to work around by
      // weakening the assertion). The Content-Type/boundary header above
      // is the direct client-side proof of genuine multipart encoding;
      // the response below is the server-side proof it actually arrived
      // correctly parsed — see the reasoning underneath.
      const response = await request.response();

      // Supabase is deliberately unconfigured on the ephemeral test
      // backend (see global-setup.cjs), so a genuinely-parsed multipart
      // upload reaches productController.createProduct's
      // imageStorageService.uploadImage() call and 503s there — a
      // DIFFERENT, later failure than what the historical bug produced.
      // That bug JSON.stringified the FormData (turning the file into the
      // literal string "{}" and dropping name/price/category as real
      // fields), which multer/express-validator would have rejected as a
      // 400 (missing required fields) before ever reaching the image
      // upload step. So specifically getting the 503 "not configured"
      // response — not a 400 — is conclusive proof the browser sent real
      // multipart/form-data with the file and text fields intact.
      expect(response.status()).toBe(503);
      const body = await response.json();
      expect(body.message).toMatch(/not configured/i);
      // Sanitized message only — never a stack trace / Multer internals.
      expect(body.message).not.toMatch(/at\s+\w+\.js:\d+|multer|enoent/i);

      await expect(page.getByText(/not configured/i)).toBeVisible();
    }
  );
});
