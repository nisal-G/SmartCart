import { PageWrapper } from '../components/ui/PageWrapper';
import { EmptyState } from '../components/common/EmptyState';

/** Placeholder — product/category browsing is implemented in a later branch (productService.js is ready). */
export function Products() {
  return (
    <PageWrapper>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Products</h1>
      <EmptyState
        title="Product catalog coming soon"
        description="Browsing, filtering, and search will be implemented here."
      />
    </PageWrapper>
  );
}
