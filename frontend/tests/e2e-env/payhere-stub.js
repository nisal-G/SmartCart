/**
 * Installs a stub `window.payhere` before any page script runs.
 * `loadPayhereScript()` (src/utils/loadPayhereScript.js) short-circuits and
 * returns the existing `window.payhere` without injecting the real
 * `https://www.payhere.lk/lib/payhere.js` script when one is already
 * present — so this test never opens PayHere's real hosted checkout UI
 * (see tests/payment/payhere-script.spec.js for the one test that verifies
 * the real script tag loads, in isolation).
 *
 * `startPayment` just records what Checkout.jsx passed it on
 * `window.__payhereCalls`; the test itself decides the outcome by calling
 * `window.payhere.onCompleted()` / `.onDismissed()` / `.onError(msg)`
 * directly (exactly the callbacks Checkout.jsx assigns) — a legitimate
 * simulation of PayHere's own behavior, never a fake of anything this
 * app's own code does.
 */
export async function stubPayhere(page) {
  await page.addInitScript(() => {
    window.__payhereCalls = [];
    window.payhere = {
      startPayment(payload) {
        window.__payhereCalls.push(payload);
      },
    };
  });
}

export async function getPayhereCalls(page) {
  return page.evaluate(() => window.__payhereCalls || []);
}
