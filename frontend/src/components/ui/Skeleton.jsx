import { classNames } from '../../utils/classNames';

/**
 * Grey placeholder block. Skeletons are preferred over a page-filling
 * spinner wherever the final layout is known in advance (product grids,
 * tables, cards) — the page then doesn't jump when the data lands.
 */
export function Skeleton({ className }) {
  return (
    <div
      className={classNames('animate-pulse rounded-md bg-slate-200/70', className)}
      aria-hidden="true"
    />
  );
}
