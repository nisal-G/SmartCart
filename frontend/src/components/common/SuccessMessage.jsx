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
      className={`flex animate-fade-in items-center gap-3 rounded-card border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 ${className}`}
    >
      <Icon name="checkCircle" size="md" className="shrink-0 text-emerald-600" />
      <span className="min-w-0">{message}</span>
    </div>
  );
}
