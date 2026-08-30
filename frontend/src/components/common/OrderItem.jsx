import { Icon } from '../ui/Icon';
import { formatCurrency } from '../../utils/formatCurrency';

/**
 * One historical line item on the Order Details page. Renders exactly what
 * the order snapshotted at checkout — see backend/src/models/Order.js's
 * orderItemSchema (product, name, price, quantity) — never a current
 * Product price, and never a product image, since the order never stored
 * one (see orderController.buildOrderItems).
 */
export function OrderItem({ item }) {
  const { name, price, quantity } = item;
  const subtotal = price * quantity;

  return (
    <li className="flex items-center gap-4 py-4">
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-linear-to-br from-slate-50 to-slate-100 text-slate-300 ring-1 ring-slate-200/70"
        aria-hidden="true"
      >
        <Icon name="package" size="md" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
        <p className="mt-0.5 text-sm text-slate-500">
          {formatCurrency(price)} × {quantity}
        </p>
      </div>
      <span className="shrink-0 text-sm font-extrabold tabular-nums text-slate-900">
        {formatCurrency(subtotal)}
      </span>
    </li>
  );
}
