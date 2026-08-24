import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';

/**
 * Minimal login screen wired to the real auth foundation, so it doubles as
 * a manual smoke test for it. Google/Facebook trigger a full-page OAuth
 * redirect (see authService); the email/password form only ever
 * authenticates admin accounts (SRS §3.1 — shoppers use Google/Facebook/
 * Passkey only). Passkey login UI is left for a later branch — it needs
 * the @simplewebauthn/browser dependency, which this foundation does not
 * introduce yet.
 */
export function Login() {
  const { loginWithGoogle, loginWithFacebook, adminLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || ROUTES.HOME;

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdminLogin(event) {
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
    <PageWrapper>
      <div className="mx-auto flex max-w-sm flex-col gap-6">
        <h1 className="text-2xl font-semibold text-slate-900">Log in</h1>

        <div className="flex flex-col gap-3">
          <Button variant="outline" fullWidth onClick={loginWithGoogle}>
            Continue with Google
          </Button>
          <Button variant="outline" fullWidth onClick={loginWithFacebook}>
            Continue with Facebook
          </Button>
          <Button variant="outline" fullWidth disabled>
            Continue with Passkey (coming soon)
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs uppercase text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          Admin login
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleAdminLogin}>
          {error && <ErrorMessage message={error} />}
          <Input
            type="email"
            label="Email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            type="password"
            label="Password"
            required
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          <Button type="submit" fullWidth loading={submitting}>
            Log in
          </Button>
        </form>
      </div>
    </PageWrapper>
  );
}
