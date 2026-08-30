import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { CartList } from '../components/common/CartList';
import { CartSummary } from '../components/common/CartSummary';
import { useCart } from '../hooks/useCart';
import { ROUTES } from '../constants/routes';

/**
 * Shopping cart (SRS §3.3). Renders CartContext's server-owned state
 * directly — no second copy of the cart is kept here. Item-level pending
 * state (`pendingActions`) and per-item/clear errors are local UI concerns:
 * CartContext's mutators (addItem/updateItemQuantity/removeItem/clearCart)
 * intentionally don't manage loading/error themselves for these calls (see
 * context/CartContext.jsx), so a failed item update surfaces only next to
 * that item, leaving the rest of the cart usable.
 */
export function Cart() {
  const { cart, itemCount, loading, error, loadCart, updateItemQuantity, removeItem, clearCart } =
    useCart();

  // productId -> 'update' | 'remove', for whichever item currently has an
  // in-flight request.
  const [pendingActions, setPendingActions] = useState({});
  // productId -> sanitized error message from the last failed operation on it.
  const [itemErrors, setItemErrors] = useState({});

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState(null);

  function setPending(productId, action) {
    setPendingActions((prev) => {
      const next = { ...prev };
      if (action) {
        next[productId] = action;
      } else {
        delete next[productId];
      }
      return next;
    });
  }

  function setItemError(productId, message) {
    setItemErrors((prev) => {
      const next = { ...prev };
      if (message) {
        next[productId] = message;
      } else {
        delete next[productId];
      }
      return next;
    });
  }

  async function changeQuantity(productId, nextQuantity) {
    // The backend rejects quantity < 1 on PUT /cart/items/:productId
    // (removal is DELETE's job) — never send it one.
    if (nextQuantity < 1 || pendingActions[productId]) return;
    setPending(productId, 'update');
    setItemError(productId, null);
    try {
      await updateItemQuantity(productId, nextQuantity);
    } catch (err) {
      setItemError(productId, err.message);
    } finally {
      setPending(productId, null);
    }
  }

  function handleIncrease(productId, currentQuantity) {
    changeQuantity(productId, currentQuantity + 1);
  }

  function handleDecrease(productId, currentQuantity) {
    changeQuantity(productId, currentQuantity - 1);
  }

  async function handleRemove(productId) {
    if (pendingActions[productId]) return;
    setPending(productId, 'remove');
    setItemError(productId, null);
    try {
      await removeItem(productId);
    } catch (err) {
      setItemError(productId, err.message);
    } finally {
      setPending(productId, null);
    }
  }

  function handleClearCartClick() {
    setClearError(null);
    setIsConfirmingClear(true);
  }

  function handleCancelClear() {
    setIsConfirmingClear(false);
    setClearError(null);
  }

  async function handleConfirmClear() {
    setIsClearing(true);
    setClearError(null);
    try {
      await clearCart();
      setIsConfirmingClear(false);
    } catch (err) {
      setClearError(err.message);
    } finally {
      setIsClearing(false);
    }
  }

  if (loading) {
    return (
      <PageWrapper>
        <PageHeader eyebrow="Your basket" title="Your cart" />
        <div className="grid gap-8 lg:grid-cols-3" aria-hidden="true">
          <div className="space-y-4 lg:col-span-2">
            {[0, 1].map((row) => (
              <div
                key={row}
                className="flex items-center gap-4 rounded-card border border-slate-200/80 bg-white p-5 shadow-card"
              >
                <Skeleton className="h-20 w-20 shrink-0 rounded-card" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-10 w-28 rounded-control" />
              </div>
            ))}
          </div>
          <Skeleton className="h-80 w-full rounded-panel" />
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
        <PageHeader eyebrow="Your basket" title="Your cart" />
        <ErrorMessage message={error} onRetry={loadCart} />
      </PageWrapper>
    );
  }

  if (cart.items.length === 0) {
    return (
      <PageWrapper>
        <PageHeader eyebrow="Your basket" title="Your cart" />
        <EmptyState
          icon="cart"
          title="Your cart is empty"
          description="Browse the catalogue and add something you like — your cart is saved to your account."
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

  return (
    <PageWrapper>
      <PageHeader
        eyebrow="Your basket"
        title="Your cart"
        description={`${itemCount} ${itemCount === 1 ? 'item' : 'items'} ready for checkout.`}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* min-w-0: without it, this grid item's default min-width:auto lets
            a long product name's intrinsic (nowrap) text width bubble up
            through the grid track, defeating CartItem's own clamping and
            overflowing narrow viewports horizontally — see the regression
            test in responsive/responsive.spec.js. */}
        <div className="min-w-0 lg:col-span-2">
          <CartList
            items={cart.items}
            pendingActions={pendingActions}
            itemErrors={itemErrors}
            onIncrease={handleIncrease}
            onDecrease={handleDecrease}
            onRemove={handleRemove}
          />

          {/* The "Continue shopping" CTA lives in CartSummary only — one
              per page, so the two don't compete on mobile where the
              summary stacks directly under this list. */}
        </div>

        <div className="lg:col-span-1">
          <CartSummary
            itemCount={itemCount}
            total={cart.total}
            isConfirmingClear={isConfirmingClear}
            isClearing={isClearing}
            clearError={clearError}
            onClearCart={handleClearCartClick}
            onConfirmClear={handleConfirmClear}
            onCancelClear={handleCancelClear}
          />
        </div>
      </div>
    </PageWrapper>
  );
}
