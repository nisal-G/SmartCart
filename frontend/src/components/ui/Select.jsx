import { useId } from 'react';
import { classNames } from '../../utils/classNames';

/** Labeled select input — same look/feel as Input. `children` are plain <option> elements. */
export function Select({ label, error, id, className, children, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={classNames(
          'w-full rounded-md border bg-white px-3 py-2 text-base text-slate-900 shadow-sm',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
          error ? 'border-red-400' : 'border-slate-300',
          className
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
