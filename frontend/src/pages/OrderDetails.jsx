import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { PageHeader } from '../components/ui/PageHeader';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
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
          <Link
            to={ROUTES.ORDERS}
            className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            ← Back to orders
          </Link>
        </div>
      </PageWrapper>
    );
  }

  const { _id, items, total, status, payment, createdAt } = order;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <PageWrapper>
      <PageHeader
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Home', to: ROUTES.HOME },
              { label: 'Orders', to: ROUTES.ORDERS },
              { label: `#${String(_id).slice(-8).toUpperCase()}` },
            ]}
          />
        }
        eyebrow="Order"
        title="Order details"
        description={`Placed ${formatDate(createdAt)} · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
        actions={
          // Statuses are shown once only, in the Order information card
          // below — repeating the badges here would be the same fact twice
          // on one screen.
          <Link
            to={ROUTES.ORDERS}
            className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            ← Back to orders
          </Link>
        }
      />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* min-w-0: see the identical fix/comment in Cart.jsx — a long
            item name's nowrap intrinsic width can otherwise widen this
            grid track past the viewport on narrow screens. */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section className="rounded-panel border border-slate-200/80 bg-white p-6 shadow-card sm:p-7">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Icon name="info" size="sm" className="text-brand-600" />
              Order information
            </h2>
            <dl className="mt-4 grid grid-cols-1 gap-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Order ID</dt>
                <dd className="mt-1 break-all font-mono text-xs font-semibold text-slate-900">
                  {_id}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Placed on</dt>
                <dd className="mt-1 font-semibold text-slate-900">{formatDate(createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Order status</dt>
                <dd className="mt-1.5">
                  <OrderStatusBadge status={status} type="order" />
                </dd>
              </div>
              {payment?.status && (
                <div>
                  <dt className="text-slate-500">Payment status</dt>
                  <dd className="mt-1.5">
                    <OrderStatusBadge status={payment.status} type="payment" />
                  </dd>
                </div>
              )}
              {payment?.provider && (
                <div>
                  <dt className="text-slate-500">Payment provider</dt>
                  <dd className="mt-1 font-semibold capitalize text-slate-900">
                    {payment.provider}
                  </dd>
                </div>
              )}
              {payment?.method && (
                <div>
                  <dt className="text-slate-500">Payment method</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{payment.method}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-panel border border-slate-200/80 bg-white p-6 shadow-card sm:p-7">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Icon name="package" size="sm" className="text-brand-600" />
              Items
            </h2>
            <ul className="mt-2 divide-y divide-slate-100">
              {items.map((item, index) => (
                <OrderItem key={`${item.product}-${index}`} item={item} />
              ))}
            </ul>
          </section>
        </div>

        <div className="lg:col-span-1">
          <div className="overflow-hidden rounded-panel border border-slate-200/80 bg-white shadow-card lg:sticky lg:top-32">
            <div className="border-b border-slate-100 bg-sunken/60 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">Summary</h2>
            </div>
            <div className="px-6 py-6">
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Items</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{itemCount}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-4">
                  <dt className="text-base font-bold text-slate-900">Total</dt>
                  <dd className="text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">
                    {formatCurrency(total)}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-col gap-3">
                <Link to={ROUTES.ORDERS}>
                  <Button variant="outline" fullWidth>
                    View orders
                  </Button>
                </Link>
                <Link to={ROUTES.PRODUCTS}>
                  <Button variant="ghost" fullWidth>
                    Continue shopping
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
