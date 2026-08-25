import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/skeletons';
import { Pagination } from '../../components/common/Pagination';
import { AdminCard, AdminCardList, AdminTable, Td, Th, Tr } from '../../components/admin/AdminTable';
import userService from '../../services/userService';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../utils/formatDate';

const PAGE_SIZE = 10;

// Mirrors backend/src/models/User.js ROLES/STATUSES. 'pending' is shown as
// a filter option (an admin may want to see who's stuck there) but is never
// offered as something to set — see updateStatus below.
const ROLE_OPTIONS = ['user', 'admin'];
const STATUS_OPTIONS = ['pending', 'active', 'suspended'];

const STATUS_TONES = {
  active: 'success',
  suspended: 'danger',
  pending: 'warning',
};

function StatusBadge({ status }) {
  return (
    <Badge tone={STATUS_TONES[status] || 'neutral'} size="sm" className="capitalize">
      {status}
    </Badge>
  );
}

/** Initials avatar — a name is always present on a User (see the model). */
function Avatar({ name }) {
  const initials = String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600"
      aria-hidden="true"
    >
      {initials || '?'}
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
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900">Users</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {pagination?.total != null
            ? `${pagination.total} account${pagination.total === 1 ? '' : 's'}${hasFilters ? ' matching these filters' : ''}`
            : 'Customer and administrator accounts'}
        </p>
      </div>

      <div className="mb-6 rounded-card border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon name="filter" size="sm" className="text-slate-400" />
          Filters
        </div>
        <div className="grid gap-4 sm:max-w-md sm:grid-cols-2">
          <Select label="Role" value={role} onChange={(e) => updateFilters({ role: e.target.value })}>
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
      </div>

      {loading && <TableSkeleton rows={PAGE_SIZE} columns={5} />}

      {!loading && error && <ErrorMessage message={error} onRetry={fetchUsers} />}

      {!loading && !error && users.length === 0 && (
        <EmptyState
          icon="users"
          title="No users found"
          description={
            hasFilters ? 'No accounts match this filter.' : 'No accounts have registered yet.'
          }
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
          <AdminTable
            head={
              <>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th align="right">Actions</Th>
              </>
            }
          >
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
          </AdminTable>

          {/* Mobile cards */}
          <AdminCardList>
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
          </AdminCardList>

          <Pagination pagination={pagination} onPageChange={goToPage} className="mt-6" />
        </>
      )}
    </div>
  );
}

/** Suspend/reactivate control, inline-confirmed the same way Products/Categories confirm delete. Hidden entirely for the signed-in admin's own row — the backend refuses that change anyway. */
function StatusAction({ user, isSelf, isConfirming, isUpdating, onActionClick, onCancel, onConfirm }) {
  if (isSelf) {
    return <span className="text-xs font-medium text-slate-400">This is you</span>;
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
    <Tr>
      <Td>
        <div className="flex items-center gap-3">
          <Avatar name={name} />
          <span className="font-semibold text-slate-900">{name}</span>
        </div>
      </Td>
      <Td className="text-slate-600">{email}</Td>
      <Td>
        <span className="capitalize text-slate-700">{role}</span>
      </Td>
      <Td>
        <StatusBadge status={status} />
      </Td>
      <Td className="whitespace-nowrap text-slate-500">{formatDate(createdAt)}</Td>
      <Td align="right">
        <StatusAction
          user={user}
          isSelf={isSelf}
          isConfirming={isConfirming}
          isUpdating={isUpdating}
          onActionClick={onActionClick}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </Td>
    </Tr>
  );
}

function UserCard({ user, isSelf, isConfirming, isUpdating, onActionClick, onCancel, onConfirm }) {
  const { name, email, role, status, createdAt } = user;
  return (
    <AdminCard>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{name}</p>
            <p className="truncate text-sm text-slate-500">{email}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <dt className="text-slate-500">Role</dt>
          <dd className="font-medium capitalize text-slate-900">{role}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-slate-500">Joined</dt>
          <dd className="font-medium text-slate-900">{formatDate(createdAt)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
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
    </AdminCard>
  );
}
