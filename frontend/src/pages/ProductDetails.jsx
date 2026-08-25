import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import productService from '../services/productService';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatCurrency';
import { ROUTES } from '../constants/routes';

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
  // .then/.catch/.finally, not a synchronous call in the effect body itself —
  // same pattern as context/CartContext.jsx.
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
        <Loading label="Loading product…" />
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
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              No image
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {product.category?.name && (
            <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">
              {product.category.name}
            </span>
          )}
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{product.name}</h1>
          <p className="text-2xl font-semibold text-slate-900">{formatCurrency(product.price)}</p>

          {product.description && (
            <p className="leading-relaxed text-slate-600">{product.description}</p>
          )}

          <p
            className={
              isAvailable ? 'text-sm font-medium text-green-600' : 'text-sm font-medium text-red-600'
            }
          >
            {isAvailable ? 'In stock' : 'Currently unavailable'}
          </p>

          {isAvailable && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-md border border-slate-300">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-50"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-medium" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-50"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <Button
                onClick={handleAddToCart}
                loading={addState === 'adding'}
                disabled={addState === 'adding'}
              >
                Add to cart
              </Button>
            </div>
          )}

          {addState === 'added' && (
            <p className="text-sm text-green-600" role="status">
              Added to cart.
            </p>
          )}
          {addState === 'error' && addError && (
            <p className="text-sm text-red-600" role="alert">
              {addError}
            </p>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
