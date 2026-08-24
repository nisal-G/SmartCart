import { Button } from '../ui/Button';

/**
 * Displays an API/network error. Always receives an already-safe message —
 * services/api.js strips raw error objects down to `{ status, code, message }`
 * before anything reaches a component, and the backend's own error handler
 * (backend/src/middleware/errorHandler.js) never leaks internals in
 * production — so this component just renders text, never `error` itself.
 */
export function ErrorMessage({ message = 'Something went wrong. Please try again.', onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700"
    >
      <p className="text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
