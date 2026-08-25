import { test as base, expect } from '@playwright/test';
import { customerTest } from '../fixtures.js';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';
import { stubPayhere, getPayhereCalls } from '../e2e-env/payhere-stub.js';

const test = base;

async function resetCart(context) {
  await context.request.delete(`${BACKEND_API_URL}/cart`);
}

async function addTomatoToCart(context, quantity = 2) {
  // TEST QA Tomato — price 120 (see tests/e2e-env/global-setup.cjs).
  const products = await context.request
    .get(`${BACKEND_API_URL}/products?search=TEST QA Tomato`)
    .then((r) => r.json());
  const product = products.products[0];
  await context.request.post(`${BACKEND_API_URL}/cart/items`, {
    data: { productId: product._id, quantity },
  });
  return product;
}

test.describe('Checkout — protected route / empty cart', () => {
  test('checkout is protected: logged-out visitor is redirected to /login', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/login$/);
  });
});

customerTest.describe('Checkout (authenticated)', () => {
  customerTest('an empty cart cannot proceed to checkout', async ({ page, context }) => {
    await resetCart(context);
    await page.goto('/checkout');
    await expect(page.getByText('Your cart is empty')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Proceed to payment' })).toHaveCount(0);
  });

  customerTest('required customer fields are validated before submission', async ({ page, context }) => {
    await resetCart(context);
    await addTomatoToCart(context);
    await stubPayhere(page);
    await page.goto('/checkout');

    await page.getByRole('button', { name: 'Proceed to payment' }).click();

    await expect(page.getByText('Phone number is required')).toBeVisible();
    await expect(page.getByText('Address is required')).toBeVisible();
    await expect(page.getByText('City is required')).toBeVisible();
    await expect(page.getByText('Country is required')).toBeVisible();

    // Invalid submission must never create an order or touch PayHere.
    expect(await getPayhereCalls(page)).toEqual([]);
  });

  async function fillValidCustomerDetails(page) {
    await page.getByLabel('Phone').fill('0771234567');
    await page.getByLabel('City').fill('Colombo');
    await page.getByLabel('Address').fill('123 Test Lane');
    await page.getByLabel('Country').fill('Sri Lanka');
  }

  customerTest(
    'valid checkout creates exactly one order, requests a PayHere session, and launches PayHere with the right amount',
    async ({ page, context }) => {
      await resetCart(context);
      const product = await addTomatoToCart(context, 2); // 2 x 120 = 240
      await stubPayhere(page);
      await page.goto('/checkout');
      await fillValidCustomerDetails(page);

      const orderRequests = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && req.url().endsWith('/api/orders')) orderRequests.push(req);
      });
      const sessionResponsePromise = page.waitForResponse(
        (res) => res.url().endsWith('/api/payments/payhere/session') && res.request().method() === 'POST'
      );

      await page.getByRole('button', { name: 'Proceed to payment' }).click();
      const sessionResponse = await sessionResponsePromise;
      expect(sessionResponse.ok()).toBe(true);

      const calls = await getPayhereCalls(page);
      expect(calls).toHaveLength(1);
      expect(calls[0].amount).toBe('240.00');
      expect(calls[0].currency).toBe('LKR');
      expect(calls[0].order_id).toMatch(/^[a-f0-9]{24}$/);
      // The server-generated hash must be present but this frontend must
      // never itself compute one, and the Merchant Secret must never
      // appear in what the browser received.
      expect(calls[0].hash).toBeTruthy();
      const sessionBody = await sessionResponse.json();
      expect(JSON.stringify(sessionBody)).not.toContain('test-merchant-secret-not-real');

      expect(orderRequests).toHaveLength(1);
      void product;
    }
  );

  customerTest('Proceed to payment disables itself and shows "Processing…" while the request is in flight, creating only one order', async ({
    page,
    context,
  }) => {
    await resetCart(context);
    await addTomatoToCart(context, 1);
    await stubPayhere(page);
    await page.goto('/checkout');
    await fillValidCustomerDetails(page);

    let orderRequestCount = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().endsWith('/api/orders')) orderRequestCount += 1;
    });

    const button = page.getByRole('button', { name: 'Proceed to payment' });
    await button.click();

    // The button becomes disabled (and its label changes) as soon as
    // isProcessingPayment flips true — this is what actually stops a
    // browser from delivering a second click while the request is in
    // flight (a disabled element never receives click events at all).
    await expect(page.getByRole('button', { name: 'Processing…' })).toBeDisabled();

    await expect.poll(async () => (await getPayhereCalls(page)).length).toBe(1);
    expect(orderRequestCount).toBe(1);
  });

  customerTest('PayHere onCompleted navigates to /payment/return with the order id', async ({ page, context }) => {
    await resetCart(context);
    await addTomatoToCart(context, 1);
    await stubPayhere(page);
    await page.goto('/checkout');
    await fillValidCustomerDetails(page);
    await page.getByRole('button', { name: 'Proceed to payment' }).click();
    await expect.poll(async () => (await getPayhereCalls(page)).length).toBe(1);

    await page.evaluate(() => window.payhere.onCompleted());
    await expect(page).toHaveURL(/\/payment\/return\?orderId=[a-f0-9]{24}/);
  });

  customerTest('PayHere onDismissed navigates to /payment/cancel with the order id', async ({ page, context }) => {
    await resetCart(context);
    await addTomatoToCart(context, 1);
    await stubPayhere(page);
    await page.goto('/checkout');
    await fillValidCustomerDetails(page);
    await page.getByRole('button', { name: 'Proceed to payment' }).click();
    await expect.poll(async () => (await getPayhereCalls(page)).length).toBe(1);

    await page.evaluate(() => window.payhere.onDismissed());
    await expect(page).toHaveURL(/\/payment\/cancel\?orderId=[a-f0-9]{24}/);
  });

  customerTest('PayHere onError shows a Retry payment button that reuses the same order (no duplicate order)', async ({
    page,
    context,
  }) => {
    await resetCart(context);
    await addTomatoToCart(context, 1);
    await stubPayhere(page);
    await page.goto('/checkout');
    await fillValidCustomerDetails(page);

    let orderRequestCount = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().endsWith('/api/orders')) orderRequestCount += 1;
    });

    await page.getByRole('button', { name: 'Proceed to payment' }).click();
    await expect.poll(async () => (await getPayhereCalls(page)).length).toBe(1);

    await page.evaluate(() => window.payhere.onError('Simulated PayHere error'));
    await expect(page.getByText('Simulated PayHere error')).toBeVisible();
    const retryButton = page.getByRole('button', { name: 'Retry payment' });
    await expect(retryButton).toBeVisible();

    await retryButton.click();
    await expect.poll(async () => (await getPayhereCalls(page)).length).toBe(2);
    expect(orderRequestCount).toBe(1); // still only the original order
  });
});
