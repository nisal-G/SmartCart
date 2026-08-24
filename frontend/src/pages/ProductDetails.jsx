import { useParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { EmptyState } from '../components/common/EmptyState';

/** Placeholder — full product detail view is implemented in a later branch (productService.getProductById is ready). */
export function ProductDetails() {
  const { id } = useParams();

  return (
    <PageWrapper>
      <EmptyState
        title="Product details coming soon"
        description={`This page will show full details for product ${id}.`}
      />
    </PageWrapper>
  );
}
