import { useId } from 'react';
import { classNames } from '../../utils/classNames';
import { Field } from './Field';
import { CONTROL_CLASSES, CONTROL_TONE } from './fieldStyles';
import { Icon } from './Icon';

/** Labeled select input — same look/feel as Input. `children` are plain <option> elements. */
export function Select({ label, error, hint, id, className, children, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint}>
      <div className="relative">
        <select
          id={inputId}
          className={classNames(
            CONTROL_CLASSES,
            error ? CONTROL_TONE.error : CONTROL_TONE.normal,
            // Room for the chevron below; the native arrow is hidden so the
            // control matches Input's height and border on every platform.
            'appearance-none pr-9',
            className
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          <Icon name="chevronDown" size="sm" />
        </span>
      </div>
    </Field>
  );
}
