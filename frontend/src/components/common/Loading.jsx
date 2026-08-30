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
      className="flex flex-col items-center justify-center gap-4 rounded-panel border border-slate-200/80 bg-white py-20 text-slate-500 shadow-card sm:py-24"
      aria-live="polite"
    >
      <Spinner className="h-8 w-8" />
      <p className="text-sm font-semibold text-slate-600">{label}</p>
    </div>
  );
}
