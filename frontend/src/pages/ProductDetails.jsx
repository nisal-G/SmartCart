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

// Reassurance lines under the buy box. Each states something the app
// actually does — no delivery windows or return policies are invented.
const ASSURANCES = [
  { icon: 'shield', text: 'Secure payment handled by PayHere' },
  { icon: 'receipt', text: 'Order status tracked in your account' },
  { icon: 'cart', text: 'Your cart is saved to your account' },
];

/** Matches the real page's two-column layout so nothing jumps when the product lands. */
function ProductDetailsSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-14" aria-hidden="true">
      <Skeleton className="aspect-square w-full rounded-panel" />
      <div className="space-y-5 pt-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full rounded-card" />
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

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <div className="group overflow-hidden rounded-panel border border-slate-200/80 bg-white p-3 shadow-card">
            <div className="relative aspect-square w-full overflow-hidden rounded-card bg-slate-100">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-700 ease-entrance group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-linear-to-br from-slate-50 to-slate-100 text-slate-300">
                  <Icon name="package" size="xl" strokeWidth={1.5} className="h-12 w-12" />
                  <span className="text-sm font-medium text-slate-400">No image</span>
                </div>
              )}

              {!isAvailable && (
                <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-red-700 shadow-card ring-1 ring-red-200">
                  <Icon name="alert" size="xs" />
                  Unavailable
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          {/* The category is only a link when the API actually populated it
              (it can come back as a bare id) — never a link to nowhere. */}
          {product.category?.name &&
            (product.category._id ? (
              <Link
                to={`${ROUTES.PRODUCTS}?category=${product.category._id}`}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-800 transition-colors hover:border-brand-300 hover:bg-brand-100"
              >
                <Icon name="tag" size="xs" />
                {product.category.name}
              </Link>
            ) : (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-800">
                <Icon name="tag" size="xs" />
                {product.category.name}
              </span>
            ))}

          <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <p className="text-4xl font-extrabold tracking-tight tabular-nums text-slate-900">
              {formatCurrency(product.price)}
            </p>
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
            <div className="mt-7 border-t border-slate-200 pt-7">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Description
              </h2>
              <p className="mt-3 text-pretty leading-relaxed text-slate-600">
                {product.description}
              </p>
            </div>
          )}

          {isAvailable && (
            <div className="mt-8 rounded-panel border border-slate-200/80 bg-linear-to-br from-white to-brand-50/40 p-5 shadow-card sm:p-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Quantity
                  </span>
                  <div className="flex h-12 items-center overflow-hidden rounded-control border border-slate-300 bg-white shadow-xs">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="flex h-full w-12 items-center justify-center text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
                      aria-label="Decrease quantity"
                    >
                      <Icon name="minus" size="sm" strokeWidth={2.25} />
                    </button>
                    <span
                      className="w-12 border-x border-slate-200 text-center text-sm font-bold tabular-nums text-slate-900"
                      aria-live="polite"
                    >
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="flex h-full w-12 items-center justify-center text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
                      aria-label="Increase quantity"
                    >
                      <Icon name="plus" size="sm" strokeWidth={2.25} />
                    </button>
                  </div>
                </div>

                <div className="min-w-52 flex-1">
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
                  className="mt-4 flex animate-scale-in items-center justify-between gap-3 rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3"
                  role="status"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                    <Icon name="checkCircle" size="sm" className="text-emerald-600" />
                    Added to cart.
                  </span>
                  <Link
                    to={ROUTES.CART}
                    className="shrink-0 text-sm font-bold text-emerald-800 underline-offset-2 hover:underline"
                  >
                    View cart
                  </Link>
                </div>
              )}
              {addState === 'error' && addError && (
                <p className="mt-4 text-sm font-semibold text-red-600" role="alert">
                  {addError}
                </p>
              )}
            </div>
          )}

          <ul className="mt-8 grid gap-3 border-t border-slate-200 pt-7 text-sm text-slate-600 sm:grid-cols-1">
            {ASSURANCES.map((item) => (
              <li key={item.text} className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"
                  aria-hidden="true"
                >
                  <Icon name={item.icon} size="sm" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageWrapper>
  );
}
