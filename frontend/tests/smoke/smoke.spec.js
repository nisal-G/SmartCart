import { test, expect } from '@playwright/test';
import { watchConsole } from '../e2e-env/console-watch.js';

test.describe('Smoke', () => {
  test('Home page loads with navbar, footer, and main content, no console errors', async ({ page }) => {
    const getErrors = watchConsole(page);
    await page.goto('/');

    await expect(page.getByRole('navigation').first()).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible(); // <footer>
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();

    expect(getErrors()).toEqual([]);
  });

  test('Products page loads and renders products from the backend', async ({ page }) => {
    const getErrors = watchConsole(page);
    const responsePromise = page.waitForResponse((res) => res.url().includes('/api/products') && res.request().method() === 'GET');
    await page.goto('/products');
    const response = await responsePromise;
    expect(response.ok()).toBe(true);

    // Either real product cards or the documented empty state — both are a
    // successful load; an unhandled error state is not.
    const emptyState = page.getByText('No products found', { exact: true });
    const anyProductLink = page.locator('a[href^="/products/"]').first();
    await expect(emptyState.or(anyProductLink)).toBeVisible();

    expect(getErrors()).toEqual([]);
  });

  test('Invalid route renders the 404 page without crashing the app', async ({ page }) => {
    const getErrors = watchConsole(page);
    await page.goto('/something-that-does-not-exist');

    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible();

    expect(getErrors()).toEqual([]);
  });
});
