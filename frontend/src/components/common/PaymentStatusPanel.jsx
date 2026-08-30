import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Loading } from './Loading';
import { ErrorMessage } from './ErrorMessage';
import { formatCurrency } from '../../utils/formatCurrency';
import { ROUTES } from '../../constants/routes';

// One entry per backend/src/models/Order.js PAYMENT_STATUSES. Wording only
// — no financial/legal claims invented, and 'charged_back' is deliberately
// neutral rather than framed as success or failure.
const STATUS_COPY = {
  paid: { title: 'Payment successful', tone: 'success', icon: 'checkCircle' },
  pending: { title: 'Payment is being processed', tone: 'pending', icon: 'clock' },
  failed: { title: 'Payment failed', tone: 'error', icon: 'alert' },
  cancelled: { title: 'Payment cancelled', tone: 'error', icon: 'alert' },
  charged_back: { title: 'Payment charged back', tone: 'neutral', icon: 'info' },
};

// Each tone owns the whole panel's treatment — the top accent bar, the
// icon's halo and the icon itself — so the status reads at a glance before
// a single word is processed.
const TONE_CLASSES = {
  success: {
    bar: 'bg-linear-to-r from-emerald-400 via-brand-500 to-emerald-400',
    halo: 'bg-emerald-50 ring-emerald-100',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  pending: {
    bar: 'bg-linear-to-r from-amber-300 via-amber-500 to-amber-300',
    halo: 'bg-amber-50 ring-amber-100',
    badge: 'bg-amber-100 text-amber-700',
  },
  error: {
    bar: 'bg-linear-to-r from-red-400 via-red-500 to-red-400',
    halo: 'bg-red-50 ring-red-100',
    badge: 'bg-red-100 text-red-700',
  },
  neutral: {
    bar: 'bg-linear-to-r from-slate-300 via-slate-400 to-slate-300',
    halo: 'bg-slate-50 ring-slate-100',
    badge: 'bg-slate-100 text-slate-600',
  },
};

const RETRYABLE_STATUSES = new Set(['failed', 'cancelled']);

/**
 * Renders the result of a PayHere checkout attempt from `order.payment.status`
 * alone — never from URL params, browser state, or anything carried across
 * the redirect (see usePaymentStatus, which fetches this from the backend).
 *
 * Shared by /payment/return and /payment/cancel: both routes land the
 * shopper here after leaving PayHere, and the authoritative outcome can
 * genuinely be anything (a "cancel" redirect can still resolve to `paid`
 * if the notification already landed) — so both pages defer to the same
 * status-driven UI rather than assuming their entry point implies a result.
 */
export function PaymentStatusPanel({ orderId, order, loading, error, polling, onRefresh }) {
  if (loading && !order) {
    return <Loading label="Checking your payment status…" />;
  }

  if (!orderId) {
    return (
      <ErrorMessage message="We couldn't identify which order this payment was for. Check your order history instead." />
    );
  }

  if (error && !order) {
    return <ErrorMessage message={error} onRetry={onRefresh} />;
  }

  if (!order) {
    return <ErrorMessage message="We couldn't find that order. Check your order history instead." />;
  }

  const status = order.payment?.status || 'pending';
  const copy = STATUS_COPY[status] || STATUS_COPY.pending;
  const tone = TONE_CLASSES[copy.tone];

  return (
    <div className="mx-auto max-w-xl py-4 sm:py-8">
      <div className="animate-scale-in overflow-hidden rounded-panel border border-slate-200/80 bg-white text-center shadow-panel">
        <div className={`h-1.5 w-full ${tone.bar}`} aria-hidden="true" />

        <div className="p-6 sm:p-9">
          <span
            className={`mx-auto flex h-18 w-18 items-center justify-center rounded-full ring-8 ${tone.halo}`}
            aria-hidden="true"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full ${tone.badge}`}
            >
              <Icon name={copy.icon} size="xl" />
            </span>
          </span>

          <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {copy.title}
          </h1>

          {status === 'pending' && (
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              We&apos;re waiting for confirmation from PayHere — this can take a few moments.
            </p>
          )}
          {status === 'charged_back' && (
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              This payment was later reversed by the card issuer/bank.
            </p>
          )}

          <dl className="mt-7 space-y-3.5 rounded-card border border-slate-200 bg-sunken/70 p-5 text-left text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Order ID</dt>
              <dd className="truncate font-mono text-xs font-semibold text-slate-900">
                {order._id}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Payment status</dt>
              {/* Rendered as the backend's own status value (lower case, with
                  underscores spaced out) — capitalisation is presentational
                  only, so the underlying text stays the API's wording. */}
              <dd className="font-semibold capitalize text-slate-900">
                {status.replace('_', ' ')}
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-slate-200 pt-3.5">
              <dt className="font-bold text-slate-900">Total</dt>
              <dd className="text-xl font-extrabold tabular-nums tracking-tight text-slate-900">
                {formatCurrency(order.total)}
              </dd>
            </div>
          </dl>

          {status === 'pending' && (
            <Button
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={onRefresh}
              loading={loading}
            >
              {polling ? 'Checking…' : 'Check again'}
            </Button>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {RETRYABLE_STATUSES.has(status) && (
              <Link to={`${ROUTES.CHECKOUT}?retryOrderId=${order._id}`} className="flex-1">
                <Button fullWidth>Retry payment</Button>
              </Link>
            )}
            <Link to={ROUTES.ORDERS} className="flex-1">
              <Button variant="outline" fullWidth>
                View orders
              </Button>
            </Link>
            <Link to={ROUTES.PRODUCTS} className="flex-1">
              <Button variant="ghost" fullWidth>
                Continue shopping
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
