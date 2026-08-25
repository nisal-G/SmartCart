import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminTest, expect } from '../fixtures.js';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE_PATH = path.join(__dirname, '..', 'e2e-env', 'fixtures', 'test-image.png');

// Same desktop-table/mobile-card duplication as AdminProducts — scope to
// the table, which is the visible one at the default 1280px project.
const categoriesTable = (page) => page.getByRole('table');

adminTest.describe('Admin categories — list', () => {
  adminTest('lists the seeded categories (unpaginated)', async ({ page }) => {
    await page.goto('/admin/categories');
    await expect(categoriesTable(page).getByText('TEST QA Vegetables', { exact: true })).toBeVisible();
    await expect(categoriesTable(page).getByText('TEST QA Fruits', { exact: true })).toBeVisible();
    await expect(categoriesTable(page).getByText('TEST QA Bakery', { exact: true })).toBeVisible();
  });
});

adminTest.describe('Admin categories — add/edit/delete', () => {
  adminTest('empty required name is rejected client-side', async ({ page }) => {
    await page.goto('/admin/categories/new');
    await page.getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByText('Category name is required')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/categories\/new$/);
  });

  adminTest('duplicate category name surfaces the backend\'s own 409 message as-is', async ({ page }) => {
    await page.goto('/admin/categories/new');
    await page.getByLabel('Name').fill('TEST QA Vegetables'); // already seeded
    await page.getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByText(/already exists/i)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/categories\/new$/);
  });

  adminTest('valid category creation succeeds, then edit and delete round-trip correctly', async ({ page }) => {
    const name = `TEST QA New Category ${Date.now()}`;
    await page.goto('/admin/categories/new');
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Description').fill('Created by Playwright E2E.');
    await page.getByLabel('Image URL').fill('https://example.com/category.jpg');
    await page.getByRole('button', { name: 'Add category' }).click();

    await expect(page).toHaveURL(/\/admin\/categories$/);
    await expect(page.getByText('Category created successfully')).toBeVisible();
    const row = categoriesTable(page).locator('tr', { hasText: name });
    await expect(row).toBeVisible();

    // Edit.
    await row.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByLabel('Name')).toHaveValue(name);
    const newDescription = 'Updated by Playwright E2E.';
    await page.getByLabel('Description').fill(newDescription);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);
    await expect(page.getByText('Category updated successfully')).toBeVisible();
    await expect(categoriesTable(page).getByText(newDescription)).toBeVisible();

    // Delete (confirm flow) — also cleans up this test's own data.
    const updatedRow = categoriesTable(page).locator('tr', { hasText: name });
    await updatedRow.getByRole('button', { name: 'Delete' }).click();
    await expect(updatedRow.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await updatedRow.getByRole('button', { name: 'Cancel' }).click();
    await expect(categoriesTable(page).getByText(name, { exact: true })).toBeVisible(); // cancel leaves it

    await updatedRow.getByRole('button', { name: 'Delete' }).click();
    await updatedRow.getByRole('button', { name: 'Confirm' }).click();
    await expect(categoriesTable(page).getByText(name, { exact: true })).toHaveCount(0);
  });
});

adminTest.describe('Admin categories — image upload hardening', () => {
  adminTest(
    'a selected file is sent as genuine multipart/form-data (regression guard, mirrors the product upload fix)',
    async ({ page }) => {
      const name = `TEST QA Upload Category ${Date.now()}`;
      await page.goto('/admin/categories/new');
      await page.getByLabel('Name').fill(name);
      await page.setInputFiles('#category-image-file', TEST_IMAGE_PATH);
      await expect(page.getByLabel('Image URL')).toBeDisabled();

      const requestPromise = page.waitForRequest(
        (req) => req.method() === 'POST' && req.url().endsWith('/api/categories')
      );
      await page.getByRole('button', { name: 'Add category' }).click();
      const request = await requestPromise;

      const contentType = request.headers()['content-type'] || '';
      expect(contentType).toMatch(/^multipart\/form-data; ?boundary=/);

      // Same reasoning as admin-products.spec.js's upload test: Supabase
      // is deliberately unconfigured on the ephemeral backend, so a
      // genuinely-parsed multipart request reaches uploadImage() and 503s
      // there — a different, later failure than the JSON.stringify bug
      // would have produced (a 400 from missing text fields).
      const response = await request.response();
      expect(response.status()).toBe(503);
      const body = await response.json();
      expect(body.message).toMatch(/not configured/i);

      await expect(page.getByText(/not configured/i)).toBeVisible();
    }
  );
});

adminTest.describe('Admin categories — deleting a category referenced by products', () => {
  adminTest('is allowed (backend has no referential-integrity guard) — no invented frontend rule', async ({
    page,
    context,
  }) => {
    // Deliberately create a category WITH a product still pointing at it,
    // then delete the category — per categoryController.deleteCategory
    // (confirmed by inspection), this is unconditionally allowed. The
    // frontend must not invent a blocking rule the backend doesn't have.
    const category = await context.request
      .post(`${BACKEND_API_URL}/categories`, { data: { name: `TEST QA Referenced Category ${Date.now()}` } })
      .then((r) => r.json())
      .then((d) => d.category);
    await context.request.post(`${BACKEND_API_URL}/products`, {
      data: { name: `TEST QA Orphanable Product ${Date.now()}`, price: 1, category: category._id },
    });

    await page.goto('/admin/categories');
    const row = categoriesTable(page).locator('tr', { hasText: category.name });
    await row.getByRole('button', { name: 'Delete' }).click();
    await row.getByRole('button', { name: 'Confirm' }).click();

    await expect(categoriesTable(page).getByText(category.name, { exact: true })).toHaveCount(0);
  });
});
