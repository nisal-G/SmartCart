import { PageWrapper } from '../components/ui/PageWrapper';
import { EmptyState } from '../components/common/EmptyState';

/** Placeholder — order history is implemented in a later branch (orderService.getMyOrders is ready). */
export function Orders() {
  return (
    <PageWrapper>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Your orders</h1>
      <EmptyState
        title="Order history coming soon"
        description="Past orders and their status will be shown here."
      />
    </PageWrapper>
  );
}
