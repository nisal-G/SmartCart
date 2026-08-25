import { OrderCard } from './OrderCard';

/** Renders the authenticated user's orders (/orders). Callers own loading/error/empty states. */
export function OrderList({ orders }) {
  return (
    <ul className="space-y-4">
      {orders.map((order) => (
        <OrderCard key={order._id} order={order} />
      ))}
    </ul>
  );
}
