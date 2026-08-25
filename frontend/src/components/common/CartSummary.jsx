import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
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
    <div className="rounded-card border border-slate-200 bg-white shadow-card lg:sticky lg:top-28">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-semibold text-slate-900">Order summary</h2>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Items</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{itemCount}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-slate-100 pt-4">
            <dt className="text-base font-semibold text-slate-900">Total</dt>
            <dd className="text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">
              {formatCurrency(total)}
            </dd>
          </div>
        </dl>

        <Link to={ROUTES.CHECKOUT} className="mt-5 block">
          <Button fullWidth size="lg">
            Proceed to checkout
            <Icon name="arrowRight" size="sm" />
          </Button>
        </Link>

        <Link to={ROUTES.PRODUCTS} className="mt-3 block">
          <Button variant="outline" fullWidth>
            Continue shopping
          </Button>
        </Link>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Icon name="shield" size="xs" className="text-slate-400" />
          Payment is completed securely through PayHere
        </p>
      </div>

      <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
        {clearError && (
          <p className="mb-2 text-xs font-medium text-red-600" role="alert">
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
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={onCancelClear}
              disabled={isClearing}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" fullWidth onClick={onClearCart}>
            <Icon name="trash" size="sm" />
            Clear cart
          </Button>
        )}
      </div>
    </div>
  );
}
