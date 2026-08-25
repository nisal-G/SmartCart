import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { OrderList } from '../components/common/OrderList';
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

  if (loading) {
    return (
      <PageWrapper>
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Your orders</h1>
        <Loading label="Loading your orders…" />
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Your orders</h1>
        <ErrorMessage message={error} onRetry={fetchOrders} />
      </PageWrapper>
    );
  }

  if (orders.length === 0) {
    return (
      <PageWrapper>
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Your orders</h1>
        <EmptyState
          title="You haven't placed any orders yet."
          description="Once you place an order, it will show up here."
          action={
            <Link to={ROUTES.PRODUCTS}>
              <Button>Continue shopping</Button>
            </Link>
          }
        />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Your orders</h1>

      <OrderList orders={orders} />

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <p className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page + 1)}
            disabled={page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </PageWrapper>
  );
}
