import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

/**
 * Previous / "Page X of Y" / Next, shared by every paginated list so the
 * controls, wording and disabled behaviour are identical on the storefront
 * and in the admin area. `pagination` is the backend's own `{ page,
 * totalPages, total }` object — this never computes pagination itself.
 */
export function Pagination({ pagination, onPageChange, className = 'mt-10' }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages } = pagination;

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-between gap-3 border-t border-slate-200 pt-8 sm:justify-center sm:gap-8 ${className}`}
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <Icon name="chevronLeft" size="sm" />
        Previous
      </Button>
      <p
        className="rounded-full bg-white px-4 py-2 text-sm font-semibold tabular-nums text-slate-600 shadow-xs ring-1 ring-slate-200"
        aria-live="polite"
      >
        Page {page} of {totalPages}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <Icon name="chevronRight" size="sm" />
      </Button>
    </nav>
  );
}
