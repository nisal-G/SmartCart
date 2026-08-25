import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/common/Loading';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';
import { SuccessMessage } from '../../components/common/SuccessMessage';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { ROUTES, adminProductEditPath } from '../../constants/routes';

const PAGE_SIZE = 10;

/**
 * Admin product list (/admin/products). Uses GET /api/products' own
 * server-side pagination/search/category/price filters (see
 * backend/src/validators/productValidators.js listProductsValidators) —
 * every filter here is one the backend actually implements.
 */
export function AdminProducts() {
  const location = useLocation();
  const [flash] = useState(location.state?.flash || null);

  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page'), 10) || 1;
  const category = searchParams.get('category') || '';
  const search = searchParams.get('search') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';

  // Draft filter values, committed to the URL (and so to the actual
  // request) only on "Apply filters" — typing shouldn't fire a request per
  // keystroke.
  const [draftSearch, setDraftSearch] = useState(search);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftMinPrice, setDraftMinPrice] = useState(minPrice);
  const [draftMaxPrice, setDraftMaxPrice] = useState(maxPrice);

  const [categories, setCategories] = useState([]);

  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Categories are only needed for the filter dropdown — fetched once.
  useEffect(() => {
    categoryService.getCategories().then(setCategories).catch(() => {});
  }, []);

  const fetchProducts = useCallback(() => {
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (ignore) return undefined;
        setLoading(true);
        setError(null);
        return productService.getProducts({
          page,
          limit: PAGE_SIZE,
          category: category || undefined,
          search: search || undefined,
          minPrice: minPrice || undefined,
          maxPrice: maxPrice || undefined,
        });
      })
      .then((data) => {
        if (ignore || !data) return;
        setProducts(data.products);
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
  }, [page, category, search, minPrice, maxPrice]);

  useEffect(() => fetchProducts(), [fetchProducts]);

  function applyFilters(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (draftSearch) next.set('search', draftSearch);
    if (draftCategory) next.set('category', draftCategory);
    if (draftMinPrice) next.set('minPrice', draftMinPrice);
    if (draftMaxPrice) next.set('maxPrice', draftMaxPrice);
    setSearchParams(next);
  }

  function clearFilters() {
    setDraftSearch('');
    setDraftCategory('');
    setDraftMinPrice('');
    setDraftMaxPrice('');
    setSearchParams({});
  }

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  }

  async function handleDelete(productId) {
    setDeletingId(productId);
    setDeleteError(null);
    try {
      await productService.deleteProduct(productId);
      setConfirmingId(null);
      fetchProducts();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const hasFilters = Boolean(search || category || minPrice || maxPrice);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Products</h2>
        <Link to={ROUTES.ADMIN_PRODUCT_NEW}>
          <Button size="sm">Add product</Button>
        </Link>
      </div>

      <SuccessMessage message={flash} />

      <form
        onSubmit={applyFilters}
        className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="sm:col-span-2 lg:col-span-2">
          <Input
            label="Search"
            placeholder="Product name…"
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
          />
        </div>
        <Select
          label="Category"
          value={draftCategory}
          onChange={(e) => setDraftCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          label="Min price"
          type="number"
          min="0"
          step="0.01"
          value={draftMinPrice}
          onChange={(e) => setDraftMinPrice(e.target.value)}
        />
        <Input
          label="Max price"
          type="number"
          min="0"
          step="0.01"
          value={draftMaxPrice}
          onChange={(e) => setDraftMaxPrice(e.target.value)}
        />
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" variant="secondary" size="sm">
            Apply filters
          </Button>
          {hasFilters && (
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </form>

      {loading && <Loading label="Loading products…" />}

      {!loading && error && <ErrorMessage message={error} onRetry={fetchProducts} />}

      {!loading && !error && products.length === 0 && (
        <EmptyState
          title="No products"
          description={hasFilters ? 'No products match these filters.' : 'Get started by adding your first product.'}
          action={
            <Link to={ROUTES.ADMIN_PRODUCT_NEW}>
              <Button>Add product</Button>
            </Link>
          }
        />
      )}

      {!loading && !error && products.length > 0 && (
        <>
          {deleteError && (
            <div className="mb-4">
              <ErrorMessage message={deleteError} />
            </div>
          )}

          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <ProductRow
                    key={product._id}
                    product={product}
                    isConfirming={confirmingId === product._id}
                    isDeleting={deletingId === product._id}
                    onEditPath={adminProductEditPath(product._id)}
                    onDeleteClick={() => setConfirmingId(product._id)}
                    onCancelDelete={() => setConfirmingId(null)}
                    onConfirmDelete={() => handleDelete(product._id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {products.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                isConfirming={confirmingId === product._id}
                isDeleting={deletingId === product._id}
                onEditPath={adminProductEditPath(product._id)}
                onDeleteClick={() => setConfirmingId(product._id)}
                onCancelDelete={() => setConfirmingId(null)}
                onConfirmDelete={() => handleDelete(product._id)}
              />
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

function StatusBadge({ isActive }) {
  return (
    <span
      className={
        isActive === false
          ? 'inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700'
          : 'inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800'
      }
    >
      {isActive === false ? 'Inactive' : 'Active'}
    </span>
  );
}

function DeleteActions({ isConfirming, isDeleting, onDeleteClick, onCancelDelete, onConfirmDelete }) {
  if (isConfirming) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button variant="danger" size="sm" onClick={onConfirmDelete} loading={isDeleting} disabled={isDeleting}>
          Confirm
        </Button>
        <Button variant="outline" size="sm" onClick={onCancelDelete} disabled={isDeleting}>
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={onDeleteClick}>
      Delete
    </Button>
  );
}

function ProductRow({
  product,
  isConfirming,
  isDeleting,
  onEditPath,
  onDeleteClick,
  onCancelDelete,
  onConfirmDelete,
}) {
  const { name, price, category, image, isActive, createdAt } = product;
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-slate-100">
            {image ? (
              <img src={image} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                No image
              </div>
            )}
          </div>
          <span className="font-medium text-slate-900">{name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-700">{formatCurrency(price)}</td>
      <td className="px-4 py-3 text-slate-700">{category?.name || '—'}</td>
      <td className="px-4 py-3">
        <StatusBadge isActive={isActive} />
      </td>
      <td className="px-4 py-3 text-slate-500">{formatDate(createdAt)}</td>
      <td className="px-4 py-3">
        {isConfirming ? (
          <DeleteActions
            isConfirming
            isDeleting={isDeleting}
            onDeleteClick={onDeleteClick}
            onCancelDelete={onCancelDelete}
            onConfirmDelete={onConfirmDelete}
          />
        ) : (
          <div className="flex items-center justify-end gap-2">
            <Link to={onEditPath}>
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </Link>
            <DeleteActions
              isConfirming={false}
              isDeleting={isDeleting}
              onDeleteClick={onDeleteClick}
              onCancelDelete={onCancelDelete}
              onConfirmDelete={onConfirmDelete}
            />
          </div>
        )}
      </td>
    </tr>
  );
}

function ProductCard({
  product,
  isConfirming,
  isDeleting,
  onEditPath,
  onDeleteClick,
  onCancelDelete,
  onConfirmDelete,
}) {
  const { name, price, category, image, isActive, createdAt } = product;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex gap-3">
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-slate-100">
          {image ? (
            <img src={image} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900">{name}</p>
          <p className="text-sm text-slate-500">{category?.name || '—'}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{formatCurrency(price)}</span>
            <StatusBadge isActive={isActive} />
          </div>
          <p className="mt-1 text-xs text-slate-400">Created {formatDate(createdAt)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        {!isConfirming && (
          <Link to={onEditPath}>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
        )}
        <DeleteActions
          isConfirming={isConfirming}
          isDeleting={isDeleting}
          onDeleteClick={onDeleteClick}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
        />
      </div>
    </div>
  );
}
