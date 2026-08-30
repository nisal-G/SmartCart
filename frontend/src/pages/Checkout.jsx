import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Icon } from '../components/ui/Icon';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { useCart } from '../hooks/useCart';
import orderService from '../services/orderService';
import paymentService from '../services/paymentService';
import { loadPayhereScript } from '../utils/loadPayhereScript';
import { rememberLastOrderId } from '../utils/paymentSession';
import { formatCurrency } from '../utils/formatCurrency';
import { classNames } from '../utils/classNames';
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

/**
 * Where the shopper is in the purchase flow. Reaching this page always means
 * the cart step is behind them and the payment step is ahead, so the states
 * are fixed rather than derived — it's an orientation cue, not a control.
 */
function CheckoutSteps() {
  const steps = [
    { label: 'Cart', icon: 'cart', state: 'done' },
    { label: 'Details', icon: 'user', state: 'current' },
    { label: 'Payment', icon: 'creditCard', state: 'upcoming' },
  ];

  return (
    <ol className="mb-8 flex items-center gap-2 overflow-x-auto rounded-card border border-slate-200/80 bg-white px-4 py-3.5 shadow-card scrollbar-none sm:gap-3 sm:px-6">
      {steps.map((step, index) => (
        <li key={step.label} className="flex shrink-0 items-center gap-2 sm:gap-3">
          {index > 0 && (
            <span className="h-px w-6 bg-slate-200 sm:w-10" aria-hidden="true" />
          )}
          <span
            className={classNames(
              'flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-colors',
              step.state === 'current' && 'bg-brand-50 text-brand-800',
              step.state === 'done' && 'text-brand-700',
              step.state === 'upcoming' && 'text-slate-400'
            )}
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <span
              className={classNames(
                'flex h-7 w-7 items-center justify-center rounded-full',
                step.state === 'current' && 'bg-brand-600 text-white shadow-brand',
                step.state === 'done' && 'bg-brand-100 text-brand-700',
                step.state === 'upcoming' && 'bg-slate-100 text-slate-400'
              )}
              aria-hidden="true"
            >
              <Icon name={step.state === 'done' ? 'check' : step.icon} size="sm" />
            </span>
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
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
          <div className="mx-auto max-w-lg">
            <EmptyState
              icon="checkCircle"
              title="This order has already been paid"
              description="Nothing further is needed — you can review it in your order history."
              action={
                <Link to={ROUTES.ORDERS}>
                  <Button>View orders</Button>
                </Link>
              }
            />
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
          <PageHeader title="Checkout" />
          <EmptyState
            icon="cart"
            title="Your cart is empty"
            description="Add products to your cart before proceeding to checkout."
            action={
              <Link to={ROUTES.PRODUCTS}>
                <Button size="lg">
                  Continue shopping
                  <Icon name="arrowRight" size="sm" />
                </Button>
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
      <PageHeader
        eyebrow="Secure checkout"
        title="Checkout"
        description={
          retryOrderId
            ? 'Complete the payment for your existing order.'
            : 'Review your items and enter the details PayHere needs to process your payment.'
        }
      />

      <CheckoutSteps />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* min-w-0: see the identical fix/comment in Cart.jsx — a long
            item name's nowrap intrinsic width can otherwise widen this
            grid track past the viewport on narrow screens. */}
        <div className="min-w-0 space-y-8 lg:col-span-2">
          <section>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Icon name="package" size="sm" className="text-brand-600" />Order summary</h2>
              {!retryOrderId && (
                <Link
                  to={ROUTES.CART}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
                >
                  <Icon name="arrowLeft" size="sm" />
                  Edit cart
                </Link>
              )}
            </div>

            <ul className="divide-y divide-slate-200/80 rounded-panel border border-slate-200/80 bg-white px-5 py-2 shadow-card sm:px-7 sm:py-3">
              {lineItems.map((item) => (
                <li key={item.key} className="flex items-center gap-4 py-4 first:pt-4 last:pb-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-card bg-slate-100 ring-1 ring-slate-200/70">
                    {item.image ? (
                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-slate-300">
                        <Icon name="package" size="md" strokeWidth={1.5} />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {formatCurrency(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                    {formatCurrency(item.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-900"><Icon name="user" size="sm" className="text-brand-600" />Billing details</h2>
            <p className="mb-4 text-sm text-slate-500">
              Required by PayHere to process your payment.
            </p>

            <div className="grid gap-5 rounded-panel border border-slate-200/80 bg-white p-6 shadow-card sm:grid-cols-2 sm:p-7">
              <Input
                label="Phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="07X XXX XXXX"
                value={customer.phone}
                onChange={updateField('phone')}
                error={fieldErrors.phone}
              />
              <Input
                label="City"
                name="city"
                autoComplete="address-level2"
                placeholder="Colombo"
                value={customer.city}
                onChange={updateField('city')}
                error={fieldErrors.city}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Address"
                  name="address"
                  autoComplete="street-address"
                  placeholder="Street address"
                  value={customer.address}
                  onChange={updateField('address')}
                  error={fieldErrors.address}
                />
              </div>
              <Input
                label="Country"
                name="country"
                autoComplete="country-name"
                placeholder="Sri Lanka"
                value={customer.country}
                onChange={updateField('country')}
                error={fieldErrors.country}
              />
            </div>
          </section>
        </div>

        <div className="lg:col-span-1">
          <div className="overflow-hidden rounded-panel border border-slate-200/80 bg-white shadow-card lg:sticky lg:top-32">
            <div className="border-b border-slate-100 bg-sunken/60 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">Summary</h2>
            </div>

            <div className="px-6 py-6">
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Items</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{totalQuantity}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-4">
                  <dt className="text-base font-bold text-slate-900">Total</dt>
                  <dd className="text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">
                    {formatCurrency(total)}
                  </dd>
                </div>
              </dl>

              {processError && (
                <div className="mt-4">
                  <ErrorMessage
                    title="Payment could not be started"
                    message={processError}
                    onRetry={handleProceedToPayment}
                  />
                </div>
              )}

              <Button
                fullWidth
                size="lg"
                className="mt-5"
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

              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
                <Icon name="shield" size="xs" className="text-slate-400" />
                You&apos;ll complete payment on PayHere
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
