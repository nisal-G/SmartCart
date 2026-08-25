import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
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
    <li className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-sm font-medium text-slate-900" title={_id}>
            {shortOrderId(_id)}
          </p>
          <p className="text-xs text-slate-500">{formatDate(createdAt)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={status} type="order" />
          {payment?.status && <OrderStatusBadge status={payment.status} type="payment" />}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <dt className="text-slate-500">Items</dt>
            <dd className="font-medium text-slate-900">{itemCount}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-slate-500">Total</dt>
            <dd className="font-medium text-slate-900">{formatCurrency(total)}</dd>
          </div>
        </dl>

        <Link to={orderDetailsPath(_id)}>
          <Button variant="outline" size="sm">
            View details
          </Button>
        </Link>
      </div>
    </li>
  );
}
