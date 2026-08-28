import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PageWrapper } from '../../components/ui/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Icon } from '../../components/ui/Icon';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';

// Three short, honest claims about what the admin console actually does —
// no invented metrics, just a plain-language recap of the sections behind
// AdminNav (Catalog / Operations).
const HIGHLIGHTS = [
  { icon: 'package', text: 'Manage your product catalogue and categories' },
  { icon: 'receipt', text: 'Track orders and update fulfilment status' },
  { icon: 'users', text: 'Review customer accounts and access' },
];

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
    <PageWrapper className="flex items-center py-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-panel border border-slate-200 bg-white shadow-panel lg:grid-cols-2">
        {/* Brand panel — decorative context only, hidden below lg so the
            form is what a narrow viewport sees first. */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-brand-600 via-brand-700 to-slate-900 p-10 text-white lg:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-brand-400/20 blur-3xl"
          />

          <Link to={ROUTES.HOME} className="relative flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Icon name="cart" size="md" strokeWidth={2} />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              Smart<span className="text-brand-200">Cart</span>
            </span>
          </Link>

          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
              <Icon name="shield" size="xs" />
              Admin portal
            </span>
            <p className="mt-4 text-2xl font-bold leading-snug tracking-tight">
              Everything your store needs, in one console.
            </p>
            <ul className="mt-6 flex flex-col gap-3.5">
              {HIGHLIGHTS.map((item) => (
                <li key={item.text} className="flex items-center gap-3 text-sm text-brand-50/90">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-white/10"
                    aria-hidden="true"
                  >
                    <Icon name={item.icon} size="sm" />
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-brand-100/70">
            Restricted to authorized SmartCart administrators.
          </p>
        </div>

        {/* Form panel */}
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <div className="flex flex-col items-center text-center lg:hidden">
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
          </div>

          <div className="mt-6 text-center lg:mt-0 lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff sign in</h1>
            <p className="mt-2 text-sm text-slate-600">
              Restricted to authorized SmartCart administrators.
            </p>
          </div>

          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
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

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-500 lg:text-left">
            Shopping instead?{' '}
            <Link to={ROUTES.LOGIN} className="font-semibold text-brand-700 hover:text-brand-800">
              Go to customer sign in
            </Link>
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}
