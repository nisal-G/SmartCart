import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Skeleton';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import orderService from '../../services/orderService';
import { ROUTES } from '../../constants/routes';

/**
 * Admin landing page. Deliberately lightweight: the only figures shown are
 * ones the backend actually returns cheaply —
 *   - total products: `pagination.total` from GET /products (fetched with
 *     limit=1, since only the count is needed here)
 *   - total categories: the length of GET /categories (it has no pagination)
 *   - total / pending orders: `pagination.total` from GET /orders/all
 *     (fetched with limit=1, same trick, once unfiltered and once with
 *     status=pending — see backend/src/validators/orderValidators.js
 *     listOrdersValidators for the supported status filter)
 * There is no API support for filtering products by isActive (see
 * backend/src/validators/productValidators.js listProductsValidators), so an
 * active/inactive breakdown isn't shown here rather than being approximated
 * by pulling the whole catalog. Likewise there is no payment-status filter
 * on GET /orders/all, so a "paid orders" figure isn't shown here either —
 * computing it would mean fetching every order just to count them.
 */

/**
 * One metric tile. The label and value are deliberately direct siblings
 * inside this card — admin-dashboard.spec.js walks from the label to its
 * parent to read the matching value, so don't nest one of them deeper.
 */
function StatCard({ label, value, icon, to, linkLabel }) {
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-slate-50 text-slate-500"
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

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          orderService.getAllOrders({ limit: 1, status: 'pending' }),
        ]);
      })
      .then((result) => {
        if (ignore || !result) return;
        const [productData, categories, orderData, pendingOrderData] = result;
        setStats({
          totalProducts: productData.pagination.total,
          totalCategories: categories.length,
          totalOrders: orderData.pagination.total,
          pendingOrders: pendingOrderData.pagination.total,
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

  useEffect(loadStats, []);

  return (
    <div>
      <h2 className="sr-only">Dashboard</h2>

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
              to={ROUTES.ADMIN_PRODUCTS}
              linkLabel="Manage products →"
            />
            <StatCard
              label="Total categories"
              value={stats.totalCategories}
              icon="tag"
              to={ROUTES.ADMIN_CATEGORIES}
              linkLabel="Manage categories →"
            />
            <StatCard
              label="Total orders"
              value={stats.totalOrders}
              icon="receipt"
              to={ROUTES.ADMIN_ORDERS}
              linkLabel="Manage orders →"
            />
            <StatCard
              label="Pending orders"
              value={stats.pendingOrders}
              icon="info"
              to={`${ROUTES.ADMIN_ORDERS}?status=pending`}
              linkLabel="View pending orders →"
            />
          </div>

          <div className="mt-6 rounded-card border border-slate-200 bg-white p-5 shadow-card sm:p-6">
            <h3 className="text-base font-semibold text-slate-900">Quick actions</h3>
            <p className="mt-1 text-sm text-slate-500">
              Jump straight into the tasks you run most often.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link
                to={ROUTES.ADMIN_PRODUCT_NEW}
                className="flex items-center gap-3 rounded-control border border-slate-200 p-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-50 text-brand-700"
                  aria-hidden="true"
                >
                  <Icon name="plus" size="md" />
                </span>
                <span className="text-sm font-semibold text-slate-800">Add a new product</span>
              </Link>
              <Link
                to={ROUTES.ADMIN_CATEGORY_NEW}
                className="flex items-center gap-3 rounded-control border border-slate-200 p-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-50 text-brand-700"
                  aria-hidden="true"
                >
                  <Icon name="plus" size="md" />
                </span>
                <span className="text-sm font-semibold text-slate-800">Add a new category</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
