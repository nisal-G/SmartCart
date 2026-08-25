// SmartCart charges through PayHere, which defaults to (and in this
// deployment always uses) LKR — see backend/.env.example PAYHERE_CURRENCY
// and backend/src/controllers/paymentController.js's comment "SmartCart's
// intended currency (LKR — PayHere's primary market)". Every price shown to
// a shopper (product price, cart, checkout, order totals) must match what
// they're actually charged, so this is the app-wide default rather than the
// generic Intl.NumberFormat default of USD.
const DEFAULT_CURRENCY = 'LKR';

/** Formats a plain number (e.g. product price, cart/order total) as currency. */
export function formatCurrency(amount, currency = DEFAULT_CURRENCY) {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}
