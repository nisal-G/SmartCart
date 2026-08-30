import { classNames } from '../../utils/classNames';

/**
 * The standard heading block for a section *inside* a page — the smaller
 * sibling of PageHeader (which owns the page's single <h1>). Optional
 * eyebrow above, an optional one-line description under, and an optional
 * action on the right.
 *
 * The eyebrow deliberately sits outside the heading element: it's framing,
 * not part of the section's name, and folding it in would change the
 * heading's accessible name.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  as: As = 'h2',
  align = 'between',
  className,
}) {
  const centered = align === 'center';

  return (
    <div
      className={classNames(
        'flex gap-4',
        centered
          ? 'flex-col items-center text-center'
          : 'flex-col items-start sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className={classNames('min-w-0', centered && 'max-w-2xl')}>
        {eyebrow && (
          <p
            className={classNames(
              'mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700',
              centered && 'justify-center'
            )}
          >
            <span className="h-px w-6 bg-brand-300" aria-hidden="true" />
            {eyebrow}
          </p>
        )}
        <As className="text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </As>
        {description && (
          <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
    </div>
  );
}
