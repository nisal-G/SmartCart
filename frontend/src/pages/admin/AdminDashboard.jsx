import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';
import { OrderStatusBadge } from '../../components/common/OrderStatusBadge';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import { TableSkeleton } from '../../components/common/skeletons';
import { AdminCard, AdminCardList, AdminTable, Td, Th, Tr } from '../../components/admin/AdminTable';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import orderService from '../../services/orderService';
import { formatCurrency } from '../../utils/formatCurrency';
import { shortOrderId } from '../../utils/orderId';
import { ORDER_STATUSES, formatStatusLabel } from '../../constants/orderStatuses';
import { ROUTES, adminOrderDetailsPath } from '../../constants/routes';

/**
 * Admin landing page. Deliberately lightweight: the only figures shown are
 * ones the backend actually returns cheaply —
 *   - total products: `pagination.total` from GET /products (fetched with
 *     limit=1, since only the count is needed here)
 *   - total categories: the length of GET /categories (it has no pagination)
 *   - total / pending orders, and the order-pipeline breakdown: all from
 *     `pagination.total` on GET /orders/all (fetched with limit=1, same
 *     trick, once unfiltered and once per value in ORDER_STATUSES — see
 *     backend/src/validators/orderValidators.js listOrdersValidators for
 *     the supported status filter)
 *   - recent orders: the 5 most recent rows from that same GET /orders/all,
 *     which already sorts newest-first — no separate "recent" endpoint
 *     exists or is needed.
 * There is no API support for filtering products by isActive (see
 * backend/src/validators/productValidators.js listProductsValidators), so an
 * active/inactive breakdown isn't shown here rather than being approximated
 * by pulling the whole catalog. Likewise there is no payment-status filter
 * on GET /orders/all, so a "paid orders" figure isn't shown here either —
 * computing it would mean fetching every order just to count them. For the
 * same reason, no trend/percentage figures are shown anywhere on this page:
 * the backend has no historical/time-series endpoint to compute one from.
 */

const TODAY_LABEL = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(new Date());

// Solid gradient icon tiles read as more "designed" than the flat tinted
// squares used elsewhere in the admin (badges, filter icons) — reserved for
// these headline stat tiles so the effect stays a highlight, not the norm.
const ICON_TINTS = {
  brand: 'bg-linear-to-br from-brand-500 to-brand-700 text-white',
  neutral: 'bg-linear-to-br from-slate-700 to-slate-900 text-white',
  warning: 'bg-linear-to-br from-amber-400 to-amber-600 text-white',
};

// Same order-status palette as OrderStatusBadge (pending=amber,
// confirmed=emerald, cancelled=red) — kept in one place so the pipeline bar
// below and every status badge in the admin always agree on what color a
// status is.
const STATUS_BAR_CLASSES = {
  pending: 'bg-amber-400',
  confirmed: 'bg-emerald-500',
  cancelled: 'bg-red-400',
};

/**
 * One metric tile. The label and value are deliberately direct siblings
 * inside this card — admin-dashboard.spec.js walks from the label to its
 * parent to read the matching value, so don't nest one of them deeper.
 */
function StatCard({ label, value, icon, tint = 'neutral', to, linkLabel }) {
  return (
    <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${ICON_TINTS[tint] || ICON_TINTS.neutral}`}
          aria-hidden="true"
        >
          <Icon name={icon} size="md" />
        </span>
      </div>
      <Link
        to={to}
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
      >
        {linkLabel}
      </Link>
    </div>
  );
}

/** One "common task" tile — an icon-in-a-tinted-box, a label, and a subtle hover lift. */
function QuickAction({ to, icon, label }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-control border border-slate-200 p-3 transition-[transform,border-color,background-color] duration-150 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-700 transition-colors duration-150 group-hover:bg-brand-600 group-hover:text-white"
        aria-hidden="true"
      >
        <Icon name={icon} size="md" />
      </span>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
    </Link>
  );
}

/**
 * Order fulfillment breakdown as one segmented bar plus a legend — a quick
 * "where do things stand" read that a raw stat number can't give. Every
 * count comes from `stats.statusCounts` (see loadStats below); a store with
 * no orders yet shows the empty bar as a flat slate track rather than
 * dividing by zero.
 */
function OrderPipeline({ total, statusCounts }) {
  return (
    <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <h3 className="text-base font-semibold text-slate-900">Order pipeline</h3>
      <p className="mt-1 text-sm text-slate-500">How every order today breaks down by status.</p>

      <div
        className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={ORDER_STATUSES.map(
          (s) => `${formatStatusLabel(s)}: ${statusCounts[s] || 0}`
        ).join(', ')}
      >
        {total > 0 &&
          ORDER_STATUSES.map((s) => {
            const count = statusCounts[s] || 0;
            if (count === 0) return null;
            return (
              <div
                key={s}
                className={`h-full ${STATUS_BAR_CLASSES[s] || 'bg-slate-400'} first:rounded-l-full last:rounded-r-full`}
                style={{ width: `${(count / total) * 100}%` }}
              />
            );
          })}
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {ORDER_STATUSES.map((s) => {
          const count = statusCounts[s] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={s}>
              <Link
                to={`${ROUTES.ADMIN_ORDERS}?status=${s}`}
                className="flex items-center gap-2.5 rounded-control px-2 py-1.5 -mx-2 transition-colors hover:bg-slate-50"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_BAR_CLASSES[s] || 'bg-slate-400'}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                  {formatStatusLabel(s)}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                  {count}
                </span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-400">
                  {pct}%
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [recentOrders, setRecentOrders] = useState(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState(null);

  function loadStats() {
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (ignore) return undefined;
        setLoading(true);
        setError(null);
        return Promise.all([
          productService.getProducts({ limit: 1 }),
          categoryService.getCategories(),
          orderService.getAllOrders({ limit: 1 }),
          ...ORDER_STATUSES.map((status) => orderService.getAllOrders({ limit: 1, status })),
        ]);
      })
      .then((result) => {
        if (ignore || !result) return;
        const [productData, categories, orderData, ...statusResults] = result;
        const statusCounts = Object.fromEntries(
          ORDER_STATUSES.map((status, index) => [status, statusResults[index].pagination.total])
        );
        setStats({
          totalProducts: productData.pagination.total,
          totalCategories: categories.length,
          totalOrders: orderData.pagination.total,
          pendingOrders: statusCounts.pending || 0,
          statusCounts,
        });
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
  }

  // Independent of the stat tiles above — a slow/failed recent-orders
  // fetch shouldn't hold up (or take down) the stat cards, and vice versa.
  function loadRecentOrders() {
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (ignore) return undefined;
        setRecentLoading(true);
        setRecentError(null);
        return orderService.getAllOrders({ limit: 5 });
      })
      .then((data) => {
        if (ignore || !data) return;
        setRecentOrders(data.orders);
      })
      .catch((err) => {
        if (!ignore) setRecentError(err.message);
      })
      .finally(() => {
        if (!ignore) setRecentLoading(false);
      });
    return () => {
      ignore = true;
    };
  }

  useEffect(loadStats, []);
  useEffect(loadRecentOrders, []);

  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-panel border border-brand-900/10 bg-linear-to-br from-brand-600 via-brand-700 to-slate-900 px-6 py-7 shadow-panel sm:px-8">
        {/* Purely decorative glow — clipped by the panel's own overflow-hidden. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-brand-400/20 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Dashboard</h2>
            <p className="mt-1.5 max-w-md text-sm text-brand-50/90">
              Welcome back, Admin. Here&apos;s what&apos;s happening with your store today.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            <Icon name="dashboard" size="xs" />
            {TODAY_LABEL}
          </span>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-9 w-16" />
              <Skeleton className="mt-4 h-4 w-32" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && <ErrorMessage message={error} onRetry={loadStats} />}

      {!loading && !error && stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total products"
              value={stats.totalProducts}
              icon="package"
              tint="brand"
              to={ROUTES.ADMIN_PRODUCTS}
              linkLabel="Manage products →"
            />
            <StatCard
              label="Total categories"
              value={stats.totalCategories}
              icon="tag"
              tint="neutral"
              to={ROUTES.ADMIN_CATEGORIES}
              linkLabel="Manage categories →"
            />
            <StatCard
              label="Total orders"
              value={stats.totalOrders}
              icon="receipt"
              tint="neutral"
              to={ROUTES.ADMIN_ORDERS}
              linkLabel="Manage orders →"
            />
            <StatCard
              label="Pending orders"
              value={stats.pendingOrders}
              icon="clock"
              tint="warning"
              to={`${ROUTES.ADMIN_ORDERS}?status=pending`}
              linkLabel="View pending orders →"
            />
          </div>

          <div className="mt-6 rounded-card border border-slate-200 bg-white p-5 shadow-card sm:p-6">
            <h3 className="text-base font-semibold text-slate-900">Quick actions</h3>
            <p className="mt-1 text-sm text-slate-500">
              Common tasks for managing your store.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <QuickAction to={ROUTES.ADMIN_PRODUCT_NEW} icon="plus" label="Add a new product" />
              <QuickAction to={ROUTES.ADMIN_CATEGORY_NEW} icon="plus" label="Add a new category" />
              <QuickAction to={ROUTES.ADMIN_ORDERS} icon="arrowRight" label="Manage orders" />
            </div>
          </div>

          <div className="mt-6">
            <OrderPipeline total={stats.totalOrders} statusCounts={stats.statusCounts} />
          </div>
        </>
      )}

      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Recent orders</h3>
            <p className="mt-0.5 text-sm text-slate-500">The latest activity across your store.</p>
          </div>
          <Link
            to={ROUTES.ADMIN_ORDERS}
            className="shrink-0 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            View all →
          </Link>
        </div>

        {recentLoading && <TableSkeleton rows={5} columns={4} />}

        {!recentLoading && recentError && (
          <ErrorMessage
            title="Unable to load orders"
            message="Something went wrong while retrieving the orders."
            onRetry={loadRecentOrders}
          />
        )}

        {!recentLoading && !recentError && recentOrders?.length === 0 && (
          <EmptyState
            icon="receipt"
            title="No orders yet"
            description="Orders will show up here once customers start checking out."
          />
        )}

        {!recentLoading && !recentError && recentOrders?.length > 0 && (
          <>
            {/* Desktop / tablet table */}
            <AdminTable
              head={
                <>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th align="right">Total</Th>
                </>
              }
            >
              {recentOrders.map((order) => (
                <Tr key={order._id}>
                  <Td className="font-mono text-xs font-semibold text-slate-900" title={order._id}>
                    <Link
                      to={adminOrderDetailsPath(order._id)}
                      className="hover:text-brand-700 hover:underline"
                    >
                      {shortOrderId(order._id)}
                    </Link>
                  </Td>
                  <Td className="text-slate-700">{order.user?.name || order.user?.email || '—'}</Td>
                  <Td>
                    <OrderStatusBadge status={order.status} type="order" />
                  </Td>
                  <Td align="right" className="font-medium tabular-nums text-slate-900">
                    {formatCurrency(order.total)}
                  </Td>
                </Tr>
              ))}
            </AdminTable>

            {/* Mobile cards */}
            <AdminCardList>
              {recentOrders.map((order) => (
                <Link key={order._id} to={adminOrderDetailsPath(order._id)}>
                  <AdminCard>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm font-semibold text-slate-900">
                        {shortOrderId(order._id)}
                      </span>
                      <OrderStatusBadge status={order.status} type="order" />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-slate-500">
                        {order.user?.name || order.user?.email || '—'}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-slate-900">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </AdminCard>
                </Link>
              ))}
            </AdminCardList>
          </>
        )}
      </div>
    </div>
  );
}
