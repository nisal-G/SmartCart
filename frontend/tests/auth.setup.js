import { test as setup, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STORAGE_STATE_PATH } from './e2e-env/constants.cjs';

/**
 * Runs once before the "chromium"/"responsive-*" projects (see
 * playwright.config.js `dependencies`). Logs in as the TEST QA Admin
 * through the REAL /admin/login UI form — admin auth is a genuine password
 * flow, so no shortcut is needed or used (contrast with the customer
 * session, minted directly in tests/e2e-env/global-setup.cjs because no
 * customer login flow can be automated — see that file's comment).
 *
 * Uses the dedicated AdminLogin page (pages/admin/AdminLogin.jsx), not the
 * shopper-facing /login form — that form only ever offers Google/Facebook/
 * Passkey and has no email/password fields for this to fill.
 */
setup('authenticate as TEST QA Admin', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();

  // AdminLogin.jsx navigates to `redirectTo` (ROUTES.ADMIN here, no `from`
  // state) only after adminLogin() resolves — a reliable "login actually
  // succeeded" signal.
  await expect(page).toHaveURL('/admin');
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();

  await page.context().storageState({ path: ADMIN_STORAGE_STATE_PATH });
});
