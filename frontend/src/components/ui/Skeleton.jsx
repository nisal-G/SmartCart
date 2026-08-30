import { classNames } from '../../utils/classNames';

/**
 * Grey placeholder block. Skeletons are preferred over a page-filling
 * spinner wherever the final layout is known in advance (product grids,
 * tables, cards) — the page then doesn't jump when the data lands.
 *
 * The fill is a travelling highlight (`shimmer`, defined in index.css)
 * rather than a pulsing opacity: it reads as "loading" rather than as a
 * blinking empty box, and the global reduced-motion rule stops it dead
 * along with every other animation in the app.
 */
export function Skeleton({ className }) {
  return (
    <div
      className={classNames('shimmer rounded-lg bg-slate-200/70', className)}
      aria-hidden="true"
    />
  );
}
