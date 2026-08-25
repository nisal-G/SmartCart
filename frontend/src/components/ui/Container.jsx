import { classNames } from '../../utils/classNames';

/** Responsive max-width wrapper with consistent horizontal padding — never a fixed pixel width. */
export function Container({ className, children }) {
  return (
    <div className={classNames('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  );
}
