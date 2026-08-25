import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/formatCurrency';
import { ROUTES } from '../../constants/routes';

/**
 * Cart totals + primary cart actions. Only shows figures the backend
 * actually returns (cart.total — see cartController.buildCartResponse) and
 * the item count CartContext derives from quantities; there is no separate
 * tax/shipping/discount concept in the API, so none is invented here.
 */
export function CartSummary({
  itemCount,
  total,
  isConfirmingClear,
  isClearing,
  clearError,
  onClearCart,
  onConfirmClear,
  onCancelClear,
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">Items</dt>
          <dd className="font-medium text-slate-900">{itemCount}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-base font-semibold">
          <dt className="text-slate-900">Total</dt>
          <dd className="text-slate-900">{formatCurrency(total)}</dd>
        </div>
      </dl>

      <Link to={ROUTES.CHECKOUT} className="mt-6 block">
        <Button fullWidth>Proceed to checkout</Button>
      </Link>

      <Link to={ROUTES.PRODUCTS} className="mt-3 block">
        <Button variant="outline" fullWidth>
          Continue shopping
        </Button>
      </Link>

      <div className="mt-6 border-t border-slate-100 pt-4">
        {clearError && (
          <p className="mb-2 text-xs text-red-600" role="alert">
            {clearError}
          </p>
        )}
        {isConfirmingClear ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="danger"
              size="sm"
              fullWidth
              onClick={onConfirmClear}
              loading={isClearing}
              disabled={isClearing}
            >
              Confirm clear cart
            </Button>
            <Button variant="outline" size="sm" fullWidth onClick={onCancelClear} disabled={isClearing}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" fullWidth onClick={onClearCart}>
            Clear cart
          </Button>
        )}
      </div>
    </div>
  );
}
