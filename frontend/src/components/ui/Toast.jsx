import { Icon } from './Icon';
import { classNames } from '../../utils/classNames';

const TONE_CLASSES = {
  success: 'border-emerald-200 bg-white text-slate-900',
  error: 'border-red-200 bg-white text-slate-900',
};

const ICON_CLASSES = {
  success: 'bg-emerald-100 text-emerald-600',
  error: 'bg-red-100 text-red-600',
};

/**
 * Fixed bottom-right toast stack. Each toast is its own `role="status"` /
 * `aria-live="polite"` region (rather than one shared region for the whole
 * stack) so a screen reader announces each toast as it lands — the same
 * live-region convention SuccessMessage/ErrorMessage already use elsewhere.
 *
 * Rendered by ToastContext's provider; never imported directly by a page.
 */
export function ToastViewport({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className={classNames(
            'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-card border px-4 py-3.5 shadow-float',
            t.leaving ? 'animate-toast-out' : 'animate-toast-in',
            TONE_CLASSES[t.tone] || TONE_CLASSES.success
          )}
        >
          <span
            className={classNames(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
              ICON_CLASSES[t.tone] || ICON_CLASSES.success
            )}
            aria-hidden="true"
          >
            <Icon name={t.tone === 'error' ? 'alert' : 'checkCircle'} size="sm" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium text-slate-800">{t.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="shrink-0 rounded-control p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      ))}
    </div>
  );
}
