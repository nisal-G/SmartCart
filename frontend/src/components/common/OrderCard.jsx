import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { OrderStatusBadge } from './OrderStatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { orderDetailsPath } from '../../constants/routes';

/** Last-8-characters, uppercased — a short, user-friendly stand-in for the
 * full Mongo id. The full id is still used for the actual API/navigation
 * (see orderDetailsPath), this is display-only. */
function shortOrderId(id) {
  return `#${String(id).slice(-8).toUpperCase()}`;
}

/**
 * One order summary in the order history list (/orders). Only ever renders
 * fields GET /api/orders actually returns for an order — see
 * backend/src/controllers/orderController.js's toOrderDTO.
 */
export function OrderCard({ order }) {
  const { _id, items, total, status, payment, createdAt } = order;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <li className="group overflow-hidden rounded-card border border-slate-200/80 bg-white shadow-card transition-[box-shadow,border-color,transform] duration-300 ease-entrance hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-sunken/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-white text-brand-600 shadow-xs ring-1 ring-slate-200 transition-colors duration-300 group-hover:bg-brand-600 group-hover:text-white"
            aria-hidden="true"
          >
            <Icon name="receipt" size="md" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold tracking-tight text-slate-900" title={_id}>
              {shortOrderId(_id)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{formatDate(createdAt)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={status} type="order" />
          {payment?.status && <OrderStatusBadge status={payment.status} type="payment" />}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
          <div className="flex items-center gap-2">
            <dt className="text-slate-500">Items</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{itemCount}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-slate-500">Total</dt>
            <dd className="font-extrabold tabular-nums tracking-tight text-slate-900">
              {formatCurrency(total)}
            </dd>
          </div>
        </dl>

        <Link to={orderDetailsPath(_id)}>
          <Button variant="outline" size="sm">
            View details
            <Icon name="chevronRight" size="sm" />
          </Button>
        </Link>
      </div>
    </li>
  );
}
