import { PageWrapper } from '../components/ui/PageWrapper';
import { EmptyState } from '../components/common/EmptyState';

/** Placeholder — full cart UI is implemented in a later branch (CartContext/cartService are ready). */
export function Cart() {
  return (
    <PageWrapper>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Your cart</h1>
      <EmptyState
        title="Cart management coming soon"
        description="Adding, updating, and removing items will be implemented here."
      />
    </PageWrapper>
  );
}
