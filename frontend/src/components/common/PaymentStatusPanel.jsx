import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Loading } from './Loading';
import { ErrorMessage } from './ErrorMessage';
import { formatCurrency } from '../../utils/formatCurrency';
import { ROUTES } from '../../constants/routes';

// One entry per backend/src/models/Order.js PAYMENT_STATUSES. Wording only
// — no financial/legal claims invented, and 'charged_back' is deliberately
// neutral rather than framed as success or failure.
const STATUS_COPY = {
  paid: { title: 'Payment successful', tone: 'success' },
  pending: { title: 'Payment is being processed', tone: 'pending' },
  failed: { title: 'Payment failed', tone: 'error' },
  cancelled: { title: 'Payment cancelled', tone: 'error' },
  charged_back: { title: 'Payment charged back', tone: 'neutral' },
};

const TONE_CLASSES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  neutral: 'border-slate-200 bg-slate-50 text-slate-800',
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

  return (
    <div className="mx-auto max-w-lg">
      <div className={`rounded-lg border p-6 text-center sm:p-8 ${TONE_CLASSES[copy.tone]}`}>
        <h1 className="text-2xl font-semibold">{copy.title}</h1>

        {status === 'pending' && (
          <p className="mt-2 text-sm">
            We&apos;re waiting for confirmation from PayHere — this can take a few moments.
          </p>
        )}
        {status === 'charged_back' && (
          <p className="mt-2 text-sm">This payment was later reversed by the card issuer/bank.</p>
        )}

        <dl className="mt-6 space-y-2 rounded-md border border-black/5 bg-white/70 p-4 text-left text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt>Order ID</dt>
            <dd className="truncate font-mono text-xs font-medium">{order._id}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt>Payment status</dt>
            <dd className="font-medium capitalize">{status.replace('_', ' ')}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-black/5 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatCurrency(order.total)}</dd>
          </div>
        </dl>

        {status === 'pending' && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRefresh} loading={loading}>
            {polling ? 'Checking…' : 'Check again'}
          </Button>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
            <Button variant="secondary" fullWidth>
              Continue shopping
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
