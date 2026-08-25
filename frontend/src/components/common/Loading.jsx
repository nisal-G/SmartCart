import { Spinner } from '../ui/Spinner';

/** Full-section loading state — the default while a page/section waits on an API call. */
export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  );
}
