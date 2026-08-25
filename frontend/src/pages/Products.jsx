import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { PageHeader } from '../components/ui/PageHeader';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Icon } from '../components/ui/Icon';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { ProductGrid } from '../components/common/ProductGrid';
import { ProductGridSkeleton } from '../components/common/skeletons';
import { CategoryList } from '../components/common/CategoryList';
import { Pagination } from '../components/common/Pagination';
import productService from '../services/productService';
import categoryService from '../services/categoryService';
import { ROUTES } from '../constants/routes';

const PAGE_SIZE = 12;

/** Product & category browsing (SRS §3.2) — public, no login required. */
export function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category') || null;
  // Set by the header's search field, which submits to /products?search=…
  // (the backend's own product `search` filter — no client-side filtering).
  const searchTerm = searchParams.get('search') || '';
  const page = Number(searchParams.get('page')) || 1;

  const [categories, setCategories] = useState([]);

  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Categories are secondary to the product list — if they fail to load,
  // the filter bar just doesn't render; it shouldn't block browsing.
  useEffect(() => {
    let ignore = false;
    categoryService
      .getCategories()
      .then((data) => {
        if (!ignore) setCategories(data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  // Written as an inline promise chain (rather than calling setLoading/setError
  // synchronously) so every setState call is a literal callback passed to
  // .then/.catch/.finally, not a synchronous call in the effect body itself —
  // same pattern as context/CartContext.jsx.
  const fetchProducts = useCallback(() => {
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (ignore) return undefined;
        setLoading(true);
        setError(null);
        return productService.getProducts({
          category: categoryFilter || undefined,
          search: searchTerm || undefined,
          page,
          limit: PAGE_SIZE,
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
  }, [categoryFilter, searchTerm, page]);

  useEffect(() => fetchProducts(), [fetchProducts]);

  function handleCategorySelect(categoryId) {
    const next = new URLSearchParams(searchParams);
    if (categoryId) {
      next.set('category', categoryId);
    } else {
      next.delete('category');
    }
    next.delete('page');
    setSearchParams(next);
  }

  function clearSearch() {
    const next = new URLSearchParams(searchParams);
    next.delete('search');
    next.delete('page');
    setSearchParams(next);
  }

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  }

  const activeCategoryName = categories.find((c) => c._id === categoryFilter)?.name;
  const total = pagination?.total;

  return (
    <PageWrapper>
      <PageHeader
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Home', to: ROUTES.HOME },
              { label: activeCategoryName || 'Products' },
            ]}
          />
        }
        title="Products"
        description={
          activeCategoryName
            ? `Everything currently listed under ${activeCategoryName}.`
            : 'Browse the full SmartCart catalogue.'
        }
      />

      {searchTerm && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-card border border-slate-200 bg-white p-3 shadow-card sm:p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Icon name="search" size="sm" />
          </span>
          <p className="min-w-0 flex-1 text-sm text-slate-600">
            Showing results for{' '}
            <span className="font-semibold text-slate-900">&ldquo;{searchTerm}&rdquo;</span>
          </p>
          <button
            type="button"
            onClick={clearSearch}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <Icon name="close" size="xs" />
            Clear search
          </button>
        </div>
      )}

      {categories.length > 0 && (
        <div className="mb-6">
          <CategoryList
            categories={categories}
            activeCategory={categoryFilter}
            onSelect={handleCategorySelect}
          />
        </div>
      )}

      {!loading && !error && products.length > 0 && total != null && (
        <p className="mb-4 text-sm text-slate-500">
          {total} {total === 1 ? 'product' : 'products'}
          {activeCategoryName ? ` in ${activeCategoryName}` : ''}
        </p>
      )}

      {loading && <ProductGridSkeleton count={PAGE_SIZE} />}

      {!loading && error && <ErrorMessage message={error} onRetry={fetchProducts} />}

      {!loading && !error && products.length === 0 && (
        <EmptyState
          icon={searchTerm ? 'search' : 'package'}
          title="No products found"
          description={
            searchTerm
              ? `Nothing matched “${searchTerm}”. Try a different search term or browse a category.`
              : categoryFilter
                ? 'There are no products in this category yet.'
                : 'There are no products available right now.'
          }
        />
      )}

      {!loading && !error && products.length > 0 && (
        <>
          <ProductGrid products={products} />
          <Pagination pagination={pagination} onPageChange={goToPage} />
        </>
      )}
    </PageWrapper>
  );
}
