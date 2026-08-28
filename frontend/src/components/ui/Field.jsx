/**
 * Shared label + control + hint/error shell behind Input/Select/Textarea,
 * so all three have literally the same spacing, label styling and error
 * treatment rather than three near-copies that drift. The control classes
 * themselves live in ./fieldStyles.js.
 */
export function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-700">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="flex items-start gap-1.5 text-sm font-medium text-red-600"
        >
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className="text-xs leading-relaxed text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
