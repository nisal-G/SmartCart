import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Icon } from '../../components/ui/Icon';
import { Loading } from '../../components/common/Loading';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import { ROUTES } from '../../constants/routes';

const EMPTY_FORM = { name: '', description: '', price: '', category: '', imageUrl: '' };

/** Mirrors backend/src/validators/productValidators.js so obviously-invalid
 * input never round-trips to the server; the backend remains authoritative. */
function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Product name is required';
  else if (form.name.trim().length > 100) errors.name = 'Product name must be at most 100 characters';

  if (form.description.trim().length > 1000) {
    errors.description = 'Description must be at most 1000 characters';
  }

  if (!form.price) errors.price = 'Price is required';
  else if (!(Number(form.price) > 0)) errors.price = 'Price must be a positive number';

  if (!form.category) errors.category = 'Category is required';

  return errors;
}

/** Add/Edit product (/admin/products/new, /admin/products/:id/edit) — one
 * form for both, matching the backend's POST/PUT contract. */
export function AdminProductForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [currentImage, setCurrentImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const [loadingProduct, setLoadingProduct] = useState(isEditing);
  const [loadError, setLoadError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Categories are needed by the selector regardless of add/edit — fetched once.
  useEffect(() => {
    categoryService
      .getCategories()
      .then(setCategories)
      .catch((err) => setCategoriesError(err.message));
  }, []);

  useEffect(() => {
    if (!isEditing) return undefined;
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (ignore) return undefined;
        setLoadingProduct(true);
        setLoadError(null);
        return productService.getProductById(id);
      })
      .then((product) => {
        if (ignore || !product) return;
        setForm({
          name: product.name || '',
          description: product.description || '',
          price: product.price != null ? String(product.price) : '',
          category: product.category?._id || product.category || '',
          imageUrl: product.image || '',
        });
        setCurrentImage(product.image || null);
      })
      .catch((err) => {
        if (!ignore) setLoadError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoadingProduct(false);
      });
    return () => {
      ignore = true;
    };
  }, [id, isEditing]);

  function updateField(field) {
    return (event) => {
      const { value } = event.target;
      setForm((prev) => ({ ...prev, [field]: value }));
      setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    };
  }

  function handleFileChange(event) {
    setImageFile(event.target.files?.[0] || null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      let payload;
      if (imageFile) {
        payload = new FormData();
        payload.append('name', form.name.trim());
        payload.append('description', form.description.trim());
        payload.append('price', form.price);
        payload.append('category', form.category);
        payload.append('image', imageFile);
      } else {
        payload = {
          name: form.name.trim(),
          description: form.description.trim(),
          price: Number(form.price),
          category: form.category,
          image: form.imageUrl.trim() || undefined,
        };
      }

      if (isEditing) {
        await productService.updateProduct(id, payload);
        navigate(ROUTES.ADMIN_PRODUCTS, { state: { flash: 'Product updated successfully' } });
      } else {
        await productService.createProduct(payload);
        navigate(ROUTES.ADMIN_PRODUCTS, { state: { flash: 'Product created successfully' } });
      }
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  if (loadingProduct) {
    return <Loading label="Loading product…" />;
  }

  if (loadError) {
    return (
      <div>
        <ErrorMessage message={loadError} />
        <div className="mt-6">
          <Link
            to={ROUTES.ADMIN_PRODUCTS}
            className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            ← Back to products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isEditing ? 'Edit product' : 'Add product'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {isEditing
              ? 'Update this product’s details in the catalogue.'
              : 'Create a new product for shoppers to browse.'}
          </p>
        </div>
        <Link
          to={ROUTES.ADMIN_PRODUCTS}
          className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
        >
          ← Back to products
        </Link>
      </div>

      {categoriesError && (
        <div className="mb-4">
          <ErrorMessage message={`Could not load categories: ${categoriesError}`} />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card"
      >
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <Input
            label="Name"
            placeholder="e.g. Red onions, 1kg"
            value={form.name}
            onChange={updateField('name')}
            error={fieldErrors.name}
            disabled={submitting}
          />

          <Textarea
            label="Description"
            placeholder="A short description shoppers will see on the product page."
            value={form.description}
            onChange={updateField('description')}
            error={fieldErrors.description}
            disabled={submitting}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Price"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              hint="Charged in LKR."
              value={form.price}
              onChange={updateField('price')}
              error={fieldErrors.price}
              disabled={submitting}
            />

            <Select
              label="Category"
              value={form.category}
              onChange={updateField('category')}
              error={fieldErrors.category}
              disabled={submitting || categories.length === 0}
            >
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <fieldset className="rounded-card border border-slate-200 bg-slate-50/50 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">Image</legend>

            <div className="mt-1 flex flex-col gap-4">
              {currentImage && !imageFile && (
                <div className="flex items-center gap-3">
                  <div className="h-20 w-20 overflow-hidden rounded-control bg-white ring-1 ring-slate-200">
                    <img
                      src={currentImage}
                      alt="Current product"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="text-sm text-slate-500">Current image</p>
                </div>
              )}
              {imageFile && (
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <Icon name="check" size="sm" className="text-brand-600" />
                  Selected file: {imageFile.name}
                </p>
              )}

              <Input
                label="Image URL"
                placeholder="https://…"
                value={form.imageUrl}
                onChange={updateField('imageUrl')}
                disabled={submitting || Boolean(imageFile)}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="product-image-file">
                  Or upload an image file
                </label>
                <input
                  id="product-image-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  disabled={submitting}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-control file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
                />
                {imageFile && (
                  <button
                    type="button"
                    className="mt-1 self-start text-xs font-semibold text-brand-700 hover:text-brand-800"
                    onClick={() => setImageFile(null)}
                  >
                    Remove selected file
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                A selected file takes precedence over the image URL above.
              </p>
            </div>
          </fieldset>

          {submitError && <ErrorMessage message={submitError} />}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-4 sm:px-6">
          <Button type="submit" loading={submitting} disabled={submitting}>
            {isEditing ? 'Save changes' : 'Add product'}
          </Button>
          <Link to={ROUTES.ADMIN_PRODUCTS}>
            <Button type="button" variant="outline" disabled={submitting}>
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
