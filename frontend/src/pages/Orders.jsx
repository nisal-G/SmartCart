import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { OrderList } from '../components/common/OrderList';
import { CardListSkeleton } from '../components/common/skeletons';
import { Pagination } from '../components/common/Pagination';
import orderService from '../services/orderService';
import { ROUTES } from '../constants/routes';

/**
 * Order history (/orders) — the authenticated user's own orders, newest
 * first, via GET /api/orders (orderService.getMyOrders). Pagination follows
 * the backend's own contract (page/limit query params, `pagination` object
 * in the response — see orderController.getMyOrders) rather than inventing
 * one client-side.
 */
export function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page'), 10) || 1;

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetches the current page from the server. Used both for the
  // auto-fetch-on-page-change effect below and as the manual "try again"
  // handler for ErrorMessage — the latter is called from a click handler,
  // not an effect body, so setting state directly here is fine there.
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await orderService.getMyOrders({ page });
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  // Fetch once per page change. Written as an inline promise chain so every
  // setState call happens inside a .then/.catch callback rather than
  // synchronously in the effect body — same convention as
  // CartContext/AuthContext/usePaymentStatus.
  useEffect(() => {
    Promise.resolve()
      .then(() => fetchOrders())
      .catch(() => {});
  }, [fetchOrders]);

  function goToPage(nextPage) {
    setSearchParams(nextPage > 1 ? { page: String(nextPage) } : {});
  }

  const header = (
    <PageHeader
      title="Your orders"
      description="Every order you've placed, with its fulfilment and payment status."
    />
  );

  if (loading) {
    return (
      <PageWrapper>
        {header}
        <CardListSkeleton count={3} />
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
        {header}
        <ErrorMessage message={error} onRetry={fetchOrders} />
      </PageWrapper>
    );
  }

  if (orders.length === 0) {
    return (
      <PageWrapper>
        {header}
        <EmptyState
          icon="receipt"
          title="You haven't placed any orders yet."
          description="Once you place an order, it will show up here with its status and total."
          action={
            <Link to={ROUTES.PRODUCTS}>
              <Button size="lg">
                Continue shopping
                <Icon name="arrowRight" size="sm" />
              </Button>
            </Link>
          }
        />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      {header}
      <OrderList orders={orders} />
      <Pagination pagination={pagination} onPageChange={goToPage} />
    </PageWrapper>
  );
}
