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
    <div className="overflow-hidden rounded-panel border border-slate-200/80 bg-white shadow-card lg:sticky lg:top-32">
      <div className="border-b border-slate-100 bg-sunken/60 px-6 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Icon name="receipt" size="sm" className="text-brand-600" />
          Order summary
        </h2>
      </div>

      <div className="px-6 py-6">
        <dl className="space-y-3.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Items</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{itemCount}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-slate-100 pt-4">
            <dt className="text-base font-bold text-slate-900">Total</dt>
            <dd className="text-3xl font-extrabold tabular-nums tracking-tight text-slate-900">
              {formatCurrency(total)}
            </dd>
          </div>
        </dl>

        <Link to={ROUTES.CHECKOUT} className="mt-6 block">
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

        <p className="mt-5 flex items-center justify-center gap-1.5 rounded-control bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          <Icon name="shield" size="xs" className="text-brand-600" />
          Payment is completed securely through PayHere
        </p>
      </div>

      <div className="border-t border-slate-100 px-6 py-4">
        {clearError && (
          <p className="mb-2 text-xs font-semibold text-red-600" role="alert">
            {clearError}
          </p>
        )}
        {isConfirmingClear ? (
          <div className="flex animate-fade-in flex-col gap-2 sm:flex-row">
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
