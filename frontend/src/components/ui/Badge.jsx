import { classNames } from '../../utils/classNames';

/**
 * Small status pill. One place owns the tone palette so a "paid" badge, an
 * "active" badge and an "in stock" badge can never drift apart visually.
 */
const TONE_CLASSES = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  brand: 'border-brand-200 bg-brand-50 text-brand-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
};

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({ tone = 'neutral', size = 'md', className, children }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold leading-none',
        TONE_CLASSES[tone] || TONE_CLASSES.neutral,
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        className
      )}
    >
      {children}
    </span>
  );
}
