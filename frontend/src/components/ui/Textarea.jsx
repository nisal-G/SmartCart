import { useId } from 'react';
import { classNames } from '../../utils/classNames';

/** Labeled multi-line text input — same look/feel as Input, for longer fields like descriptions. */
export function Textarea({ label, error, id, className, rows = 4, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={classNames(
          'w-full resize-y rounded-md border px-3 py-2 text-base text-slate-900 shadow-sm',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
          error ? 'border-red-400' : 'border-slate-300',
          className
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
