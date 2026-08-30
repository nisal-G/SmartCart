import { Icon } from '../ui/Icon';

/**
 * Generic "nothing here yet" state — empty product lists, empty cart, no
 * orders, no search results. Always says what happened *and* offers the
 * next step, rather than leaving a blank panel on screen.
 */
export function EmptyState({ title = 'Nothing here yet', description, action, icon = 'package' }) {
  return (
    <div className="relative isolate flex animate-scale-in flex-col items-center gap-5 overflow-hidden rounded-panel border border-dashed border-slate-300 bg-white px-6 py-16 text-center sm:py-24">
      {/* A single soft brand wash behind the icon, so an empty screen still
          feels designed rather than unfinished. Decoration only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-100/50 blur-3xl"
      />

      <span
        className="relative flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-brand-50 to-brand-100 text-brand-600 ring-1 ring-brand-200/70"
        aria-hidden="true"
      >
        <Icon name={icon} size="xl" strokeWidth={1.5} />
      </span>
      <div className="relative space-y-2">
        <p className="text-xl font-bold tracking-tight text-slate-900">{title}</p>
        {description && (
          <p className="mx-auto max-w-md text-pretty text-sm leading-relaxed text-slate-500">
            {description}
          </p>
        )}
      </div>
      {action && <div className="relative mt-1">{action}</div>}
    </div>
  );
}
