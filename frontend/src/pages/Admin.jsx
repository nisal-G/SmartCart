import { PageWrapper } from '../components/ui/PageWrapper';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../hooks/useAuth';

/** Placeholder — admin dashboard (product/category/order management) is implemented in a later branch. */
export function Admin() {
  const { user } = useAuth();

  return (
    <PageWrapper>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Admin dashboard</h1>
      <EmptyState
        title="Admin tools coming soon"
        description={`Signed in as ${user.name}. Product, category, and order management will be implemented here.`}
      />
    </PageWrapper>
  );
}
