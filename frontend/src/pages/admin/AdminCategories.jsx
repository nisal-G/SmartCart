import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/common/Loading';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';
import { SuccessMessage } from '../../components/common/SuccessMessage';
import categoryService from '../../services/categoryService';
import { ROUTES, adminCategoryEditPath } from '../../constants/routes';

/**
 * Admin category list (/admin/categories). GET /api/categories has no
 * pagination (see backend/src/controllers/categoryController.js
 * getCategories) — it returns the full, name-sorted list, so this page just
 * renders it as-is.
 */
export function AdminCategories() {
  const location = useLocation();
  const [flash] = useState(location.state?.flash || null);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const fetchCategories = useCallback(() => {
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (ignore) return undefined;
        setLoading(true);
        setError(null);
        return categoryService.getCategories();
      })
      .then((data) => {
        if (ignore || !data) return;
        setCategories(data);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(fetchCategories, [fetchCategories]);

  async function handleDelete(categoryId) {
    setDeletingId(categoryId);
    setDeleteError(null);
    try {
      await categoryService.deleteCategory(categoryId);
      setConfirmingId(null);
      fetchCategories();
    } catch (err) {
      // e.g. products may still reference this category — the backend's own
      // sanitized message (if any) is shown as-is; nothing is invented here.
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Categories</h2>
        <Link to={ROUTES.ADMIN_CATEGORY_NEW}>
          <Button size="sm">Add category</Button>
        </Link>
      </div>

      <SuccessMessage message={flash} />

      {loading && <Loading label="Loading categories…" />}

      {!loading && error && <ErrorMessage message={error} onRetry={fetchCategories} />}

      {!loading && !error && categories.length === 0 && (
        <EmptyState
          title="No categories"
          description="Get started by adding your first category."
          action={
            <Link to={ROUTES.ADMIN_CATEGORY_NEW}>
              <Button>Add category</Button>
            </Link>
          }
        />
      )}

      {!loading && !error && categories.length > 0 && (
        <>
          {deleteError && (
            <div className="mb-4">
              <ErrorMessage message={deleteError} />
            </div>
          )}

          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((category) => (
                  <CategoryRow
                    key={category._id}
                    category={category}
                    isConfirming={confirmingId === category._id}
                    isDeleting={deletingId === category._id}
                    onEditPath={adminCategoryEditPath(category._id)}
                    onDeleteClick={() => setConfirmingId(category._id)}
                    onCancelDelete={() => setConfirmingId(null)}
                    onConfirmDelete={() => handleDelete(category._id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {categories.map((category) => (
              <CategoryCard
                key={category._id}
                category={category}
                isConfirming={confirmingId === category._id}
                isDeleting={deletingId === category._id}
                onEditPath={adminCategoryEditPath(category._id)}
                onDeleteClick={() => setConfirmingId(category._id)}
                onCancelDelete={() => setConfirmingId(null)}
                onConfirmDelete={() => handleDelete(category._id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DeleteActions({ isConfirming, isDeleting, onDeleteClick, onCancelDelete, onConfirmDelete }) {
  if (isConfirming) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button variant="danger" size="sm" onClick={onConfirmDelete} loading={isDeleting} disabled={isDeleting}>
          Confirm
        </Button>
        <Button variant="outline" size="sm" onClick={onCancelDelete} disabled={isDeleting}>
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={onDeleteClick}>
      Delete
    </Button>
  );
}

function CategoryRow({ category, isConfirming, isDeleting, onEditPath, onDeleteClick, onCancelDelete, onConfirmDelete }) {
  const { name, description, image } = category;
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-slate-100">
            {image ? (
              <img src={image} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                No image
              </div>
            )}
          </div>
          <span className="font-medium text-slate-900">{name}</span>
        </div>
      </td>
      <td className="max-w-xs truncate px-4 py-3 text-slate-500">{description || '—'}</td>
      <td className="px-4 py-3">
        {isConfirming ? (
          <DeleteActions
            isConfirming
            isDeleting={isDeleting}
            onDeleteClick={onDeleteClick}
            onCancelDelete={onCancelDelete}
            onConfirmDelete={onConfirmDelete}
          />
        ) : (
          <div className="flex items-center justify-end gap-2">
            <Link to={onEditPath}>
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </Link>
            <DeleteActions
              isConfirming={false}
              isDeleting={isDeleting}
              onDeleteClick={onDeleteClick}
              onCancelDelete={onCancelDelete}
              onConfirmDelete={onConfirmDelete}
            />
          </div>
        )}
      </td>
    </tr>
  );
}

function CategoryCard({ category, isConfirming, isDeleting, onEditPath, onDeleteClick, onCancelDelete, onConfirmDelete }) {
  const { name, description, image } = category;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex gap-3">
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-slate-100">
          {image ? (
            <img src={image} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900">{name}</p>
          {description && <p className="line-clamp-2 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        {!isConfirming && (
          <Link to={onEditPath}>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
        )}
        <DeleteActions
          isConfirming={isConfirming}
          isDeleting={isDeleting}
          onDeleteClick={onDeleteClick}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
        />
      </div>
    </div>
  );
}
