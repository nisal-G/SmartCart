import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { useCart } from '../hooks/useCart';
import orderService from '../services/orderService';
import paymentService from '../services/paymentService';
import { loadPayhereScript } from '../utils/loadPayhereScript';
import { rememberLastOrderId } from '../utils/paymentSession';
import { formatCurrency } from '../utils/formatCurrency';
import { ROUTES } from '../constants/routes';

/**
 * Checkout → PayHere payment (SRS §3.4 + the PayHere gateway integration).
 *
 * Flow:
 *   cart -> customer details -> POST /api/orders (orderService.checkout)
 *   -> POST /api/payments/payhere/session (paymentService) -> PayHere
 *   Checkout -> return/cancel -> authoritative order re-fetch
 *   (see PaymentReturn.jsx / PaymentCancel.jsx).
 *
 * This page never decides payment succeeded — it only gets as far as
 * *launching* PayHere Checkout. The result is always read from
 * `order.payment.status` on the return/cancel pages, never from anything
 * this page computes.
 *
 * Also doubles as the "retry payment" screen: reached as
 * `/checkout?retryOrderId=<id>` (from PaymentStatusPanel) for an order
 * whose payment is `failed`/`cancelled`. In that mode it loads the existing
 * order directly instead of the cart and skips order creation entirely —
 * paying again must never create a second order for the same purchase.
 */

const EMPTY_CUSTOMER = { phone: '', address: '', city: '', country: '' };

function validateCustomer(customer) {
  const errors = {};
  if (!customer.phone.trim()) errors.phone = 'Phone number is required';
  if (!customer.address.trim()) errors.address = 'Address is required';
  if (!customer.city.trim()) errors.city = 'City is required';
  if (!customer.country.trim()) errors.country = 'Country is required';
  return errors;
}

/** Normalizes cart line items and order line items (different shapes — see
 * cartController.buildCartResponse vs orderController.buildOrderItems) into
 * one shape this page's summary list can render either of. */
function normalizeLineItems(payingOrder, cart) {
  if (payingOrder) {
    return payingOrder.items.map((item, index) => ({
      key: `${item.product}-${index}`,
      name: item.name,
      image: null,
      unitPrice: item.price,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
    }));
  }
  return cart.items.map((item) => ({
    key: item.product.id,
    name: item.product.name,
    image: item.product.image,
    unitPrice: item.product.price,
    quantity: item.quantity,
    subtotal: item.subtotal,
  }));
}

export function Checkout() {
  const { cart, loading, error, loadCart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const retryOrderId = searchParams.get('retryOrderId');

  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [fieldErrors, setFieldErrors] = useState({});

  // The order this checkout attempt is for. Set once — either after
  // orderService.checkout() succeeds (normal path) or after loading an
  // existing order for a retry — and never cleared just because a later
  // step (payment session creation) fails, so a retry never creates a
  // second order for the same attempt (see handleProceedToPayment).
  const [payingOrder, setPayingOrder] = useState(null);
  const [loadingRetryOrder, setLoadingRetryOrder] = useState(Boolean(retryOrderId));
  const [retryOrderError, setRetryOrderError] = useState(null);

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [processError, setProcessError] = useState(null);

  // Retry path: load the existing order directly instead of the cart.
  // Written as an inline promise chain so every setState call is a literal
  // callback passed to .then/.catch/.finally, not a synchronous call in
  // the effect body itself — same convention as CartContext/AuthContext.
  useEffect(() => {
    if (!retryOrderId) return undefined;
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (!ignore) {
          setLoadingRetryOrder(true);
          setRetryOrderError(null);
        }
        return orderService.getOrderById(retryOrderId);
      })
      .then((loadedOrder) => {
        if (!ignore) setPayingOrder(loadedOrder);
      })
      .catch((err) => {
        if (!ignore) setRetryOrderError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoadingRetryOrder(false);
      });
    return () => {
      ignore = true;
    };
  }, [retryOrderId]);

  function updateField(field) {
    return (event) => {
      const { value } = event.target;
      setCustomer((prev) => ({ ...prev, [field]: value }));
      setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    };
  }

  async function launchPayhereCheckout(orderForPayment) {
    const payment = await paymentService.createPayhereSession(orderForPayment._id, customer);
    const payhere = await loadPayhereScript();

    // So the return/cancel pages can identify this order even if PayHere
    // does a full page redirect instead of firing the callbacks below.
    rememberLastOrderId(orderForPayment._id);

    payhere.onCompleted = () => {
      navigate(`${ROUTES.PAYMENT_RETURN}?orderId=${orderForPayment._id}`);
    };
    payhere.onDismissed = () => {
      navigate(`${ROUTES.PAYMENT_CANCEL}?orderId=${orderForPayment._id}`);
    };
    payhere.onError = (payhereError) => {
      setIsProcessingPayment(false);
      setProcessError(
        typeof payhereError === 'string' && payhereError
          ? payhereError
          : 'PayHere reported an error starting the payment. Please try again.'
      );
    };

    payhere.startPayment(payment);
    // isProcessingPayment intentionally stays true from here — the PayHere
    // popup is now in control. onDismissed/onError above turn it back off;
    // onCompleted navigates away instead.
  }

  async function handleProceedToPayment() {
    if (isProcessingPayment) return; // guards double clicks / duplicate requests

    const errors = validateCustomer(customer);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsProcessingPayment(true);
    setProcessError(null);
    try {
      // Reuse an order already created for this attempt (retry path, or a
      // prior click this session where order creation succeeded but
      // payment-session creation failed) instead of creating a second one.
      let orderForPayment = payingOrder;
      if (!orderForPayment) {
        orderForPayment = await orderService.checkout();
        setPayingOrder(orderForPayment);
        // The backend already cleared the cart as part of the same
        // transaction that created this order — reflect that immediately.
        loadCart();
      }
      await launchPayhereCheckout(orderForPayment);
    } catch (err) {
      setProcessError(err.message);
      setIsProcessingPayment(false);
    }
  }

  // --- Retrying payment for an order that already exists -------------------
  if (retryOrderId) {
    if (loadingRetryOrder) {
      return (
        <PageWrapper>
          <Loading label="Loading your order…" />
        </PageWrapper>
      );
    }
    if (retryOrderError || !payingOrder) {
      return (
        <PageWrapper>
          <ErrorMessage message={retryOrderError || 'Order not found.'} />
        </PageWrapper>
      );
    }
    if (payingOrder.payment.status === 'paid') {
      return (
        <PageWrapper>
          <div className="mx-auto max-w-lg text-center">
            <p className="text-slate-700">This order has already been paid.</p>
            <Link to={ROUTES.ORDERS} className="mt-4 inline-block">
              <Button>View orders</Button>
            </Link>
          </div>
        </PageWrapper>
      );
    }
  }

  // --- Normal path: cart loading/error/empty --------------------------------
  if (!retryOrderId) {
    if (loading) {
      return (
        <PageWrapper>
          <Loading label="Loading your cart…" />
        </PageWrapper>
      );
    }

    if (error) {
      return (
        <PageWrapper>
          <ErrorMessage message={error} onRetry={loadCart} />
        </PageWrapper>
      );
    }

    // Once an order has actually been created for this attempt, keep
    // showing the payment step even though the (now-cleared) cart is
    // empty — an in-flight payment-session retry must not bounce back to
    // an empty-cart screen with no way to finish paying.
    if (cart.items.length === 0 && !payingOrder) {
      return (
        <PageWrapper>
          <h1 className="mb-6 text-2xl font-semibold text-slate-900">Checkout</h1>
          <EmptyState
            title="Your cart is empty"
            description="Add products to your cart before proceeding to checkout."
            action={
              <Link to={ROUTES.PRODUCTS}>
                <Button>Continue shopping</Button>
              </Link>
            }
          />
        </PageWrapper>
      );
    }
  }

  const lineItems = normalizeLineItems(payingOrder, cart);
  const total = payingOrder ? payingOrder.total : cart.total;
  const totalQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <PageWrapper>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Order summary</h2>

            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white px-4 sm:px-6">
              {lineItems.map((item) => (
                <li key={item.key} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-slate-100">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">
                      {formatCurrency(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-900">
                    {formatCurrency(item.subtotal)}
                  </span>
                </li>
              ))}
            </ul>

            {!retryOrderId && (
              <Link
                to={ROUTES.CART}
                className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                ← Edit cart
              </Link>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Billing details</h2>
            <p className="mb-4 text-sm text-slate-500">
              Required by PayHere to process your payment.
            </p>

            <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2">
              <Input
                label="Phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={customer.phone}
                onChange={updateField('phone')}
                error={fieldErrors.phone}
              />
              <Input
                label="City"
                name="city"
                autoComplete="address-level2"
                value={customer.city}
                onChange={updateField('city')}
                error={fieldErrors.city}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Address"
                  name="address"
                  autoComplete="street-address"
                  value={customer.address}
                  onChange={updateField('address')}
                  error={fieldErrors.address}
                />
              </div>
              <Input
                label="Country"
                name="country"
                autoComplete="country-name"
                value={customer.country}
                onChange={updateField('country')}
                error={fieldErrors.country}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Total</h2>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Items</dt>
                <dd className="font-medium text-slate-900">{totalQuantity}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-base font-semibold">
                <dt className="text-slate-900">Total</dt>
                <dd className="text-slate-900">{formatCurrency(total)}</dd>
              </div>
            </dl>

            {processError && (
              <div className="mt-4">
                <ErrorMessage message={processError} onRetry={handleProceedToPayment} />
              </div>
            )}

            <Button
              fullWidth
              className="mt-6"
              onClick={handleProceedToPayment}
              loading={isProcessingPayment}
              disabled={isProcessingPayment}
            >
              {isProcessingPayment
                ? 'Processing…'
                : processError
                  ? 'Retry payment'
                  : 'Proceed to payment'}
            </Button>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
