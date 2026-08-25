import { customerTest, expect } from '../fixtures.js';
import * as db from '../e2e-env/db.cjs';

/**
 * /payment/return and /payment/cancel — the outcome must always come from
 * `order.payment.status` fetched from the backend, never from the URL. Each
 * status is produced by writing directly to the ephemeral order document
 * (db.setOrderPaymentStatus) — standing in for a real PayHere notification,
 * which this environment cannot send for real (see the final report's
 * PayHere section: "frontend state simulation", not "real sandbox").
 */
async function seedOrder(paymentStatus) {
  const product = await db.createProductDirect({ price: 500 });
  return db.createOrderDirect({
    items: [{ product: product._id, name: product.name, price: 500, quantity: 1 }],
    paymentStatus,
  });
}

customerTest.describe('/payment/return', () => {
  customerTest('paid: shows "Payment successful"', async ({ page }) => {
    const order = await seedOrder('paid');
    await page.goto(`/payment/return?orderId=${order._id}`);
    await expect(page.getByRole('heading', { name: 'Payment successful' })).toBeVisible();
    // The status text node itself is lowercase ("paid") — `capitalize` in
    // PaymentStatusPanel is a CSS presentation class only.
    await expect(page.getByText('paid', { exact: true })).toBeVisible();
  });

  customerTest('pending: shows "Payment is being processed" with a working manual refresh control', async ({ page }) => {
    const order = await seedOrder('pending');
    await page.goto(`/payment/return?orderId=${order._id}`);
    await expect(page.getByRole('heading', { name: 'Payment is being processed' })).toBeVisible();

    // A still-pending order is within usePaymentStatus's bounded auto-poll
    // window right away, so the button reads "Checking…" rather than
    // "Check again" for as long as that's true (see PaymentStatusPanel /
    // usePaymentStatus) — assert on the control itself, not a label that's
    // only sometimes accurate, then confirm it actually re-fetches.
    const refreshButton = page.getByRole('button', { name: /Check again|Checking…/ });
    await expect(refreshButton).toBeVisible();

    const refetchPromise = page.waitForResponse(
      (res) => res.url().includes(`/api/orders/${order._id}`) && res.request().method() === 'GET'
    );
    await refreshButton.click();
    await expect((await refetchPromise).ok()).toBe(true);
  });

  customerTest('failed: shows "Payment failed" with a Retry payment link back to checkout', async ({ page }) => {
    const order = await seedOrder('failed');
    await page.goto(`/payment/return?orderId=${order._id}`);
    await expect(page.getByRole('heading', { name: 'Payment failed' })).toBeVisible();
    const retry = page.getByRole('link', { name: 'Retry payment' });
    await expect(retry).toHaveAttribute('href', new RegExp(`retryOrderId=${order._id}`));
  });

  customerTest('cancelled: shows "Payment cancelled" with a Retry payment link', async ({ page }) => {
    const order = await seedOrder('cancelled');
    await page.goto(`/payment/return?orderId=${order._id}`);
    await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Retry payment' })).toBeVisible();
  });

  customerTest('charged_back: shows "Payment charged back", not retryable', async ({ page }) => {
    const order = await seedOrder('charged_back');
    await page.goto(`/payment/return?orderId=${order._id}`);
    await expect(page.getByRole('heading', { name: 'Payment charged back' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Retry payment' })).toHaveCount(0);
  });

  customerTest('missing orderId (no query param, no sessionStorage fallback): honest "couldn\'t identify" message, never a fake success', async ({
    page,
  }) => {
    await page.goto('/payment/return');
    await expect(
      page.getByText("We couldn't identify which order this payment was for. Check your order history instead.")
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /successful/i })).toHaveCount(0);
  });

  customerTest('fetches the real order from the backend rather than trusting anything client-side', async ({ page }) => {
    const order = await seedOrder('paid');
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes(`/api/orders/${order._id}`) && res.request().method() === 'GET'
    );
    await page.goto(`/payment/return?orderId=${order._id}`);
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
  });
});

customerTest.describe('/payment/cancel', () => {
  customerTest('a "cancel" redirect still shows the true backend status, e.g. paid (notification can land before the redirect)', async ({
    page,
  }) => {
    const order = await seedOrder('paid');
    await page.goto(`/payment/cancel?orderId=${order._id}`);
    await expect(page.getByRole('heading', { name: 'Payment successful' })).toBeVisible();
  });

  customerTest('cancelled: shows cancelled state with View Orders and Continue Shopping', async ({ page }) => {
    const order = await seedOrder('cancelled');
    await page.goto(`/payment/cancel?orderId=${order._id}`);
    await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View orders' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue shopping' })).toBeVisible();
  });

  customerTest('View Orders navigates to /orders', async ({ page }) => {
    const order = await seedOrder('cancelled');
    await page.goto(`/payment/cancel?orderId=${order._id}`);
    await page.getByRole('link', { name: 'View orders' }).click();
    await expect(page).toHaveURL(/\/orders$/);
  });

  customerTest('Continue Shopping navigates to /products', async ({ page }) => {
    const order = await seedOrder('cancelled');
    await page.goto(`/payment/cancel?orderId=${order._id}`);
    await page.getByRole('link', { name: 'Continue shopping' }).click();
    await expect(page).toHaveURL(/\/products$/);
  });

  customerTest('Retry payment from the cancel page returns to checkout in retry mode for the same order', async ({
    page,
  }) => {
    const order = await seedOrder('failed');
    await page.goto(`/payment/cancel?orderId=${order._id}`);
    await page.getByRole('link', { name: 'Retry payment' }).click();
    await expect(page).toHaveURL(new RegExp(`/checkout\\?retryOrderId=${order._id}`));
  });
});
