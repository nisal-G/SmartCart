import { classNames } from '../../utils/classNames';

// One entry per backend/src/models/Order.js ORDER_STATUSES — fulfillment
// state only (never payment state, see Order.js's own comment on why the
// two are kept separate).
const ORDER_TONE_CLASSES = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  cancelled: 'border-red-200 bg-red-50 text-red-800',
};

// One entry per backend/src/models/Order.js PAYMENT_STATUSES — mirrors the
// wording/tone already used by PaymentStatusPanel for the post-payment
// pages, so "paid"/"failed"/etc. read the same way everywhere in the app.
const PAYMENT_TONE_CLASSES = {
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  failed: 'border-red-200 bg-red-50 text-red-800',
  cancelled: 'border-red-200 bg-red-50 text-red-800',
  charged_back: 'border-slate-200 bg-slate-50 text-slate-800',
};

const FALLBACK_TONE_CLASSES = 'border-slate-200 bg-slate-50 text-slate-700';

/** "charged_back" -> "Charged back" */
function formatLabel(status) {
  const words = String(status).split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Small pill showing either an order's fulfillment status or its payment
 * status — never inferring one from the other. Only ever renders a status
 * value the backend actually defines (Order.STATUSES / Order.PAYMENT_STATUSES);
 * anything unrecognized still renders (as neutral) rather than disappearing.
 */
export function OrderStatusBadge({ status, type = 'order' }) {
  if (!status) return null;
  const toneClasses =
    (type === 'payment' ? PAYMENT_TONE_CLASSES : ORDER_TONE_CLASSES)[status] ||
    FALLBACK_TONE_CLASSES;

  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        toneClasses
      )}
    >
      {formatLabel(status)}
    </span>
  );
}
