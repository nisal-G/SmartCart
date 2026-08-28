import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';
import { SuccessMessage } from '../../components/common/SuccessMessage';
import { TableSkeleton } from '../../components/common/skeletons';
import { Pagination } from '../../components/common/Pagination';
import { AdminCard, AdminCardList, AdminTable, Td, Th, Tr } from '../../components/admin/AdminTable';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import { useToast } from '../../hooks/useToast';
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
  const toast = useToast();

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
    categoryService
      .getCategories()
      .then(setCategories)
      .catch(() => {});
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
      toast.success('Product deleted');
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const hasFilters = Boolean(search || category || minPrice || maxPrice);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Products</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {pagination?.total != null
              ? `${pagination.total} product${pagination.total === 1 ? '' : 's'} in the catalogue`
              : 'Catalogue management'}
          </p>
        </div>
        <Link to={ROUTES.ADMIN_PRODUCT_NEW}>
          <Button size="sm">
            <Icon name="plus" size="sm" />
            Add product
          </Button>
        </Link>
      </div>

      <SuccessMessage message={flash} />

      <form
        onSubmit={applyFilters}
        className="mb-6 rounded-card border border-slate-200 bg-white p-4 shadow-card sm:p-5"
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon name="filter" size="sm" className="text-slate-400" />
          Filters
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2">
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
            placeholder="0.00"
            value={draftMinPrice}
            onChange={(e) => setDraftMinPrice(e.target.value)}
          />
          <Input
            label="Max price"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={draftMaxPrice}
            onChange={(e) => setDraftMaxPrice(e.target.value)}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <Button type="submit" size="sm">
            Apply filters
          </Button>
          {hasFilters && (
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </form>

      {loading && <TableSkeleton rows={PAGE_SIZE} columns={6} />}

      {!loading && error && <ErrorMessage message={error} onRetry={fetchProducts} />}

      {!loading && !error && products.length === 0 && (
        <EmptyState
          title="No products"
          description={
            hasFilters
              ? 'No products match these filters. Adjust or clear them above to see more.'
              : 'Get started by adding your first product.'
          }
          // No "Clear filters" action here on purpose — the filter bar
          // directly above already owns that control, and two identical
          // buttons on one screen is one too many.
          action={
            hasFilters ? null : (
              <Link to={ROUTES.ADMIN_PRODUCT_NEW}>
                <Button>Add product</Button>
              </Link>
            )
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
          <AdminTable
            head={
              <>
                <Th>Product</Th>
                <Th>Price</Th>
                <Th>Category</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th align="right">Actions</Th>
              </>
            }
          >
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
          </AdminTable>

          {/* Mobile cards */}
          <AdminCardList>
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
          </AdminCardList>

          <Pagination pagination={pagination} onPageChange={goToPage} className="mt-6" />
        </>
      )}
    </div>
  );
}

function StatusBadge({ isActive }) {
  return (
    <Badge tone={isActive === false ? 'danger' : 'success'} size="sm">
      {isActive === false ? 'Inactive' : 'Active'}
    </Badge>
  );
}

/** Small product thumbnail with a consistent placeholder. */
function Thumb({ image, size = 'md' }) {
  const box = size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  return (
    <div
      className={`${box} shrink-0 overflow-hidden rounded-control bg-slate-100 ring-1 ring-slate-200/70`}
    >
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-slate-300">
          <Icon name="package" size="sm" strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}

function DeleteActions({ isConfirming, isDeleting, onDeleteClick, onCancelDelete, onConfirmDelete }) {
  if (isConfirming) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={onConfirmDelete}
          loading={isDeleting}
          disabled={isDeleting}
        >
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
      <Icon name="trash" size="sm" />
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
    <Tr>
      <Td>
        <div className="flex items-center gap-3">
          <Thumb image={image} />
          <span className="font-semibold text-slate-900">{name}</span>
        </div>
      </Td>
      <Td className="font-medium tabular-nums text-slate-700">{formatCurrency(price)}</Td>
      <Td className="text-slate-600">{category?.name || '—'}</Td>
      <Td>
        <StatusBadge isActive={isActive} />
      </Td>
      <Td className="whitespace-nowrap text-slate-500">{formatDate(createdAt)}</Td>
      <Td align="right">
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
                <Icon name="pencil" size="sm" />
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
      </Td>
    </Tr>
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
    <AdminCard>
      <div className="flex gap-3">
        <Thumb image={image} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{name}</p>
          <p className="text-sm text-slate-500">{category?.name || '—'}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold tabular-nums text-slate-900">
              {formatCurrency(price)}
            </span>
            <StatusBadge isActive={isActive} />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Created {formatDate(createdAt)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
        {!isConfirming && (
          <Link to={onEditPath}>
            <Button variant="outline" size="sm">
              <Icon name="pencil" size="sm" />
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
    </AdminCard>
  );
}
