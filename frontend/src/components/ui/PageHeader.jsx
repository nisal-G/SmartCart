import { classNames } from '../../utils/classNames';

/**
 * The standard top-of-page block: optional breadcrumb, the page's single
 * <h1>, an optional one-line description, and an optional actions slot on
 * the right. Every customer page uses this so headings, spacing and the
 * heading/action alignment are identical everywhere.
 */
export function PageHeader({ title, description, breadcrumb, actions, className }) {
  return (
    <header className={classNames('mb-6 sm:mb-8', className)}>
      {breadcrumb}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm text-slate-600 sm:text-base">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
