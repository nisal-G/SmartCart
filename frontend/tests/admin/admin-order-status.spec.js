import { adminTest, expect } from '../fixtures.js';
import * as db from '../e2e-env/db.cjs';

async function seedOrder(status = 'pending') {
  const product = await db.createProductDirect({ price: 60 });
  return db.createOrderDirect({
    items: [{ product: product._id, name: product.name, price: 60, quantity: 1 }],
    status,
  });
}

adminTest.describe('Admin order details — status update', () => {
  adminTest('shows order id, customer, items, quantity, historical price, total, order status, payment status', async ({
    page,
  }) => {
    const product = await db.createProductDirect({ price: 45 });
    const order = await db.createOrderDirect({
      items: [{ product: product._id, name: product.name, price: 45, quantity: 4 }],
      paymentStatus: 'paid',
    });

    await page.goto(`/admin/orders/${order._id}`);
    // exact: true — the payment id ("TESTQA-<orderId>") otherwise
    // substring-matches the bare order id too.
    await expect(page.getByText(String(order._id), { exact: true })).toBeVisible();
    await expect(page.getByText('TEST QA Customer')).toBeVisible();
    await expect(page.getByText('test-qa-customer@smartcart.test')).toBeVisible();
    await expect(page.getByText(product.name)).toBeVisible();
    await expect(page.getByText('LKR 45.00 × 4')).toBeVisible();
    await expect(page.getByText('LKR 180.00', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Paid', { exact: true })).toBeVisible();
  });

  adminTest('the status selector only offers pending/confirmed/cancelled', async ({ page }) => {
    const order = await seedOrder('pending');
    await page.goto(`/admin/orders/${order._id}`);
    // allTextContents() is a one-shot query, not an auto-waiting
    // assertion — wait for the (async-loaded) select to actually be
    // present first, or this reads options off the still-showing
    // "Loading order…" screen and returns an empty array.
    const statusSelect = page.getByLabel('Status');
    await expect(statusSelect).toBeVisible();
    const options = await statusSelect.locator('option').allTextContents();
    expect(options.sort()).toEqual(['Cancelled', 'Confirmed', 'Pending'].sort());
  });

  adminTest('pending -> confirmed: updates, shows success, and refetches (customer info does not disappear)', async ({
    page,
  }) => {
    const order = await seedOrder('pending');
    await page.goto(`/admin/orders/${order._id}`);

    const updateButton = page.getByRole('button', { name: 'Update status' });
    await expect(updateButton).toBeDisabled(); // no change selected yet

    await page.getByLabel('Status').selectOption({ label: 'Confirmed' });
    await expect(updateButton).toBeEnabled();

    const patchPromise = page.waitForResponse(
      (res) => res.url().endsWith(`/api/orders/${order._id}/status`) && res.request().method() === 'PATCH'
    );
    // The page deliberately re-fetches via GET /orders/all/:id after the
    // PATCH (see AdminOrderDetails.jsx's comment) because the PATCH
    // response's order.user is an unpopulated ObjectId, not {name,email} —
    // confirm that refetch actually happens.
    const refetchPromise = page.waitForResponse(
      (res) => res.url().endsWith(`/api/orders/all/${order._id}`) && res.request().method() === 'GET'
    );
    await updateButton.click();
    await patchPromise;
    await refetchPromise;

    await expect(page.getByText('Order status updated successfully.')).toBeVisible();
    await expect(page.getByText('Confirmed', { exact: true }).first()).toBeVisible();

    // Regression guard: the Customer card must still show name/email after
    // the update — this is exactly the bug the refetch exists to prevent.
    await expect(page.getByRole('heading', { name: 'Customer' })).toBeVisible();
    await expect(page.getByText('TEST QA Customer')).toBeVisible();
    await expect(page.getByText('test-qa-customer@smartcart.test')).toBeVisible();
  });

  adminTest('confirmed -> pending is also a valid transition', async ({ page }) => {
    const order = await seedOrder('confirmed');
    await page.goto(`/admin/orders/${order._id}`);
    await page.getByLabel('Status').selectOption({ label: 'Pending' });
    await page.getByRole('button', { name: 'Update status' }).click();
    await expect(page.getByText('Order status updated successfully.')).toBeVisible();
  });

  adminTest('pending -> cancelled is a valid transition', async ({ page }) => {
    const order = await seedOrder('pending');
    await page.goto(`/admin/orders/${order._id}`);
    await page.getByLabel('Status').selectOption({ label: 'Cancelled' });
    await page.getByRole('button', { name: 'Update status' }).click();
    await expect(page.getByText('Order status updated successfully.')).toBeVisible();
  });

  adminTest('update button stays disabled while no change is selected, and disables itself while the request is in flight', async ({
    page,
  }) => {
    const order = await seedOrder('pending');
    await page.goto(`/admin/orders/${order._id}`);
    const updateButton = page.getByRole('button', { name: 'Update status' });
    await expect(updateButton).toBeDisabled();

    await page.getByLabel('Status').selectOption({ label: 'Confirmed' });
    await expect(updateButton).toBeEnabled();
    await updateButton.click();
    // While in flight the button's own label switches to a disabled state
    // (Button's `loading` prop) — same double-submit guard pattern used
    // throughout the admin forms.
    await expect(page.getByRole('button', { name: 'Update status' })).toBeDisabled();
  });

  adminTest('updating order status never changes payment status', async ({ page }) => {
    const order = await seedOrder('pending');
    await db.setOrderPaymentStatus(order._id, 'paid');

    await page.goto(`/admin/orders/${order._id}`);
    await expect(page.getByText('Paid', { exact: true })).toBeVisible();

    await page.getByLabel('Status').selectOption({ label: 'Confirmed' });
    await page.getByRole('button', { name: 'Update status' }).click();
    await expect(page.getByText('Order status updated successfully.')).toBeVisible();

    await expect(page.getByText('Paid', { exact: true })).toBeVisible();
    await expect(page.getByText("Payment status is set automatically by PayHere and can't be changed here.")).toBeVisible();
  });

  adminTest('a nonexistent order id shows "Order not found." rather than crashing', async ({ page }) => {
    await page.goto('/admin/orders/507f1f77bcf86cd799439011');
    await expect(page.getByText(/Order not found/)).toBeVisible();
    await expect(page.getByRole('link', { name: '← Back to orders' })).toBeVisible();
  });
});
