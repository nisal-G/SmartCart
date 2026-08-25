import { classNames } from '../../utils/classNames';

/**
 * Control styling shared by Input/Select/Textarea. Lives in its own module
 * (rather than alongside the Field component) so those files only ever
 * export components — the project's react-refresh lint rule.
 */
export const CONTROL_CLASSES = classNames(
  'w-full rounded-control border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-xs',
  'transition-[border-color,box-shadow] duration-150 ease-out',
  'placeholder:text-slate-400',
  'focus:outline-none focus:ring-4',
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'
);

export const CONTROL_TONE = {
  normal: 'border-slate-300 hover:border-slate-400 focus:border-brand-500 focus:ring-brand-500/15',
  error: 'border-red-400 focus:border-red-500 focus:ring-red-500/15',
};
