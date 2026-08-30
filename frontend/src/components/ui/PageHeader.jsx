import { classNames } from '../../utils/classNames';

/**
 * The standard top-of-page block: optional breadcrumb, an optional eyebrow,
 * the page's single <h1>, an optional one-line description, and an optional
 * actions slot on the right. Every customer page uses this so headings,
 * spacing and heading/action alignment are identical everywhere.
 *
 * The eyebrow sits outside the <h1> on purpose — it's framing, not part of
 * the page's name, and folding it in would change the heading's accessible
 * name.
 */
export function PageHeader({ title, description, eyebrow, breadcrumb, actions, className }) {
  return (
    <header className={classNames('mb-8 sm:mb-10', className)}>
      {breadcrumb}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
              <span className="h-px w-6 bg-brand-300" aria-hidden="true" />
              {eyebrow}
            </p>
          )}
          <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2.5 max-w-2xl text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
