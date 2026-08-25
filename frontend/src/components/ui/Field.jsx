/**
 * Shared label + control + hint/error shell behind Input/Select/Textarea,
 * so all three have literally the same spacing, label styling and error
 * treatment rather than three near-copies that drift. The control classes
 * themselves live in ./fieldStyles.js.
 */
export function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm font-medium text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className="text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
