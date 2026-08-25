import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { PaymentStatusPanel } from '../components/common/PaymentStatusPanel';
import { usePaymentStatus } from '../hooks/usePaymentStatus';
import { consumeLastOrderId } from '../utils/paymentSession';

/**
 * PayHere's configured return_url (backend/.env.example PAYHERE_RETURN_URL)
 * — reached either via the PayHere JS SDK's onCompleted callback (which
 * navigates here with ?orderId=..., see Checkout.jsx) or, for payment
 * methods that do a real browser redirect, a plain hit on this static URL.
 *
 * Either way this never assumes success: it re-fetches the order from the
 * backend and renders whatever `payment.status` actually is.
 */
export function PaymentReturn() {
  const [searchParams] = useSearchParams();
  // Lazy init so the one-shot sessionStorage fallback is read exactly once,
  // not re-consumed (and cleared) on every re-render while this hook polls.
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
