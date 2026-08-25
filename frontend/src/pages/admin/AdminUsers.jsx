import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/common/Loading';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';
import userService from '../../services/userService';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../utils/formatDate';
import { classNames } from '../../utils/classNames';

const PAGE_SIZE = 10;

// Mirrors backend/src/models/User.js ROLES/STATUSES. 'pending' is shown as
// a filter option (an admin may want to see who's stuck there) but is never
// offered as something to set — see updateStatus below.
const ROLE_OPTIONS = ['user', 'admin'];
const STATUS_OPTIONS = ['pending', 'active', 'suspended'];

const STATUS_TONE_CLASSES = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  suspended: 'border-red-200 bg-red-50 text-red-800',
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
};

function StatusBadge({ status }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
        STATUS_TONE_CLASSES[status] || 'border-slate-200 bg-slate-50 text-slate-700'
      )}
    >
      {status}
    </span>
  );
}

/**
 * Admin user management (/admin/users) — list every account and
 * suspend/reactivate one via GET /api/users and PATCH /api/users/:id/status
 * (backend/src/controllers/userController.js). Role and password are never
 * editable here; only `status`, and only between 'active' and 'suspended'
 * (see backend/src/validators/userValidators.js ADMIN_SETTABLE_STATUSES) —
 * the backend itself also refuses to let an admin change their own status,
 * so that action is hidden here for the signed-in admin's own row too.
 */
export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page'), 10) || 1;
  const role = searchParams.get('role') || '';
  const status = searchParams.get('status') || '';

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [confirmingId, setConfirmingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchUsers = useCallback(() => {
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (ignore) return undefined;
        setLoading(true);
        setError(null);
        return userService.getAllUsers({
          page,
          limit: PAGE_SIZE,
          role: role || undefined,
          status: status || undefined,
        });
      })
      .then((data) => {
        if (ignore || !data) return;
        setUsers(data.users);
        setPagination(data.pagination);
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
  }, [page, role, status]);

  useEffect(() => fetchUsers(), [fetchUsers]);

  function updateFilters(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.delete('page');
    setSearchParams(params);
  }

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  }

  async function handleSetStatus(userId, nextStatus) {
    setUpdatingId(userId);
    setActionError(null);
    try {
      const updated = await userService.updateUserStatus(userId, nextStatus);
      setUsers((prev) => prev.map((u) => (u._id === userId ? updated : u)));
      setConfirmingId(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  const hasFilters = Boolean(role || status);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Users</h2>
      </div>

      <div className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:max-w-md">
        <Select
          label="Role"
          value={role}
          onChange={(e) => updateFilters({ role: e.target.value })}
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r}
            </option>
          ))}
        </Select>
        <Select
          label="Status"
          value={status}
          onChange={(e) => updateFilters({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {loading && <Loading label="Loading users…" />}

      {!loading && error && <ErrorMessage message={error} onRetry={fetchUsers} />}

      {!loading && !error && users.length === 0 && (
        <EmptyState
          title="No users found"
          description={hasFilters ? 'No accounts match this filter.' : 'No accounts have registered yet.'}
        />
      )}

      {!loading && !error && users.length > 0 && (
        <>
          {actionError && (
            <div className="mb-4">
              <ErrorMessage message={actionError} />
            </div>
          )}

          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <UserRow
                    key={user._id}
                    user={user}
                    isSelf={user._id === currentUser?._id}
                    isConfirming={confirmingId === user._id}
                    isUpdating={updatingId === user._id}
                    onActionClick={() => setConfirmingId(user._id)}
                    onCancel={() => setConfirmingId(null)}
                    onConfirm={(nextStatus) => handleSetStatus(user._id, nextStatus)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {users.map((user) => (
              <UserCard
                key={user._id}
                user={user}
                isSelf={user._id === currentUser?._id}
                isConfirming={confirmingId === user._id}
                isUpdating={updatingId === user._id}
                onActionClick={() => setConfirmingId(user._id)}
                onCancel={() => setConfirmingId(null)}
                onConfirm={(nextStatus) => handleSetStatus(user._id, nextStatus)}
              />
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => goToPage(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => goToPage(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Suspend/reactivate control, inline-confirmed the same way Products/Categories confirm delete. Hidden entirely for the signed-in admin's own row — the backend refuses that change anyway. */
function StatusAction({ user, isSelf, isConfirming, isUpdating, onActionClick, onCancel, onConfirm }) {
  if (isSelf) {
    return <span className="text-xs text-slate-400">This is you</span>;
  }

  const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
  const actionLabel = nextStatus === 'suspended' ? 'Suspend' : 'Reactivate';

  if (isConfirming) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button
          variant={nextStatus === 'suspended' ? 'danger' : 'primary'}
          size="sm"
          onClick={() => onConfirm(nextStatus)}
          loading={isUpdating}
          disabled={isUpdating}
        >
          Confirm {actionLabel.toLowerCase()}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isUpdating}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={onActionClick}>
      {actionLabel}
    </Button>
  );
}

function UserRow({ user, isSelf, isConfirming, isUpdating, onActionClick, onCancel, onConfirm }) {
  const { name, email, role, status, createdAt } = user;
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-slate-900">{name}</td>
      <td className="px-4 py-3 text-slate-700">{email}</td>
      <td className="px-4 py-3 capitalize text-slate-700">{role}</td>
      <td className="px-4 py-3">
        <StatusBadge status={status} />
      </td>
      <td className="px-4 py-3 text-slate-500">{formatDate(createdAt)}</td>
      <td className="px-4 py-3 text-right">
        <StatusAction
          user={user}
          isSelf={isSelf}
          isConfirming={isConfirming}
          isUpdating={isUpdating}
          onActionClick={onActionClick}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </td>
    </tr>
  );
}

function UserCard({ user, isSelf, isConfirming, isUpdating, onActionClick, onCancel, onConfirm }) {
  const { name, email, role, status, createdAt } = user;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{name}</p>
          <p className="truncate text-sm text-slate-500">{email}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex items-center gap-1.5">
          <dt className="text-slate-500">Role</dt>
          <dd className="font-medium capitalize text-slate-900">{role}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-slate-500">Joined</dt>
          <dd className="font-medium text-slate-900">{formatDate(createdAt)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex justify-end">
        <StatusAction
          user={user}
          isSelf={isSelf}
          isConfirming={isConfirming}
          isUpdating={isUpdating}
          onActionClick={onActionClick}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}
