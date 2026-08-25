import { test as setup, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STORAGE_STATE_PATH } from './e2e-env/constants.cjs';

/**
 * Runs once before the "chromium"/"responsive-*" projects (see
 * playwright.config.js `dependencies`). Logs in as the TEST QA Admin
 * through the REAL /login UI form — admin auth is a genuine password
 * flow, so no shortcut is needed or used (contrast with the customer
 * session, minted directly in tests/e2e-env/global-setup.cjs because no
 * customer login flow can be automated — see that file's comment).
 */
setup('authenticate as TEST QA Admin', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();

  // Login.jsx navigates to `redirectTo` (ROUTES.HOME here, no `from` state)
  // only after adminLogin() resolves — a reliable "login actually succeeded" signal.
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();

  await page.context().storageState({ path: ADMIN_STORAGE_STATE_PATH });
});
