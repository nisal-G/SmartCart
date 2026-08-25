import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { OrderStatusBadge } from '../components/common/OrderStatusBadge';
import { OrderItem } from '../components/common/OrderItem';
import orderService from '../services/orderService';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate } from '../utils/formatDate';
import { ROUTES } from '../constants/routes';

/**
 * Single order (/orders/:id) via GET /api/orders/:id (orderService.getOrderById)
 * — scoped to the authenticated user server-side (orderController.getOrderById),
 * so a 404 here means either the order doesn't exist or it isn't the
 * current user's; either way this just renders it as "not found" rather
 * than trying to distinguish the two client-side.
 *
 * Every price/name/quantity below comes straight from the order's own
 * snapshot (order.items[]) — never re-fetched from the current Product —
 * so this remains an accurate historical record even if a product's price
 * or name has since changed.
 */
export function OrderDetails() {
  const { id } = useParams();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextOrder = await orderService.getOrderById(id);
      setOrder(nextOrder);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Written as an inline promise chain so the setState calls above happen
  // inside a .then callback, not synchronously in the effect body — same
  // convention as Orders.jsx / CartContext / AuthContext.
  useEffect(() => {
    Promise.resolve()
      .then(() => fetchOrder())
      .catch(() => {});
  }, [fetchOrder]);

  if (loading) {
    return (
      <PageWrapper>
        <Loading label="Loading order…" />
      </PageWrapper>
    );
  }

  if (error || !order) {
    return (
      <PageWrapper>
        <ErrorMessage message={error || 'Order not found.'} onRetry={fetchOrder} />
        <div className="mt-6 text-center">
          <Link to={ROUTES.ORDERS} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            ← Back to orders
          </Link>
        </div>
      </PageWrapper>
    );
  }

  const { _id, items, total, status, payment, createdAt } = order;

  return (
    <PageWrapper>
      <Link
        to={ROUTES.ORDERS}
        className="mb-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        ← Back to orders
      </Link>

      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Order details</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* min-w-0: see the identical fix/comment in Cart.jsx — a long
            item name's nowrap intrinsic width can otherwise widen this
            grid track past the viewport on narrow screens. */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Order information</h2>
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Order ID</dt>
                <dd className="mt-0.5 break-all font-mono text-xs font-medium text-slate-900">{_id}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Placed on</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{formatDate(createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Order status</dt>
                <dd className="mt-1">
                  <OrderStatusBadge status={status} type="order" />
                </dd>
              </div>
              {payment?.status && (
                <div>
                  <dt className="text-slate-500">Payment status</dt>
                  <dd className="mt-1">
                    <OrderStatusBadge status={payment.status} type="payment" />
                  </dd>
                </div>
              )}
              {payment?.provider && (
                <div>
                  <dt className="text-slate-500">Payment provider</dt>
                  <dd className="mt-0.5 font-medium capitalize text-slate-900">{payment.provider}</dd>
                </div>
              )}
              {payment?.method && (
                <div>
                  <dt className="text-slate-500">Payment method</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{payment.method}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-4 sm:px-6">
            <h2 className="pt-6 text-lg font-semibold text-slate-900">Items</h2>
            <ul className="divide-y divide-slate-200">
              {items.map((item, index) => (
                <OrderItem key={`${item.product}-${index}`} item={item} />
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Total</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-base font-semibold">
                <dt className="text-slate-900">Total</dt>
                <dd className="text-slate-900">{formatCurrency(total)}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-3">
              <Link to={ROUTES.ORDERS}>
                <Button variant="outline" fullWidth>
                  View orders
                </Button>
              </Link>
              <Link to={ROUTES.PRODUCTS}>
                <Button variant="secondary" fullWidth>
                  Continue shopping
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
