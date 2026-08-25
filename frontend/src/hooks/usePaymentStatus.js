import { useCallback, useEffect, useState } from 'react';
import orderService from '../services/orderService';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 6; // ~18s bounded — see note below

/**
 * Fetches the authoritative order for a post-payment page (`/payment/return`
 * or `/payment/cancel`) via GET /api/orders/:id — the same endpoint
 * Orders/Checkout already use — and never infers success/failure itself.
 * Callers read `order.payment.status` directly.
 *
 * PayHere's server-to-server notify_url call can arrive slightly after the
 * browser is redirected back, so while `payment.status` is still `pending`
 * this polls a few more times on a short, bounded schedule and then stops —
 * never indefinitely — leaving a manual refresh available after that.
 */
export function usePaymentStatus(orderId) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState(0);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    try {
      const nextOrder = await orderService.getOrderById(orderId);
      setOrder(nextOrder);
      setError(null);
      return nextOrder;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Initial fetch whenever the order id we're looking at changes. Written
  // as an inline promise chain (rather than calling fetchOrder directly)
  // so every setState call is a literal callback passed to .then/.catch,
  // not a synchronous call in the effect body itself — same convention as
  // CartContext/AuthContext.
  useEffect(() => {
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (!ignore) {
          setOrder(null);
          setError(null);
          setAttempts(0);
        }
        return fetchOrder();
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [orderId, fetchOrder]);

  // Derived, not stored separately: whether we're still within the bounded
  // polling budget depends only on the latest order + attempt count.
  const polling = Boolean(order) && order.payment.status === 'pending' && attempts < MAX_POLL_ATTEMPTS;

  // Bounded polling while payment is pending — only ever schedules a timer
  // here; the setState calls happen inside the timer callback, not
  // synchronously in the effect body.
  useEffect(() => {
    if (!polling) return undefined;
    const timer = setTimeout(() => {
      setAttempts((count) => count + 1);
      fetchOrder().catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [polling, fetchOrder]);

  // Manual "check again" — resets the attempt count so the user can
  // restart polling after it stops.
  const refresh = useCallback(() => {
    setAttempts(0);
    return fetchOrder().catch(() => {});
  }, [fetchOrder]);

  return { order, loading, error, polling, refresh };
}
