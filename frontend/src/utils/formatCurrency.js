/** Formats a plain number (e.g. product price, cart/order total) as currency. */
export function formatCurrency(amount, currency = 'USD') {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}
