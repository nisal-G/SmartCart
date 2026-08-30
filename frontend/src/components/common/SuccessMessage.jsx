import { Icon } from '../ui/Icon';

/**
 * Displays a one-off success confirmation (e.g. "Product created
 * successfully") — the success-toned counterpart to ErrorMessage. Purely
 * presentational; callers own when it appears/disappears.
 */
export function SuccessMessage({ message, className = 'mb-6' }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={`flex animate-scale-in items-center gap-3 rounded-card border border-emerald-200 bg-linear-to-br from-emerald-50 to-white px-4 py-3.5 text-sm font-semibold text-emerald-900 shadow-card ${className}`}
    >
      <Icon name="checkCircle" size="md" className="shrink-0 text-emerald-600" />
      <span className="min-w-0">{message}</span>
    </div>
  );
}
