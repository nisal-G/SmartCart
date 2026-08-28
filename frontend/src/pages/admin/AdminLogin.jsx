import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PageWrapper } from '../../components/ui/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Icon } from '../../components/ui/Icon';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';

/**
 * Dedicated sign-in page for SmartCart staff/administrators. Deliberately
 * separate from the shopper-facing Login page (pages/Login.jsx) — customers
 * never see an email/password form, and this page never advertises
 * Google/Facebook/Passkey. It reuses the same `adminLogin` action already
 * defined on AuthContext, so there is exactly one place that performs an
 * admin email/password sign-in; only the entry point moved (see the
 * "Admin Portal" link in the site footer).
 */
export function AdminLogin() {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Land back on whatever admin page was originally requested (set by
  // ProtectedRoute), falling back to the admin dashboard rather than the
  // shopper home page.
  const redirectTo = location.state?.from?.pathname || ROUTES.ADMIN;

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminLogin(form);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageWrapper className="flex items-center">
      <div className="mx-auto w-full max-w-md py-6 sm:py-10">
        <div className="flex flex-col items-center text-center">
          <Link to={ROUTES.HOME} className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-xs">
              <Icon name="cart" size="lg" strokeWidth={2} />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Smart<span className="text-brand-600">Cart</span>
            </span>
          </Link>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Icon name="shield" size="xs" />
            Admin portal
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Staff sign in
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Restricted to authorized SmartCart administrators.
          </p>
        </div>

        <div className="mt-8 rounded-panel border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {error && <ErrorMessage message={error} />}
            <Input
              type="email"
              label="Email"
              required
              autoFocus
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              type="password"
              label="Password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <Button type="submit" size="lg" fullWidth loading={submitting}>
              Log in
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          Shopping instead?{' '}
          <Link to={ROUTES.LOGIN} className="font-semibold text-brand-700 hover:text-brand-800">
            Go to customer sign in
          </Link>
        </p>
      </div>
    </PageWrapper>
  );
}
