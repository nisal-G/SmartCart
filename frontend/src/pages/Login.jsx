import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Icon } from '../components/ui/Icon';
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
 * full-page OAuth redirect (see authService), and Passkey drives the
 * @simplewebauthn/browser ceremony via AuthContext. This page is
 * shopper-only (SRS §3.1 — shoppers use Google/Facebook/Passkey only);
 * administrator email/password sign-in lives on its own dedicated route
 * (see pages/admin/AdminLogin.jsx), reachable from the site footer rather
 * than from here.
 */
export function Login() {
  const { loginWithGoogle, loginWithFacebook, loginWithPasskey, registerPasskey } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || ROUTES.HOME;

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
    <PageWrapper className="flex items-center">
      <div className="mx-auto w-full max-w-md py-4 sm:py-8">
        <div className="flex flex-col items-center text-center">
          <Link to={ROUTES.HOME} className="group flex items-center gap-2.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-brand transition-transform duration-300 ease-entrance group-hover:scale-105">
              <Icon name="cart" size="lg" strokeWidth={2} />
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              Smart<span className="text-brand-600">Cart</span>
            </span>
          </Link>
          <h1 className="mt-7 text-3xl font-bold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-2.5 text-pretty text-sm leading-relaxed text-slate-600">
            Sign in to build your cart, check out and track your orders.
          </p>
        </div>

        <div className="mt-8 animate-scale-in rounded-panel border border-slate-200/80 bg-white p-6 shadow-panel sm:p-8">
          <div className="flex flex-col gap-3">
            <Button variant="outline" size="lg" fullWidth onClick={loginWithGoogle}>
              <Icon name="google" size="md" />
              Continue with Google
            </Button>
            <Button variant="outline" size="lg" fullWidth onClick={loginWithFacebook}>
              <Icon name="facebook" size="md" />
              Continue with Facebook
            </Button>

            {passkeyPanel === PASSKEY_PANEL.CLOSED && (
              <Button
                variant="outline"
                size="lg"
                fullWidth
                disabled={!passkeySupported}
                title={passkeySupported ? undefined : 'Passkeys are not supported in this browser'}
                onClick={() => setPasskeyPanel(PASSKEY_PANEL.LOGIN)}
              >
                <Icon name="key" size="md" />
                Continue with Passkey
              </Button>
            )}

            {passkeyPanel === PASSKEY_PANEL.LOGIN && (
              <form
                className="flex animate-scale-in flex-col gap-4 rounded-card border border-slate-200 bg-sunken/70 p-5"
                onSubmit={handlePasskeyLogin}
              >
                {passkeyError && <ErrorMessage message={passkeyError} />}
                <Input
                  type="email"
                  label="Email"
                  required
                  autoFocus
                  autoComplete="username webauthn"
                  placeholder="you@example.com"
                  value={passkeyEmail}
                  onChange={(e) => setPasskeyEmail(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button type="submit" fullWidth loading={passkeySubmitting}>
                    Continue with Passkey
                  </Button>
                  <Button type="button" variant="outline" onClick={closePasskeyPanel}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {passkeyPanel === PASSKEY_PANEL.REGISTER && (
              <form
                className="flex animate-scale-in flex-col gap-4 rounded-card border border-slate-200 bg-sunken/70 p-5"
                onSubmit={handlePasskeyRegister}
              >
                <p className="text-sm text-slate-600">
                  No passkey account found for <strong className="text-slate-900">{passkeyEmail}</strong>. Create
                  one now?
                </p>
                {passkeyError && <ErrorMessage message={passkeyError} />}
                <Input
                  label="Name"
                  required
                  autoFocus
                  placeholder="Your full name"
                  value={passkeyName}
                  onChange={(e) => setPasskeyName(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button type="submit" fullWidth loading={passkeySubmitting}>
                    Create passkey account
                  </Button>
                  <Button type="button" variant="outline" onClick={closePasskeyPanel}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        <p className="mt-7 flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-slate-500">
          <Icon name="shield" size="xs" className="shrink-0 text-brand-600" />
          By continuing you agree to SmartCart&apos;s terms and privacy policy.
        </p>
      </div>
    </PageWrapper>
  );
}
