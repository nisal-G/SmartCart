import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/formatCurrency';

/**
 * Single cart line item. Renders only fields the backend actually returns
 * for a cart item (see backend/src/controllers/cartController.js —
 * buildCartResponse): product.{id,name,price,image}, quantity, subtotal.
 *
 * Quantity changes and removal are delegated to the parent (Cart page),
 * which owns the pending/error state per product id — this component is
 * purely presentational plus the two control callbacks.
 */
export function CartItem({ item, onIncrease, onDecrease, onRemove, isUpdating, isRemoving, errorMessage }) {
  const { product, quantity, subtotal } = item;
  const busy = isUpdating || isRemoving;

  return (
    <li className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-4">
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-slate-100">
          {product.image ? (
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
          <p className="text-sm text-slate-500">{formatCurrency(product.price)} each</p>
          {errorMessage && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <div className="flex items-center rounded-md border border-slate-300">
          <button
            type="button"
            onClick={() => onDecrease(product.id, quantity)}
            disabled={busy || quantity <= 1}
            className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Decrease quantity of ${product.name}`}
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-medium" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => onIncrease(product.id, quantity)}
            disabled={busy}
            className="px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Increase quantity of ${product.name}`}
          >
            +
          </button>
        </div>

        <span className="w-20 shrink-0 text-right text-sm font-semibold text-slate-900">
          {formatCurrency(subtotal)}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onRemove(product.id)}
          loading={isRemoving}
          disabled={busy}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
