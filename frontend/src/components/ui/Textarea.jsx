import { useId } from 'react';
import { classNames } from '../../utils/classNames';
import { Field } from './Field';
import { CONTROL_CLASSES, CONTROL_TONE } from './fieldStyles';

/** Labeled multi-line text input — same look/feel as Input, for longer fields like descriptions. */
export function Textarea({ label, error, hint, id, className, rows = 4, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint}>
      <textarea
        id={inputId}
        rows={rows}
        className={classNames(
          CONTROL_CLASSES,
          error ? CONTROL_TONE.error : CONTROL_TONE.normal,
          'resize-y',
          className
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
    </Field>
  );
}
