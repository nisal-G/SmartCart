const LAST_ORDER_ID_KEY = 'smartcart:lastPayhereOrderId';

/**
 * Remembers which order a PayHere checkout was just started for.
 *
 * PayHere's return_url/cancel_url (see backend/.env.example) are static —
 * the backend does not template an order id into them — so if PayHere ever
 * does a full browser redirect back to those URLs (rather than firing the
 * JS SDK's onCompleted/onDismissed callbacks, which do carry the order id),
 * the landing page has nothing in the URL to identify the order from.
 * sessionStorage is the fallback for that case only.
 *
 * This is NEVER used to determine payment success/failure — only to know
 * which order to ask the backend about. The backend's `order.payment.status`
 * remains the sole source of truth for the result.
 */
export function rememberLastOrderId(orderId) {
  try {
    sessionStorage.setItem(LAST_ORDER_ID_KEY, orderId);
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — the JS SDK
    // callbacks, which pass the order id directly, remain the primary path.
  }
}

/** Reads and clears the remembered order id — one-shot, so a stale value
 * from a previous checkout never leaks into an unrelated later visit. */
export function consumeLastOrderId() {
  try {
    const value = sessionStorage.getItem(LAST_ORDER_ID_KEY);
    sessionStorage.removeItem(LAST_ORDER_ID_KEY);
    return value || null;
  } catch {
    return null;
  }
}
