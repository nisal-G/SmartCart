import { PageWrapper } from '../components/ui/PageWrapper';
import { EmptyState } from '../components/common/EmptyState';

/** Placeholder — checkout/order summary is implemented in a later branch (orderService.checkout is ready). */
export function Checkout() {
  return (
    <PageWrapper>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Checkout</h1>
      <EmptyState
        title="Checkout coming soon"
        description="Order summary and payment will be implemented here."
      />
    </PageWrapper>
  );
}
