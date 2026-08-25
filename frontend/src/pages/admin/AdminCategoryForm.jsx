import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Loading } from '../../components/common/Loading';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import categoryService from '../../services/categoryService';
import { ROUTES } from '../../constants/routes';

const EMPTY_FORM = { name: '', description: '', imageUrl: '' };

/** Mirrors backend/src/validators/categoryValidators.js. */
function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Category name is required';
  else if (form.name.trim().length > 50) errors.name = 'Category name must be at most 50 characters';

  if (form.description.trim().length > 500) {
    errors.description = 'Description must be at most 500 characters';
  }

  return errors;
}

/** Add/Edit category (/admin/categories/new, /admin/categories/:id/edit). */
export function AdminCategoryForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [currentImage, setCurrentImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const [loadingCategory, setLoadingCategory] = useState(isEditing);
  const [loadError, setLoadError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!isEditing) return undefined;
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (ignore) return undefined;
        setLoadingCategory(true);
        setLoadError(null);
        return categoryService.getCategoryById(id);
      })
      .then((category) => {
        if (ignore || !category) return;
        setForm({
          name: category.name || '',
          description: category.description || '',
          imageUrl: category.image || '',
        });
        setCurrentImage(category.image || null);
      })
      .catch((err) => {
        if (!ignore) setLoadError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoadingCategory(false);
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
        payload.append('image', imageFile);
      } else {
        payload = {
          name: form.name.trim(),
          description: form.description.trim(),
          image: form.imageUrl.trim() || undefined,
        };
      }

      if (isEditing) {
        await categoryService.updateCategory(id, payload);
        navigate(ROUTES.ADMIN_CATEGORIES, { state: { flash: 'Category updated successfully' } });
      } else {
        await categoryService.createCategory(payload);
        navigate(ROUTES.ADMIN_CATEGORIES, { state: { flash: 'Category created successfully' } });
      }
    } catch (err) {
      // Includes the backend's 409 "A category with this name already
      // exists" message, shown as-is.
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  if (loadingCategory) {
    return <Loading label="Loading category…" />;
  }

  if (loadError) {
    return (
      <div>
        <ErrorMessage message={loadError} />
        <div className="mt-6">
          <Link to={ROUTES.ADMIN_CATEGORIES} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            ← Back to categories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {isEditing ? 'Edit category' : 'Add category'}
        </h2>
        <Link to={ROUTES.ADMIN_CATEGORIES} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          ← Back to categories
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <Input label="Name" value={form.name} onChange={updateField('name')} error={fieldErrors.name} disabled={submitting} />

        <Textarea
          label="Description"
          value={form.description}
          onChange={updateField('description')}
          error={fieldErrors.description}
          disabled={submitting}
        />

        <div className="flex flex-col gap-3 rounded-md border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-700">Image</p>

          {currentImage && !imageFile && (
            <div className="h-24 w-24 overflow-hidden rounded-md bg-slate-100">
              <img src={currentImage} alt="Current category" className="h-full w-full object-cover" />
            </div>
          )}
          {imageFile && <p className="text-sm text-slate-500">Selected file: {imageFile.name}</p>}

          <Input
            label="Image URL"
            placeholder="https://…"
            value={form.imageUrl}
            onChange={updateField('imageUrl')}
            disabled={submitting || Boolean(imageFile)}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="category-image-file">
              Or upload an image file
            </label>
            <input
              id="category-image-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              disabled={submitting}
              className="text-sm text-slate-600"
            />
            {imageFile && (
              <button
                type="button"
                className="mt-1 self-start text-xs font-medium text-indigo-600 hover:text-indigo-700"
                onClick={() => setImageFile(null)}
              >
                Remove selected file
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            A selected file takes precedence over the image URL above.
          </p>
        </div>

        {submitError && <ErrorMessage message={submitError} />}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={submitting} disabled={submitting}>
            {isEditing ? 'Save changes' : 'Add category'}
          </Button>
          <Link to={ROUTES.ADMIN_CATEGORIES}>
            <Button type="button" variant="outline" disabled={submitting}>
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
