import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';
import { SuccessMessage } from '../../components/common/SuccessMessage';
import { TableSkeleton } from '../../components/common/skeletons';
import { AdminCard, AdminCardList, AdminTable, Td, Th, Tr } from '../../components/admin/AdminTable';
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Categories</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {categories.length > 0
              ? `${categories.length} categor${categories.length === 1 ? 'y' : 'ies'} shoppers can browse`
              : 'How products are grouped in the storefront'}
          </p>
        </div>
        <Link to={ROUTES.ADMIN_CATEGORY_NEW}>
          <Button size="sm">
            <Icon name="plus" size="sm" />
            Add category
          </Button>
        </Link>
      </div>

      <SuccessMessage message={flash} />

      {loading && <TableSkeleton rows={4} columns={3} />}

      {!loading && error && <ErrorMessage message={error} onRetry={fetchCategories} />}

      {!loading && !error && categories.length === 0 && (
        <EmptyState
          icon="tag"
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
          <AdminTable
            head={
              <>
                <Th>Category</Th>
                <Th>Description</Th>
                <Th align="right">Actions</Th>
              </>
            }
          >
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
          </AdminTable>

          {/* Mobile cards */}
          <AdminCardList>
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
          </AdminCardList>
        </>
      )}
    </div>
  );
}

/** Category thumbnail with the same placeholder treatment as products. */
function Thumb({ image, size = 'md' }) {
  const box = size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  return (
    <div
      className={`${box} shrink-0 overflow-hidden rounded-control bg-slate-100 ring-1 ring-slate-200/70`}
    >
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-slate-300">
          <Icon name="tag" size="sm" strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}

function DeleteActions({ isConfirming, isDeleting, onDeleteClick, onCancelDelete, onConfirmDelete }) {
  if (isConfirming) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={onConfirmDelete}
          loading={isDeleting}
          disabled={isDeleting}
        >
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
      <Icon name="trash" size="sm" />
      Delete
    </Button>
  );
}

function CategoryRow({
  category,
  isConfirming,
  isDeleting,
  onEditPath,
  onDeleteClick,
  onCancelDelete,
  onConfirmDelete,
}) {
  const { name, description, image } = category;
  return (
    <Tr>
      <Td>
        <div className="flex items-center gap-3">
          <Thumb image={image} />
          <span className="font-semibold text-slate-900">{name}</span>
        </div>
      </Td>
      <Td className="max-w-xs truncate text-slate-500">{description || '—'}</Td>
      <Td align="right">
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
                <Icon name="pencil" size="sm" />
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
      </Td>
    </Tr>
  );
}

function CategoryCard({
  category,
  isConfirming,
  isDeleting,
  onEditPath,
  onDeleteClick,
  onCancelDelete,
  onConfirmDelete,
}) {
  const { name, description, image } = category;
  return (
    <AdminCard>
      <div className="flex gap-3">
        <Thumb image={image} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{name}</p>
          {description && <p className="line-clamp-2 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
        {!isConfirming && (
          <Link to={onEditPath}>
            <Button variant="outline" size="sm">
              <Icon name="pencil" size="sm" />
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
    </AdminCard>
  );
}
