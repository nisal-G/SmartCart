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
      className="flex flex-col items-start gap-3 rounded-card border border-red-200 bg-red-50/70 p-4 text-left sm:flex-row sm:items-center sm:gap-4 sm:p-5"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"
        aria-hidden="true"
      >
        <Icon name="alert" size="md" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-900">{title}</p>
        <p className="mt-0.5 text-sm text-red-800">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
          Try again
        </Button>
      )}
    </div>
  );
}
