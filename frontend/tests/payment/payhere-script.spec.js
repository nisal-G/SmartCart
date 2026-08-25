import { expect } from '@playwright/test';
import { customerTest } from '../fixtures.js';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';

/**
 * Isolated from checkout.spec.js on purpose: this is the ONE test that lets
 * `loadPayhereScript()` actually inject and load the real
 * https://www.payhere.lk/lib/payhere.js — verifying "the PayHere script
 * loads correctly" (real network, real third-party CDN, no data sent to
 * it — a script GET carries no order/customer/merchant info). Every other
 * checkout/payment test stubs `window.payhere` beforehand so it never
 * re-triggers this real request (see tests/e2e-env/payhere-stub.js).
 */
customerTest.describe('PayHere script load (real network, no stub)', () => {
  customerTest('the real PayHere checkout script loads successfully when Proceed to payment is clicked', async ({
    page,
    context,
  }) => {
    await context.request.delete(`${BACKEND_API_URL}/cart`);
    const products = await context.request
      .get(`${BACKEND_API_URL}/products?search=TEST QA Tomato`)
      .then((r) => r.json());
    await context.request.post(`${BACKEND_API_URL}/cart/items`, {
      data: { productId: products.products[0]._id, quantity: 1 },
    });

    const scriptResponsePromise = page.waitForResponse('https://www.payhere.lk/lib/payhere.js');

    await page.goto('/checkout');
    await page.getByLabel('Phone').fill('0771234567');
    await page.getByLabel('City').fill('Colombo');
    await page.getByLabel('Address').fill('123 Test Lane');
    await page.getByLabel('Country').fill('Sri Lanka');
    await page.getByRole('button', { name: 'Proceed to payment' }).click();

    const scriptResponse = await scriptResponsePromise;
    expect(scriptResponse.ok()).toBe(true);

    // The real SDK attaches a real, richer `window.payhere` (a real
    // `startPayment` function, not our stub) — confirms the script
    // actually executed, not just that the network request succeeded.
    const hasRealSdk = await page.evaluate(() => typeof window.payhere?.startPayment === 'function');
    expect(hasRealSdk).toBe(true);
  });
});
