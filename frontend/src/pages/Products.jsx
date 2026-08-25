import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { ProductGrid } from '../components/common/ProductGrid';
import { CategoryList } from '../components/common/CategoryList';
import productService from '../services/productService';
import categoryService from '../services/categoryService';

const PAGE_SIZE = 12;

/** Product & category browsing (SRS §3.2) — public, no login required. */
export function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category') || null;
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
  }, [categoryFilter, page]);

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

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  }

  return (
    <PageWrapper>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Products</h1>

      {categories.length > 0 && (
        <div className="mb-6">
          <CategoryList
            categories={categories}
            activeCategory={categoryFilter}
            onSelect={handleCategorySelect}
          />
        </div>
      )}

      {loading && <Loading label="Loading products…" />}

      {!loading && error && <ErrorMessage message={error} onRetry={fetchProducts} />}

      {!loading && !error && products.length === 0 && (
        <EmptyState
          title="No products found"
          description={
            categoryFilter
              ? 'There are no products in this category yet.'
              : 'There are no products available right now.'
          }
        />
      )}

      {!loading && !error && products.length > 0 && (
        <>
          <ProductGrid products={products} />

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
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
    </PageWrapper>
  );
}
