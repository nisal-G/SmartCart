import { test as base, expect } from '@playwright/test';
import {
  ADMIN_STORAGE_STATE_PATH,
  CUSTOMER_STORAGE_STATE_PATH,
  CUSTOMER2_STORAGE_STATE_PATH,
} from './e2e-env/constants.cjs';

/**
 * Two pre-authenticated `test` variants, Playwright's documented pattern
 * for "multiple signed-in roles" (https://playwright.dev/docs/auth#multiple-signed-in-roles).
 *
 * - `adminTest`: TEST QA Admin, signed in via the real /login UI form
 *   (tests/auth.setup.js) — a genuine password-based session.
 * - `customerTest`: TEST QA Customer, whose cookies were minted directly by
 *   tests/e2e-env/global-setup.cjs via the backend's own real
 *   tokenService/issueSession code path (no customer login flow exists to
 *   automate — see that file's comment for the full rationale).
 *
 * Anything that must work logged OUT should just use the plain `test` from
 * '@playwright/test' directly (no storageState).
 */
export const adminTest = base.extend({
  storageState: ADMIN_STORAGE_STATE_PATH,
});

export const customerTest = base.extend({
  storageState: CUSTOMER_STORAGE_STATE_PATH,
});

// A second, deliberately-untouched customer — see constants.cjs. Use only
// for tests that need a guaranteed-empty account.
export const customer2Test = base.extend({
  storageState: CUSTOMER2_STORAGE_STATE_PATH,
});

export { expect };
