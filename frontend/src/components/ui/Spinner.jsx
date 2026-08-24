import { classNames } from '../../utils/classNames';

/** Raw loading indicator primitive. See components/common/Loading.jsx for the composed, page-level version. */
export function Spinner({ className }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={classNames(
        'inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600',
        className
      )}
    />
  );
}
