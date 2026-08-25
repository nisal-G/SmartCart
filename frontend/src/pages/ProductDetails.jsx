import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import productService from '../services/productService';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatCurrency';
import { ROUTES } from '../constants/routes';

/** Matches the real page's two-column layout so nothing jumps when the product lands. */
function ProductDetailsSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12" aria-hidden="true">
      <Skeleton className="aspect-square w-full rounded-panel" />
      <div className="space-y-4 pt-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-56 rounded-control" />
      </div>
    </div>
  );
}

/** Product details (SRS §3.2) — public browsing, with Add to Cart wired to CartContext. */
export function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [addState, setAddState] = useState('idle'); // idle | adding | added | error
  const [addError, setAddError] = useState(null);

  // Written as an inline promise chain (rather than calling setLoading/setError
  // synchronously) so every setState call is a literal callback passed to
  // .then/.catch/.finally, same pattern as context/CartContext.jsx.
  const fetchProduct = useCallback(() => {
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (ignore) return undefined;
        setLoading(true);
        setError(null);
        setNotFound(false);
        return productService.getProductById(id);
      })
      .then((data) => {
        if (ignore || !data) return;
        setProduct(data);
      })
      .catch((err) => {
        if (ignore) return;
        if (err.status === 404) {
          setNotFound(true);
        } else if (err.status === 400) {
          // The backend rejects a malformed id (not a valid Mongo ObjectId)
          // before it ever looks it up — surface that distinctly from "not found".
          setError('Invalid product ID.');
        } else {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  useEffect(() => fetchProduct(), [fetchProduct]);

  async function handleAddToCart() {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN, { state: { from: location } });
      return;
    }
    setAddState('adding');
    setAddError(null);
    try {
      await addItem(product._id, quantity);
      setAddState('added');
    } catch (err) {
      setAddState('error');
      setAddError(err.message);
    }
  }

  if (loading) {
    return (
      <PageWrapper>
        <ProductDetailsSkeleton />
      </PageWrapper>
    );
  }

  if (notFound) {
    return (
      <PageWrapper>
        <EmptyState
          title="Product not found"
          description="This product may have been removed, or the link is incorrect."
          action={
            <Link to={ROUTES.PRODUCTS}>
              <Button variant="outline">Back to products</Button>
            </Link>
          }
        />
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
        <ErrorMessage message={error} onRetry={fetchProduct} />
      </PageWrapper>
    );
  }

  if (!product) {
    return null;
  }

  const isAvailable = product.isActive !== false;

  return (
    <PageWrapper>
      <Breadcrumbs
        items={[
          { label: 'Home', to: ROUTES.HOME },
          { label: 'Products', to: ROUTES.PRODUCTS },
          { label: product.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="overflow-hidden rounded-panel border border-slate-200 bg-white p-3 shadow-card">
          <div className="aspect-square w-full overflow-hidden rounded-card bg-slate-100">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-300">
                <Icon name="package" size="xl" strokeWidth={1.5} className="h-12 w-12" />
                <span className="text-sm font-medium text-slate-400">No image</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          {/* The category is only a link when the API actually populated it
              (it can come back as a bare id) — never a link to nowhere. */}
          {product.category?.name &&
            (product.category._id ? (
              <Link
                to={`${ROUTES.PRODUCTS}?category=${product.category._id}`}
                className="text-xs font-semibold uppercase tracking-wider text-brand-700 transition-colors hover:text-brand-800"
              >
                {product.category.name}
              </Link>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                {product.category.name}
              </span>
            ))}

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {product.name}
          </h1>

          <p className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
            {formatCurrency(product.price)}
          </p>

          <div className="mt-3">
            {isAvailable ? (
              <Badge tone="success">
                <Icon name="check" size="xs" strokeWidth={2.5} />
                In stock
              </Badge>
            ) : (
              <Badge tone="danger">
                <Icon name="alert" size="xs" />
                Currently unavailable
              </Badge>
            )}
          </div>

          {product.description && (
            <div className="mt-6 border-t border-slate-200 pt-6">
              <h2 className="text-sm font-semibold text-slate-900">Description</h2>
              <p className="mt-2 leading-relaxed text-slate-600">{product.description}</p>
            </div>
          )}

          {isAvailable && (
            <div className="mt-8 rounded-card border border-slate-200 bg-white p-4 shadow-card sm:p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-500">Quantity</span>
                  <div className="flex h-11 items-center rounded-control border border-slate-300 bg-white">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="flex h-full w-11 items-center justify-center rounded-l-control text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                      aria-label="Decrease quantity"
                    >
                      <Icon name="minus" size="sm" strokeWidth={2.25} />
                    </button>
                    <span
                      className="w-10 text-center text-sm font-semibold tabular-nums text-slate-900"
                      aria-live="polite"
                    >
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="flex h-full w-11 items-center justify-center rounded-r-control text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                      aria-label="Increase quantity"
                    >
                      <Icon name="plus" size="sm" strokeWidth={2.25} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 self-end">
                  <Button
                    size="lg"
                    fullWidth
                    onClick={handleAddToCart}
                    loading={addState === 'adding'}
                    disabled={addState === 'adding'}
                  >
                    <Icon name="cart" size="md" />
                    Add to cart
                  </Button>
                </div>
              </div>

              {addState === 'added' && (
                <div
                  className="mt-4 flex animate-fade-in items-center justify-between gap-3 rounded-control border border-emerald-200 bg-emerald-50 px-3 py-2.5"
                  role="status"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <Icon name="checkCircle" size="sm" className="text-emerald-600" />
                    Added to cart.
                  </span>
                  <Link
                    to={ROUTES.CART}
                    className="shrink-0 text-sm font-semibold text-emerald-800 underline-offset-2 hover:underline"
                  >
                    View cart
                  </Link>
                </div>
              )}
              {addState === 'error' && addError && (
                <p className="mt-4 text-sm font-medium text-red-600" role="alert">
                  {addError}
                </p>
              )}
            </div>
          )}

          <ul className="mt-8 space-y-2.5 border-t border-slate-200 pt-6 text-sm text-slate-600">
            <li className="flex items-center gap-2.5">
              <Icon name="shield" size="sm" className="text-brand-600" />
              Secure payment handled by PayHere
            </li>
            <li className="flex items-center gap-2.5">
              <Icon name="receipt" size="sm" className="text-brand-600" />
              Order status tracked in your account
            </li>
          </ul>
        </div>
      </div>
    </PageWrapper>
  );
}
