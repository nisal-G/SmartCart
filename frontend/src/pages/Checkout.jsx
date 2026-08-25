import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { useCart } from '../hooks/useCart';
import orderService from '../services/orderService';
import { formatCurrency } from '../utils/formatCurrency';
import { ROUTES } from '../constants/routes';

/**
 * Checkout + order summary (SRS §3.4: "show order summary before payment" —
 * the payment gateway itself is explicit future scope and is NOT built
 * here).
 *
 * Reads the cart straight from CartContext — no second copy of cart state,
 * no duplicate fetch. Placing an order calls orderService.checkout(), which
 * mirrors POST /api/orders exactly as implemented in
 * backend/src/controllers/orderController.js: that endpoint takes NO
 * request body at all. The backend re-reads the authenticated user's cart
 * itself, re-prices every line from live Product data (the client's cart
 * total is never trusted), creates the Order, and atomically clears the
 * cart in the same transaction. So this page never sends items/total/user —
 * there is nothing for it to send.
 */
export function Checkout() {
  const { cart, itemCount, loading, error, loadCart } = useCart();
  const navigate = useNavigate();

  // Local UI state only: which order was just placed (if any), whether a
  // request is currently in flight, and the last order-creation error.
  const [order, setOrder] = useState(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState(null);

  async function handlePlaceOrder() {
    if (isPlacingOrder) return; // belt-and-suspenders against double submits
    setIsPlacingOrder(true);
    setOrderError(null);
    try {
      const placedOrder = await orderService.checkout();
      setOrder(placedOrder);
      // The backend already cleared the cart as part of the same
      // transaction that created this order. Pull that into CartContext so
      // the Navbar badge (and anything else reading cart state) reflects
      // it immediately, instead of only finding out on next navigation.
      loadCart();
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setIsPlacingOrder(false);
    }
  }

  // --- Order placed: confirmation screen ---------------------------------
  if (order) {
    return (
      <PageWrapper>
        <div className="mx-auto max-w-lg">
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center sm:p-8">
            <h1 className="text-2xl font-semibold text-slate-900">Order placed</h1>
            <p className="mt-2 text-sm text-slate-500">
              Thanks for your order — we&apos;ve received it.
            </p>

            <dl className="mt-6 space-y-2 rounded-md border border-slate-100 bg-slate-50 p-4 text-left text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Order ID</dt>
                <dd className="truncate font-mono text-xs font-medium text-slate-900">{order._id}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium capitalize text-slate-900">{order.status}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                <dt className="text-slate-900">Total</dt>
                <dd className="text-slate-900">{formatCurrency(order.total)}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button fullWidth onClick={() => navigate(ROUTES.ORDERS)}>
                View orders
              </Button>
              <Button variant="outline" fullWidth onClick={() => navigate(ROUTES.PRODUCTS)}>
                Continue shopping
              </Button>
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // --- Cart loading/error (mirrors Cart.jsx) ------------------------------
  if (loading) {
    return (
      <PageWrapper>
        <Loading label="Loading your cart…" />
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
        <ErrorMessage message={error} onRetry={loadCart} />
      </PageWrapper>
    );
  }

  // --- Empty cart: no Place Order button, nothing to submit ---------------
  if (cart.items.length === 0) {
    return (
      <PageWrapper>
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Checkout</h1>
        <EmptyState
          title="Your cart is empty"
          description="Add products to your cart before proceeding to checkout."
          action={
            <Link to={ROUTES.PRODUCTS}>
              <Button>Continue shopping</Button>
            </Link>
          }
        />
      </PageWrapper>
    );
  }

  // --- Review + place order ------------------------------------------------
  return (
    <PageWrapper>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Order summary</h2>

          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white px-4 sm:px-6">
            {cart.items.map((item) => (
              <li key={item.product.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-slate-100">
                  {item.product.image ? (
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      No image
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{item.product.name}</p>
                  <p className="text-sm text-slate-500">
                    {formatCurrency(item.product.price)} × {item.quantity}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-900">
                  {formatCurrency(item.subtotal)}
                </span>
              </li>
            ))}
          </ul>

          <Link
            to={ROUTES.CART}
            className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            ← Edit cart
          </Link>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Total</h2>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Items</dt>
                <dd className="font-medium text-slate-900">{itemCount}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-base font-semibold">
                <dt className="text-slate-900">Total</dt>
                <dd className="text-slate-900">{formatCurrency(cart.total)}</dd>
              </div>
            </dl>

            {orderError && (
              <div className="mt-4">
                <ErrorMessage message={orderError} onRetry={handlePlaceOrder} />
              </div>
            )}

            <Button
              fullWidth
              className="mt-6"
              onClick={handlePlaceOrder}
              loading={isPlacingOrder}
              disabled={isPlacingOrder}
            >
              {isPlacingOrder ? 'Placing order…' : 'Place order'}
            </Button>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
