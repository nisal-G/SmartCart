import { Link, Outlet } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { AdminNav } from '../components/admin/AdminNav';
import { Icon } from '../components/ui/Icon';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PageTransition } from '../components/layout/PageTransition';
import { ToastProvider } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';

/**
 * Shared shell for every /admin/* page: a persistent navigation rail on
 * desktop (a scrolling pill strip on narrow screens), the admin page
 * heading, and the routed admin page itself. Individual admin pages render
 * only their own section heading/content — they must not wrap themselves in
 * PageWrapper again.
 *
 * Route-level access control (authenticated + admin role) is enforced by
 * ProtectedRoute in routes/AppRoutes.jsx, not here — nothing in this file
 * grants or checks permissions, it only lays out what an admin already has
 * access to.
 */
export function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <ToastProvider>
      <PageWrapper>
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* Desktop rail */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-28 flex flex-col rounded-card border border-slate-200 bg-white p-3 shadow-card">
              <div className="flex items-center gap-2.5 px-2 pb-3 pt-1">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-xs"
                  aria-hidden="true"
                >
                  <Icon name="cart" size="md" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  {/* The signed-in admin's own name is already in the
                      profile card below — not repeated here. */}
                  <p className="truncate text-sm font-extrabold tracking-tight text-slate-900">
                    Smart<span className="text-brand-600">Cart</span>
                  </p>
                  <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Admin console
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <AdminNav />
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <Link
                  to={ROUTES.HOME}
                  className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <Icon name="store" size="md" />
                  View storefront
                </Link>
              </div>

              {/* Signed-in admin identity + sign out — same `logout()` used
                  by the shopper-facing Navbar; ProtectedRoute reacts to the
                  session ending and redirects to the admin login page, so
                  nothing here needs to navigate itself. */}
              {user && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-3 rounded-control px-2 py-2">
                    <Avatar
                      name={user.name}
                      avatarUrl={user.avatarUrl}
                      className="h-9 w-9 bg-brand-100 text-xs font-bold text-brand-800"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" fullWidth className="mt-1.5" onClick={logout}>
                    <Icon name="logout" size="sm" />
                    Sign out
                  </Button>
                </div>
              )}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {/* Slim chrome strip — each page owns its own real heading
                below, so this reads as a breadcrumb bar, not a competing
                page title. */}
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <h1 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Admin</h1>
              <div className="flex items-center gap-2.5">
                <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 sm:inline-flex">
                  <Icon name="shield" size="xs" />
                  Admin access
                </span>
                {/* Mirrors the profile card in the desktop rail above — shown
                    here instead on the narrower widths where that rail is
                    hidden, so the signed-in admin's identity is always
                    visible somewhere on screen. */}
                {user && (
                  <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 lg:hidden">
                    <Avatar
                      name={user.name}
                      avatarUrl={user.avatarUrl}
                      className="h-6 w-6 bg-brand-100 text-[10px] font-bold text-brand-800"
                    />
                    <span className="max-w-28 truncate text-xs font-semibold text-slate-700">
                      {user.name}
                    </span>
                  </span>
                )}
              </div>
            </header>

            {/* Tablet-width-band navigation only (768–1023px). Below that,
                the hamburger in Navbar opens a full off-canvas admin drawer
                instead (see Navbar.jsx) — showing both at once at phone
                widths would put two "Admin navigation" landmarks on screen
                simultaneously. */}
            <div className="mb-6 hidden md:block lg:hidden">
              <AdminNav variant="pills" />
            </div>

            <PageTransition className="min-w-0">
              <Outlet />
            </PageTransition>
          </div>
        </div>
      </PageWrapper>
    </ToastProvider>
  );
}
