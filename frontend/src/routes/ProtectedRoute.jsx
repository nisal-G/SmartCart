import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';
import { ROLES } from '../constants/roles';
import { Loading } from '../components/common/Loading';

/**
 * Gate for routes that require a logged-in session (and optionally a
 * specific role, e.g. admin). Renders its nested route via <Outlet /> when
 * allowed; otherwise redirects, preserving where the user was headed so
 * Login/AdminLogin can send them back after authenticating.
 */
export function ProtectedRoute({ role }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading label="Checking your session…" />;
  }

  if (!isAuthenticated) {
    // An unauthenticated visit to an admin-only route goes to the
    // dedicated admin sign-in page, not the shopper Login page — admin
    // routes never surface the customer auth UI.
    const signInRoute = role === ROLES.ADMIN ? ROUTES.ADMIN_LOGIN : ROUTES.LOGIN;
    return <Navigate to={signInRoute} state={{ from: location }} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <Outlet />;
}
