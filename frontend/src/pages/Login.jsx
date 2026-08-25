import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';

/**
 * A DOMException's own `.message` for a cancelled/timed-out WebAuthn
 * ceremony is inconsistent (and sometimes cryptic) across browsers/OSes, so
 * that one case gets a friendly override; everything else — including
 * @simplewebauthn/browser's own `WebAuthnError` messages and the backend's
 * API error messages — is already written for end users and shown as-is.
 */
function passkeyErrorMessage(err) {
  if (err?.name === 'NotAllowedError' || err?.code === 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY') {
    return 'Passkey action was cancelled or timed out. Please try again.';
  }
  return err?.message || 'Something went wrong. Please try again.';
}

const PASSKEY_PANEL = {
  CLOSED: 'closed',
  // Existing account: email only, then the browser's passkey prompt.
  LOGIN: 'login',
  // No passkey account for that email yet: collect a name and create one.
  REGISTER: 'register',
};

/**
 * Login screen wired to the real auth foundation: Google/Facebook trigger a
 * full-page OAuth redirect (see authService), Passkey drives the
 * @simplewebauthn/browser ceremony via AuthContext, and the email/password
 * form only ever authenticates admin accounts (SRS §3.1 — shoppers use
 * Google/Facebook/Passkey only).
 */
export function Login() {
  const { loginWithGoogle, loginWithFacebook, adminLogin, loginWithPasskey, registerPasskey } =
    useAuth();
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

  // browserSupportsWebAuthn() just checks for navigator.credentials —
  // constant for the life of the page, so this doesn't need to live in state.
  const passkeySupported = browserSupportsWebAuthn();
  const [passkeyPanel, setPasskeyPanel] = useState(PASSKEY_PANEL.CLOSED);
  const [passkeyEmail, setPasskeyEmail] = useState('');
  const [passkeyName, setPasskeyName] = useState('');
  const [passkeyError, setPasskeyError] = useState(null);
  const [passkeySubmitting, setPasskeySubmitting] = useState(false);

  function closePasskeyPanel() {
    setPasskeyPanel(PASSKEY_PANEL.CLOSED);
    setPasskeyError(null);
    setPasskeyEmail('');
    setPasskeyName('');
  }

  async function handlePasskeyLogin(event) {
    event.preventDefault();
    setPasskeyError(null);
    setPasskeySubmitting(true);
    try {
      await loginWithPasskey(passkeyEmail);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err?.status === 404) {
        // Backend: "No passkey account found for this email" — offer to
        // create one instead of just dead-ending on an error.
        setPasskeyPanel(PASSKEY_PANEL.REGISTER);
      } else {
        setPasskeyError(passkeyErrorMessage(err));
      }
    } finally {
      setPasskeySubmitting(false);
    }
  }

  async function handlePasskeyRegister(event) {
    event.preventDefault();
    setPasskeyError(null);
    setPasskeySubmitting(true);
    try {
      await registerPasskey({ name: passkeyName, email: passkeyEmail });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err?.status === 409) {
        // Backend: email belongs to a Google/Facebook-only account already.
        setPasskeyError(
          'An account with this email already exists. Log in with Google or Facebook above, then add a passkey from your account.'
        );
      } else {
        setPasskeyError(passkeyErrorMessage(err));
      }
    } finally {
      setPasskeySubmitting(false);
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

          {passkeyPanel === PASSKEY_PANEL.CLOSED && (
            <Button
              variant="outline"
              fullWidth
              disabled={!passkeySupported}
              title={
                passkeySupported ? undefined : 'Passkeys are not supported in this browser'
              }
              onClick={() => setPasskeyPanel(PASSKEY_PANEL.LOGIN)}
            >
              Continue with Passkey
            </Button>
          )}

          {passkeyPanel === PASSKEY_PANEL.LOGIN && (
            <form
              className="flex flex-col gap-3 rounded-md border border-slate-200 p-4"
              onSubmit={handlePasskeyLogin}
            >
              {passkeyError && <ErrorMessage message={passkeyError} />}
              <Input
                type="email"
                label="Email"
                required
                autoFocus
                value={passkeyEmail}
                onChange={(e) => setPasskeyEmail(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit" fullWidth loading={passkeySubmitting}>
                  Continue with Passkey
                </Button>
                <Button type="button" variant="secondary" onClick={closePasskeyPanel}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {passkeyPanel === PASSKEY_PANEL.REGISTER && (
            <form
              className="flex flex-col gap-3 rounded-md border border-slate-200 p-4"
              onSubmit={handlePasskeyRegister}
            >
              <p className="text-sm text-slate-600">
                No passkey account found for <strong>{passkeyEmail}</strong>. Create one now?
              </p>
              {passkeyError && <ErrorMessage message={passkeyError} />}
              <Input
                label="Name"
                required
                autoFocus
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit" fullWidth loading={passkeySubmitting}>
                  Create passkey account
                </Button>
                <Button type="button" variant="secondary" onClick={closePasskeyPanel}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
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
