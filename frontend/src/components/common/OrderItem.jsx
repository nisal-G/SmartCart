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
    <li className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400">
        No image
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        <p className="text-sm text-slate-500">
          {formatCurrency(price)} × {quantity}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-slate-900">
        {formatCurrency(subtotal)}
      </span>
    </li>
  );
}
