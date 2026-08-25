import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { formatCurrency } from '../../utils/formatCurrency';
import { productDetailsPath } from '../../constants/routes';
import { classNames } from '../../utils/classNames';

/**
 * Single cart line item. Renders only fields the backend actually returns
 * for a cart item (see backend/src/controllers/cartController.js —
 * buildCartResponse): product.{id,name,price,image}, quantity, subtotal.
 *
 * Quantity changes and removal are delegated to the parent (Cart page),
 * which owns the pending/error state per product id — this component is
 * purely presentational plus the two control callbacks.
 */
export function CartItem({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  isUpdating,
  isRemoving,
  errorMessage,
}) {
  const { product, quantity, subtotal } = item;
  const busy = isUpdating || isRemoving;

  const stepperButton =
    'flex h-10 w-10 items-center justify-center text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <li
      className={classNames(
        'flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-5',
        busy && 'opacity-70'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Link
          to={productDetailsPath(product.id)}
          className="h-20 w-20 shrink-0 overflow-hidden rounded-card bg-slate-100 ring-1 ring-slate-200/70 transition-opacity hover:opacity-90 sm:h-24 sm:w-24"
          tabIndex={-1}
          aria-hidden="true"
        >
          {product.image ? (
            <img src={product.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-slate-300">
              <Icon name="package" size="lg" strokeWidth={1.5} />
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to={productDetailsPath(product.id)}
            className="line-clamp-2 text-sm font-semibold text-slate-900 transition-colors hover:text-brand-700 sm:text-base"
          >
            {product.name}
          </Link>
          <p className="mt-1 text-sm text-slate-500">{formatCurrency(product.price)} each</p>
          {errorMessage && (
            <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end sm:gap-5">
        <div className="flex h-10 items-center rounded-control border border-slate-300 bg-white">
          <button
            type="button"
            onClick={() => onDecrease(product.id, quantity)}
            disabled={busy || quantity <= 1}
            className={classNames(stepperButton, 'rounded-l-control')}
            aria-label={`Decrease quantity of ${product.name}`}
          >
            <Icon name="minus" size="sm" strokeWidth={2.25} />
          </button>
          <span
            className="w-9 text-center text-sm font-semibold tabular-nums text-slate-900"
            aria-live="polite"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => onIncrease(product.id, quantity)}
            disabled={busy}
            className={classNames(stepperButton, 'rounded-r-control')}
            aria-label={`Increase quantity of ${product.name}`}
          >
            <Icon name="plus" size="sm" strokeWidth={2.25} />
          </button>
        </div>

        <span className="w-24 shrink-0 text-right text-base font-bold tabular-nums text-slate-900">
          {formatCurrency(subtotal)}
        </span>

        <button
          type="button"
          onClick={() => onRemove(product.id)}
          disabled={busy}
          className="inline-flex h-10 items-center gap-1.5 rounded-control px-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRemoving ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
          ) : (
            <Icon name="trash" size="sm" />
          )}
          Remove
        </button>
      </div>
    </li>
  );
}
