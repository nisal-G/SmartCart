import { Badge } from '../ui/Badge';
import { formatStatusLabel } from '../../constants/orderStatuses';

// One entry per backend/src/models/Order.js ORDER_STATUSES — fulfillment
// state only (never payment state, see Order.js's own comment on why the
// two are kept separate).
const ORDER_TONES = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'danger',
};

// One entry per backend/src/models/Order.js PAYMENT_STATUSES — mirrors the
// wording/tone already used by PaymentStatusPanel for the post-payment
// pages, so "paid"/"failed"/etc. read the same way everywhere in the app.
const PAYMENT_TONES = {
  paid: 'success',
  pending: 'warning',
  failed: 'danger',
  cancelled: 'danger',
  charged_back: 'neutral',
};

/**
 * Small pill showing either an order's fulfillment status or its payment
 * status — never inferring one from the other. Only ever renders a status
 * value the backend actually defines (Order.STATUSES / Order.PAYMENT_STATUSES);
 * anything unrecognized still renders (as neutral) rather than disappearing.
 */
export function OrderStatusBadge({ status, type = 'order' }) {
  if (!status) return null;
  const tone = (type === 'payment' ? PAYMENT_TONES : ORDER_TONES)[status] || 'neutral';

  return <Badge tone={tone}>{formatStatusLabel(status)}</Badge>;
}
