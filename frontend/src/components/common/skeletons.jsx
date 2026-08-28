import { Skeleton } from '../ui/Skeleton';

/*
 * Loading placeholders that mirror the real layout they stand in for, so
 * the page doesn't reflow when data arrives. Each one is aria-hidden and
 * paired with a visually-hidden "Loading…" status by its caller's own
 * label, so screen readers hear one message rather than a wall of boxes.
 */

/** One product tile's silhouette — same aspect ratio and padding as ProductCard. */
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-slate-200/80 bg-white shadow-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Grid of product skeletons matching ProductGrid's column counts exactly. */
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Stand-in for an admin table (desktop) / card list (mobile). */
export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div
      className="overflow-hidden rounded-card border border-slate-200/80 bg-white shadow-card"
      aria-hidden="true"
    >
      <div className="border-b border-slate-200 bg-sunken px-4 py-3.5">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 px-4 py-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-control" />
            {Array.from({ length: columns - 1 }, (_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={colIndex === 0 ? 'h-4 flex-1' : 'hidden h-4 w-24 sm:block'}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stand-in for a stacked list of cards (orders, cart lines). */
export function CardListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-card border border-slate-200/80 bg-white p-5 shadow-card"
        >
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-28 rounded-control" />
          </div>
        </div>
      ))}
    </div>
  );
}
