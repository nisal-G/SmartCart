import { classNames } from '../../utils/classNames';

/*
 * One button system for the whole app. Four intents only — primary (the one
 * real call to action on a view), secondary (neutral filled), outline
 * (quiet/tertiary), danger (destructive) — plus `ghost` for icon-ish
 * toolbar actions. Anything that needs a fifth look almost certainly wants
 * one of these instead.
 */
const VARIANT_CLASSES = {
  primary:
    'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 ' +
    'focus-visible:outline-brand-600 disabled:hover:bg-brand-600',
  secondary:
    'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 ' +
    'focus-visible:outline-slate-900 disabled:hover:bg-slate-900',
  outline:
    'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 ' +
    'active:bg-slate-100 focus-visible:outline-slate-500 disabled:hover:bg-white',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 ' +
    'focus-visible:outline-red-600 disabled:hover:bg-red-600',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 ' +
    'focus-visible:outline-slate-500',
};

// One shared "unavailable" look for every variant, so a disabled primary
// and a disabled outline button read as equally out of reach.
const MUTED_CLASSES = 'border border-slate-200 bg-slate-100 text-slate-400 shadow-none';

// Heights are fixed per size so a row of mixed-variant buttons always lines
// up, and every size clears the 40px+ touch target on the two larger steps.
const SIZE_CLASSES = {
  sm: 'h-9 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-base',
};

/** Base button used across the app so every action shares one look/feel and focus/disabled behavior. */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  className,
  children,
  ...props
}) {
  // A genuinely unavailable action is greyed out so it reads as unavailable
  // at a glance; a *loading* one keeps its own colour (the spinner already
  // says what's happening, and a button that changes colour mid-submit
  // looks like a different button).
  const muted = disabled && !loading;

  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classNames(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded-control font-semibold',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out',
        'active:translate-y-px',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:pointer-events-none disabled:active:translate-y-0',
        // Swapped wholesale rather than layered on top of the variant:
        // two competing `bg-*` utilities would resolve by Tailwind's own
        // stylesheet order, not by the order written here.
        muted ? MUTED_CLASSES : VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        loading && 'opacity-90',
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
