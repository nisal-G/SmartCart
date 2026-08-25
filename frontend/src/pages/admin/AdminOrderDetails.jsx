import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
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
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            ← Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const { _id, items, total, status, payment, user, createdAt, updatedAt } = order;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Order details</h2>
        <Link
          to={ROUTES.ADMIN_ORDERS}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          ← Back to orders
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* min-w-0: see the identical fix/comment in Cart.jsx — a long
            item name's nowrap intrinsic width can otherwise widen this
            grid track past the viewport on narrow screens. */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Order information</h3>
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Order ID</dt>
                <dd className="mt-0.5 break-all font-mono text-xs font-medium text-slate-900">{_id}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Placed on</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{formatDate(createdAt)}</dd>
              </div>
              {updatedAt && updatedAt !== createdAt && (
                <div>
                  <dt className="text-slate-500">Last updated</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{formatDate(updatedAt)}</dd>
                </div>
              )}
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
              {payment?.paymentId && (
                <div>
                  <dt className="text-slate-500">Payment ID</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs font-medium text-slate-900">
                    {payment.paymentId}
                  </dd>
                </div>
              )}
              {payment?.amount != null && (
                <div>
                  <dt className="text-slate-500">Payment amount</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {formatCurrency(payment.amount, payment.currency)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {user && (user.name || user.email) && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Customer</h3>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                {user.name && (
                  <div>
                    <dt className="text-slate-500">Name</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{user.name}</dd>
                  </div>
                )}
                {user.email && (
                  <div>
                    <dt className="text-slate-500">Email</dt>
                    <dd className="mt-0.5 break-all font-medium text-slate-900">{user.email}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white px-4 sm:px-6">
            <h3 className="pt-6 text-base font-semibold text-slate-900">Items</h3>
            <ul className="divide-y divide-slate-200">
              {items.map((item, index) => (
                <OrderItem key={`${item.product}-${index}`} item={item} />
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h3 className="text-base font-semibold text-slate-900">Total</h3>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2 text-base font-semibold">
              <span className="text-slate-900">Total</span>
              <span className="text-slate-900">{formatCurrency(total)}</span>
            </div>
          </div>

          <form
            onSubmit={handleUpdateStatus}
            className="rounded-lg border border-slate-200 bg-white p-6"
          >
            <h3 className="mb-4 text-base font-semibold text-slate-900">Order status</h3>

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
              <div className="mt-4">
                <SuccessMessage message="Order status updated successfully." />
              </div>
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

            <p className="mt-3 text-xs text-slate-400">
              Payment status is set automatically by PayHere and can&apos;t be changed here.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
