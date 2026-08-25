import { Spinner } from '../ui/Spinner';

/**
 * Full-section loading state. Used where the incoming layout isn't known
 * ahead of time; anywhere it is (product grids, tables, cards) prefer the
 * matching skeleton in components/common/skeletons.jsx — it avoids the
 * layout jump a spinner always causes when the data lands.
 */
export function Loading({ label = 'Loading…' }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500"
      aria-live="polite"
    >
      <Spinner />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
