import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Icon } from '../../components/ui/Icon';
import { Loading } from '../../components/common/Loading';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { SuccessMessage } from '../../components/common/SuccessMessage';
import { OrderStatusBadge } from '../../components/common/OrderStatusBadge';
import { OrderItem } from '../../components/common/OrderItem';
import orderService from '../../services/orderService';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { ORDER_STATUSES, formatStatusLabel } from '../../constants/orderStatuses';
import { ROUTES } from '../../constants/routes';

/**
 * Admin order details (/admin/orders/:id) via GET /api/orders/all/:id
 * (orderService.getOrderByIdAdmin — backend orderController.getOrderByIdAdmin),
 * plus the admin-only order-status control (PATCH /api/orders/:id/status —
 * orderController.updateOrderStatus).
 *
 * Only fields the backend actually returns are rendered: the order's own
 * item snapshot (never re-fetched current product data — see OrderItem),
 * and — for the customer — only `name`/`email`, the sole fields
 * `.populate('user', 'name email')` selects. Payment status is display-only
 * here: it is written exclusively by the PayHere notification flow
 * (backend/src/controllers/paymentController.js), never by this page.
 */

/** Small icon chip preceding a section's h3 — purely decorative, keeps
 * every card on this page reading as part of the same system. */
function SectionHeading({ icon, children }) {
  return (
    <h3 className="flex items-center gap-2.5 text-base font-semibold text-slate-900">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-700"
        aria-hidden="true"
      >
        <Icon name={icon} size="sm" />
      </span>
      {children}
    </h3>
  );
}

/** One label/value pair in the order-information grid. */
function Detail({ label, children, mono = false }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={
          mono
            ? 'mt-1 break-all font-mono text-xs font-semibold text-slate-900'
            : 'mt-1 font-semibold text-slate-900'
        }
      >
        {children}
      </dd>
    </div>
  );
}

export function AdminOrderDetails() {
  const { id } = useParams();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedStatus, setSelectedStatus] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextOrder = await orderService.getOrderByIdAdmin(id);
      setOrder(nextOrder);
      setSelectedStatus(nextOrder.status);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Written as an inline promise chain so the setState calls above happen
  // inside a .then callback, not synchronously in the effect body — same
  // convention as OrderDetails.jsx / CartContext / AuthContext.
  useEffect(() => {
    Promise.resolve()
      .then(() => fetchOrder())
      .catch(() => {});
  }, [fetchOrder]);

  async function handleUpdateStatus(event) {
    event.preventDefault();
    if (updating || !order || selectedStatus === order.status) return;

    setUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);
    try {
      await orderService.updateOrderStatus(order._id, selectedStatus);
      // Re-fetch via GET /api/orders/all/:id rather than trusting the PATCH
      // response directly: unlike the GET endpoints, updateOrderStatus's
      // Order.findById() doesn't `.populate('user', ...)` (see backend/src/
      // controllers/orderController.js), so its response's `order.user` is
      // a bare id, not { name, email } — using it as-is would blank out the
      // Customer section after every update.
      const refreshed = await orderService.getOrderByIdAdmin(order._id);
      setOrder(refreshed);
      setSelectedStatus(refreshed.status);
      setUpdateSuccess(true);
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <Loading label="Loading order…" />;
  }

  if (error || !order) {
    return (
      <div>
        <ErrorMessage message={error || 'Order not found.'} onRetry={fetchOrder} />
        <div className="mt-6">
          <Link
            to={ROUTES.ADMIN_ORDERS}
            className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            ← Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const { _id, items, total, status, payment, user, createdAt, updatedAt } = order;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Order details</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatDate(createdAt)} · {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
        <Link
          to={ROUTES.ADMIN_ORDERS}
          className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
        >
          ← Back to orders
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* min-w-0: see the identical fix/comment in Cart.jsx — a long
            item name's nowrap intrinsic width can otherwise widen this
            grid track past the viewport on narrow screens. */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section className="rounded-card border border-slate-200 bg-white p-5 shadow-card sm:p-6">
            <SectionHeading icon="info">Order information</SectionHeading>
            <dl className="mt-4 grid grid-cols-1 gap-5 text-sm sm:grid-cols-2">
              <Detail label="Order ID" mono>
                {_id}
              </Detail>
              <Detail label="Placed on">{formatDate(createdAt)}</Detail>
              {updatedAt && updatedAt !== createdAt && (
                <Detail label="Last updated">{formatDate(updatedAt)}</Detail>
              )}
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
                <Detail label="Payment provider">
                  <span className="capitalize">{payment.provider}</span>
                </Detail>
              )}
              {payment?.method && <Detail label="Payment method">{payment.method}</Detail>}
              {payment?.paymentId && (
                <Detail label="Payment ID" mono>
                  {payment.paymentId}
                </Detail>
              )}
              {payment?.amount != null && (
                <Detail label="Payment amount">
                  {formatCurrency(payment.amount, payment.currency)}
                </Detail>
              )}
            </dl>
          </section>

          {user && (user.name || user.email) && (
            <section className="rounded-card border border-slate-200 bg-white p-5 shadow-card sm:p-6">
              <SectionHeading icon="user">Customer</SectionHeading>
              <dl className="mt-4 grid grid-cols-1 gap-5 text-sm sm:grid-cols-2">
                {user.name && <Detail label="Name">{user.name}</Detail>}
                {user.email && (
                  <Detail label="Email">
                    <span className="break-all">{user.email}</span>
                  </Detail>
                )}
              </dl>
            </section>
          )}

          <section className="rounded-card border border-slate-200 bg-white p-5 shadow-card sm:p-6">
            <SectionHeading icon="package">Items</SectionHeading>
            <ul className="mt-2 divide-y divide-slate-100">
              {items.map((item, index) => (
                <OrderItem key={`${item.product}-${index}`} item={item} />
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card sm:p-6">
            <SectionHeading icon="receipt">Summary</SectionHeading>
            <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-4">
              <span className="text-sm font-semibold text-slate-900">Total</span>
              <span className="text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          <form
            onSubmit={handleUpdateStatus}
            className="rounded-card border border-slate-200 bg-white p-5 shadow-card sm:p-6"
          >
            <SectionHeading icon="clock">Order status</SectionHeading>
            <p className="mb-4 mt-1 text-sm text-slate-500">
              Fulfilment state only — this never changes the payment.
            </p>

            <Select
              label="Status"
              value={selectedStatus}
              disabled={updating}
              onChange={(event) => {
                setSelectedStatus(event.target.value);
                setUpdateSuccess(false);
              }}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatStatusLabel(s)}
                </option>
              ))}
            </Select>

            {updateError && (
              <div className="mt-4">
                <ErrorMessage message={updateError} />
              </div>
            )}
            {updateSuccess && (
              <SuccessMessage message="Order status updated successfully." className="mt-4" />
            )}

            <Button
              type="submit"
              className="mt-4"
              fullWidth
              loading={updating}
              disabled={updating || selectedStatus === status}
            >
              Update status
            </Button>

            <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
              <Icon name="info" size="xs" className="mt-0.5 shrink-0 text-slate-400" />
              Payment status is set automatically by PayHere and can&apos;t be changed here.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
