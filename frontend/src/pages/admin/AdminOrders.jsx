import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Icon } from '../../components/ui/Icon';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';
import { OrderStatusBadge } from '../../components/common/OrderStatusBadge';
import { TableSkeleton } from '../../components/common/skeletons';
import { Pagination } from '../../components/common/Pagination';
import { AdminCard, AdminCardList, AdminTable, Td, Th, Tr } from '../../components/admin/AdminTable';
import orderService from '../../services/orderService';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { shortOrderId } from '../../utils/orderId';
import { ORDER_STATUSES, formatStatusLabel } from '../../constants/orderStatuses';
import { adminOrderDetailsPath } from '../../constants/routes';

const PAGE_SIZE = 10;

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
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900">Orders</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {pagination?.total != null
            ? `${pagination.total} order${pagination.total === 1 ? '' : 's'}${hasFilters ? ' matching this filter' : ''}`
            : 'Customer orders and their payment state'}
        </p>
      </div>

      <div className="mb-6 rounded-card border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <div className="mb-4 flex items-center gap-2.5 text-sm font-semibold text-slate-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-control bg-slate-100 text-slate-500">
            <Icon name="filter" size="sm" />
          </span>
          Filters
        </div>
        <div className="max-w-xs">
          <Select label="Order status" value={status} onChange={handleStatusChange}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading && <TableSkeleton rows={PAGE_SIZE} columns={6} />}

      {!loading && error && <ErrorMessage message={error} onRetry={fetchOrders} />}

      {!loading && !error && orders.length === 0 && (
        <EmptyState
          icon="receipt"
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
          <AdminTable
            head={
              <>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Date</Th>
                <Th>Items</Th>
                <Th>Total</Th>
                <Th>Order status</Th>
                <Th>Payment</Th>
                <Th align="right">Actions</Th>
              </>
            }
          >
            {orders.map((order) => (
              <OrderRow key={order._id} order={order} />
            ))}
          </AdminTable>

          {/* Mobile cards */}
          <AdminCardList>
            {orders.map((order) => (
              <OrderRowCard key={order._id} order={order} />
            ))}
          </AdminCardList>

          <Pagination pagination={pagination} onPageChange={goToPage} className="mt-6" />
        </>
      )}
    </div>
  );
}

function OrderRow({ order }) {
  const { _id, user, items, total, status, payment, createdAt } = order;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Tr>
      <Td className="font-mono text-xs font-semibold text-slate-900" title={_id}>
        {shortOrderId(_id)}
      </Td>
      <Td className="text-slate-700">
        <span className="font-medium">{user?.name || user?.email || '—'}</span>
        {user?.name && user?.email && <p className="text-xs text-slate-400">{user.email}</p>}
      </Td>
      <Td className="whitespace-nowrap text-slate-500">{formatDate(createdAt)}</Td>
      <Td className="tabular-nums text-slate-700">{itemCount}</Td>
      <Td className="font-medium tabular-nums text-slate-900">{formatCurrency(total)}</Td>
      <Td>
        <OrderStatusBadge status={status} type="order" />
      </Td>
      <Td>{payment?.status && <OrderStatusBadge status={payment.status} type="payment" />}</Td>
      <Td align="right">
        <Link to={adminOrderDetailsPath(_id)}>
          <Button variant="outline" size="sm">
            View details
          </Button>
        </Link>
      </Td>
    </Tr>
  );
}

function OrderRowCard({ order }) {
  const { _id, user, items, total, status, payment, createdAt } = order;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AdminCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-slate-900" title={_id}>
            {shortOrderId(_id)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{formatDate(createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <OrderStatusBadge status={status} type="order" />
          {payment?.status && <OrderStatusBadge status={payment.status} type="payment" />}
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        {(user?.name || user?.email) && (
          <div className="flex items-center gap-2">
            <dt className="text-slate-500">Customer</dt>
            <dd className="truncate font-medium text-slate-900">{user.name || user.email}</dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <dt className="text-slate-500">Items</dt>
          <dd className="font-medium tabular-nums text-slate-900">{itemCount}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-slate-500">Total</dt>
          <dd className="font-medium tabular-nums text-slate-900">{formatCurrency(total)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
        <Link to={adminOrderDetailsPath(_id)}>
          <Button variant="outline" size="sm">
            View details
          </Button>
        </Link>
      </div>
    </AdminCard>
  );
}
