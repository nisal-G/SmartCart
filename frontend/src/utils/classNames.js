/** Joins conditional class names, skipping falsy values. Avoids a "clsx" dependency for this small a need. */
export function classNames(...values) {
  return values.filter(Boolean).join(' ');
}
