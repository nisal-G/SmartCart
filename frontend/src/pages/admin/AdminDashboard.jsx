import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading } from '../../components/common/Loading';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import { ROUTES } from '../../constants/routes';

/**
 * Admin landing page. Deliberately lightweight: the only figures shown are
 * ones the backend actually returns cheaply —
 *   - total products: `pagination.total` from GET /products (fetched with
 *     limit=1, since only the count is needed here)
 *   - total categories: the length of GET /categories (it has no pagination)
 * There is no API support for filtering products by isActive (see
 * backend/src/validators/productValidators.js listProductsValidators), so an
 * active/inactive breakdown isn't shown here rather than being approximated
 * by pulling the whole catalog.
 */
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
        return Promise.all([productService.getProducts({ limit: 1 }), categoryService.getCategories()]);
      })
      .then((result) => {
        if (ignore || !result) return;
        const [productData, categories] = result;
        setStats({
          totalProducts: productData.pagination.total,
          totalCategories: categories.length,
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
      {loading && <Loading label="Loading dashboard…" />}

      {!loading && error && <ErrorMessage message={error} onRetry={loadStats} />}

      {!loading && !error && stats && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Total products</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{stats.totalProducts}</p>
            <Link
              to={ROUTES.ADMIN_PRODUCTS}
              className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Manage products →
            </Link>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Total categories</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{stats.totalCategories}</p>
            <Link
              to={ROUTES.ADMIN_CATEGORIES}
              className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Manage categories →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
