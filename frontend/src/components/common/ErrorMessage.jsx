import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

/**
 * Displays an API/network error. Always receives an already-safe message —
 * services/api.js strips raw error objects down to `{ status, code, message }`
 * before anything reaches a component, and the backend's own error handler
 * (backend/src/middleware/errorHandler.js) never leaks internals in
 * production — so this component just renders text, never `error` itself.
 */
export function ErrorMessage({
  title = 'Something went wrong',
  message = 'Something went wrong. Please try again.',
  onRetry,
}) {
  return (
    <div
      role="alert"
      className="flex animate-scale-in flex-col items-start gap-4 rounded-card border border-red-200 bg-linear-to-br from-red-50 to-white p-5 text-left shadow-card sm:flex-row sm:items-center sm:p-6"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 ring-4 ring-red-50"
        aria-hidden="true"
      >
        <Icon name="alert" size="md" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-red-900">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-red-800">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
          <Icon name="refresh" size="sm" />
          Try again
        </Button>
      )}
    </div>
  );
}
