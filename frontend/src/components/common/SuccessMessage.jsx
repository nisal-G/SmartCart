/**
 * Displays a one-off success confirmation (e.g. "Product created
 * successfully") — the success-toned counterpart to ErrorMessage. Purely
 * presentational; callers own when it appears/disappears.
 */
export function SuccessMessage({ message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
    >
      {message}
    </div>
  );
}
