import { useId } from 'react';
import { classNames } from '../../utils/classNames';
import { Field } from './Field';
import { CONTROL_CLASSES, CONTROL_TONE } from './fieldStyles';
import { Icon } from './Icon';

/** Labeled text input with a consistent, mobile-friendly touch target and optional error/hint text. */
export function Input({ label, error, hint, id, className, icon, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const input = (
    <input
      id={inputId}
      className={classNames(
        CONTROL_CLASSES,
        error ? CONTROL_TONE.error : CONTROL_TONE.normal,
        icon && 'pl-9',
        className
      )}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
      {...props}
    />
  );

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint}>
      {icon ? (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            <Icon name={icon} size="sm" />
          </span>
          {input}
        </div>
      ) : (
        input
      )}
    </Field>
  );
}
