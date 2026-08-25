import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { PaymentStatusPanel } from '../components/common/PaymentStatusPanel';
import { usePaymentStatus } from '../hooks/usePaymentStatus';
import { consumeLastOrderId } from '../utils/paymentSession';

/**
 * PayHere's configured cancel_url (backend/.env.example PAYHERE_CANCEL_URL)
 * — reached either via the PayHere JS SDK's onDismissed callback (which
 * navigates here with ?orderId=..., see Checkout.jsx) or a real browser
 * redirect for payment methods that use one.
 *
 * "The shopper cancelled" is not the same fact as "the payment failed" —
 * a notify_url call can still land and mark it `paid`, or it may genuinely
 * be `pending`/`failed`. So, same as PaymentReturn, this defers entirely to
 * the authoritative order fetched from the backend rather than assuming
 * the outcome from how the page was reached.
 */
export function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const [orderId] = useState(() => searchParams.get('orderId') || consumeLastOrderId());
  const { order, loading, error, polling, refresh } = usePaymentStatus(orderId);

  return (
    <PageWrapper>
      <PaymentStatusPanel
        orderId={orderId}
        order={order}
        loading={loading}
        error={error}
        polling={polling}
        onRefresh={refresh}
      />
    </PageWrapper>
  );
}
