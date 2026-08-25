import { adminTest, customerTest, expect } from '../fixtures.js';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';

customerTest.describe('Session — persistence, logout, storage', () => {
  customerTest('an authenticated session persists across navigation between pages', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('TEST QA Customer')).toBeVisible();
    await page.goto('/products');
    await expect(page.getByText('TEST QA Customer')).toBeVisible();
    await page.goto('/cart');
    await expect(page.getByText('TEST QA Customer')).toBeVisible();
  });

  customerTest('an authenticated session survives a full page refresh', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByText('TEST QA Customer')).toBeVisible();
    await page.reload();
    await expect(page.getByText('TEST QA Customer')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  customerTest('no access/refresh token is ever readable via document.cookie or stored in localStorage', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await expect(page.getByText('TEST QA Customer')).toBeVisible();

    // The httpOnly flag itself (asserted below) is what actually prevents
    // JS from reading these — this double-checks it from the page's own
    // perspective, exactly as a malicious script would try to.
    const jsVisibleCookies = await page.evaluate(() => document.cookie);
    expect(jsVisibleCookies).not.toMatch(/accessToken|refreshToken/);

    const localStorageDump = await page.evaluate(() => ({ ...window.localStorage }));
    expect(JSON.stringify(localStorageDump)).not.toMatch(/accessToken|refreshToken|Bearer /);

    const cookies = await context.cookies();
    const accessCookie = cookies.find((c) => c.name === 'accessToken');
    const refreshCookie = cookies.find((c) => c.name === 'refreshToken');
    expect(accessCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.httpOnly).toBe(true);
  });

  // Must run BEFORE the "logout" test below: every customerTest reuses the
  // same static storageState cookie values (see fixtures.js), and logout
  // permanently consumes/deletes that exact refresh-token record
  // server-side (see tokenService.consumeMatchingRefreshToken) — running
  // after logout would 401 here not because refresh is broken, but because
  // this suite's own logout test already spent that one-time-use token.
  customerTest('the refresh flow (POST /auth/refresh) issues a new working session from the refresh cookie', async ({
    context,
  }) => {
    const res = await context.request.post(`${BACKEND_API_URL}/auth/refresh`);
    expect(res.ok()).toBe(true);

    // The new access cookie must actually work against a protected endpoint.
    const me = await context.request.get(`${BACKEND_API_URL}/auth/me`);
    expect(me.ok()).toBe(true);
    const body = await me.json();
    expect(body.user.email).toBe('test-qa-customer@smartcart.test');
  });

  customerTest('logout works, and protected routes become inaccessible afterward', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();

    await page.goto('/cart');
    await expect(page).toHaveURL(/\/login$/);
  });
});

adminTest.describe('Session — admin', () => {
  adminTest('admin logout also blocks admin routes afterward', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login$/);
  });
});
