import { Icon } from '../ui/Icon';

/**
 * Generic "nothing here yet" state — empty product lists, empty cart, no
 * orders, no search results. Always says what happened *and* offers the
 * next step, rather than leaving a blank panel on screen.
 */
export function EmptyState({ title = 'Nothing here yet', description, action, icon = 'package' }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center sm:py-20">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-8 ring-brand-50/50"
        aria-hidden="true"
      >
        <Icon name={icon} size="xl" strokeWidth={1.5} />
      </span>
      <div className="space-y-1.5">
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
