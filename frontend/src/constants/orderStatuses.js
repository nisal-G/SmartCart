/**
 * Mirrors backend/src/models/Order.js ORDER_STATUSES — fulfillment status
 * only (never payment state; see Order.js's own comment on why the two are
 * kept separate). These are the only values PATCH /api/orders/:id/status
 * accepts (backend/src/validators/orderValidators.js updateOrderStatusValidators),
 * so this is also the only list the admin order-status control may offer.
 */
export const ORDER_STATUSES = ['pending', 'confirmed', 'cancelled'];

/** "charged_back" -> "Charged back". Shared by OrderStatusBadge and the admin order-status control so labels read identically everywhere. */
export function formatStatusLabel(status) {
  const words = String(status).split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
