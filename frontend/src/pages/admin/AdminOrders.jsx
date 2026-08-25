import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/common/Loading';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';
import { OrderStatusBadge } from '../../components/common/OrderStatusBadge';
import orderService from '../../services/orderService';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { ORDER_STATUSES, formatStatusLabel } from '../../constants/orderStatuses';
import { adminOrderDetailsPath } from '../../constants/routes';

const PAGE_SIZE = 10;

/** Last-8-characters, uppercased — same short id convention as the customer-facing OrderCard. */
function shortOrderId(id) {
  return `#${String(id).slice(-8).toUpperCase()}`;
}

/**
 * Admin order list (/admin/orders). Uses GET /api/orders/all's own
 * server-side pagination and status filter (see
 * backend/src/validators/orderValidators.js listOrdersValidators /
 * orderController.getAllOrders) — the backend has no search-by-customer or
 * date-range filter, so none is offered here.
 */
export function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page'), 10) || 1;
  const status = searchParams.get('status') || '';

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(() => {
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (ignore) return undefined;
        setLoading(true);
        setError(null);
        return orderService.getAllOrders({
          page,
          limit: PAGE_SIZE,
          status: status || undefined,
        });
      })
      .then((data) => {
        if (ignore || !data) return;
        setOrders(data.orders);
        setPagination(data.pagination);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [page, status]);

  useEffect(() => fetchOrders(), [fetchOrders]);

  function handleStatusChange(event) {
    const next = new URLSearchParams();
    if (event.target.value) next.set('status', event.target.value);
    setSearchParams(next);
  }

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  }

  const hasFilters = Boolean(status);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Orders</h2>
      </div>

      <div className="mb-6 max-w-xs rounded-lg border border-slate-200 bg-white p-4">
        <Select label="Order status" value={status} onChange={handleStatusChange}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatStatusLabel(s)}
            </option>
          ))}
        </Select>
      </div>

      {loading && <Loading label="Loading orders…" />}

      {!loading && error && <ErrorMessage message={error} onRetry={fetchOrders} />}

      {!loading && !error && orders.length === 0 && (
        <EmptyState
          title="No orders found"
          description={
            hasFilters
              ? 'No orders match this filter.'
              : 'Orders will show up here once customers start checking out.'
          }
        />
      )}

      {!loading && !error && orders.length > 0 && (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Order status</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <OrderRow key={order._id} order={order} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {orders.map((order) => (
              <OrderRowCard key={order._id} order={order} />
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => goToPage(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => goToPage(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OrderRow({ order }) {
  const { _id, user, items, total, status, payment, createdAt } = order;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <tr>
      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900" title={_id}>
        {shortOrderId(_id)}
      </td>
      <td className="px-4 py-3 text-slate-700">
        {user?.name || user?.email || '—'}
        {user?.name && user?.email && <p className="text-xs text-slate-400">{user.email}</p>}
      </td>
      <td className="px-4 py-3 text-slate-500">{formatDate(createdAt)}</td>
      <td className="px-4 py-3 text-slate-700">{itemCount}</td>
      <td className="px-4 py-3 text-slate-700">{formatCurrency(total)}</td>
      <td className="px-4 py-3">
        <OrderStatusBadge status={status} type="order" />
      </td>
      <td className="px-4 py-3">
        {payment?.status && <OrderStatusBadge status={payment.status} type="payment" />}
      </td>
      <td className="px-4 py-3 text-right">
        <Link to={adminOrderDetailsPath(_id)}>
          <Button variant="outline" size="sm">
            View details
          </Button>
        </Link>
      </td>
    </tr>
  );
}

function OrderRowCard({ order }) {
  const { _id, user, items, total, status, payment, createdAt } = order;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium text-slate-900" title={_id}>
            {shortOrderId(_id)}
          </p>
          <p className="text-xs text-slate-500">{formatDate(createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <OrderStatusBadge status={status} type="order" />
          {payment?.status && <OrderStatusBadge status={payment.status} type="payment" />}
        </div>
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        {(user?.name || user?.email) && (
          <div className="flex items-center gap-1.5">
            <dt className="text-slate-500">Customer</dt>
            <dd className="truncate font-medium text-slate-900">{user.name || user.email}</dd>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <dt className="text-slate-500">Items</dt>
          <dd className="font-medium text-slate-900">{itemCount}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-slate-500">Total</dt>
          <dd className="font-medium text-slate-900">{formatCurrency(total)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex justify-end">
        <Link to={adminOrderDetailsPath(_id)}>
          <Button variant="outline" size="sm">
            View details
          </Button>
        </Link>
      </div>
    </div>
  );
}
