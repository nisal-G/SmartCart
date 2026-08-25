import { Outlet } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { AdminNav } from '../components/admin/AdminNav';

/**
 * Shared shell for every /admin/* page: page-level spacing (via PageWrapper)
 * plus the admin sub-navigation. Individual admin pages render only their
 * own heading/content — they must not wrap themselves in PageWrapper again.
 * Route-level access control (authenticated + admin role) is enforced by
 * ProtectedRoute in routes/AppRoutes.jsx, not here.
 */
export function AdminLayout() {
  return (
    <PageWrapper>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Admin</h1>
      <AdminNav />
      <div className="mt-6">
        <Outlet />
      </div>
    </PageWrapper>
  );
}
