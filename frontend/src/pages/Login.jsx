import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Icon } from '../components/ui/Icon';
import { Avatar } from '../components/ui/Avatar';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { SuccessMessage } from '../components/common/SuccessMessage';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';
import { oauthErrorMessage } from '../constants/oauthErrors';

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
  // No passkey account for that email yet: collect a name and create one,
  // UNLESS the email turns out to already belong to a Google/Facebook
  // account (see `passkeyConflictEmail`) — that isn't a form to fill in,
  // it's a dead end that needs a different message and different actions.
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
 *
 * It also doubles as the one place a signed-in shopper can add a passkey to
 * their existing account (there is no separate account/settings page yet).
 * Reaching /login while already authenticated — e.g. after signing in with
 * Google/Facebook and then navigating back here — renders a distinct
 * "add a passkey to your account" view instead of the sign-in chooser: see
 * `isAuthenticated` below. That view calls the same `registerPasskey`
 * action as anonymous signup, but with no email prompt — the backend binds
 * the new credential to the current session's account (`req.user`) rather
 * than to whatever's in the request body (backend authController
 * passkeyRegisterOptions), so there is no way for this to attach the
 * credential to a different account.
 */
export function Login() {
  const { isAuthenticated, user, loginWithGoogle, loginWithFacebook, loginWithPasskey, registerPasskey } =
    useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Set by the backend when it could not finish an OAuth callback and sent
  // the browser back here (see backend authController.redirectOAuthFailure).
  const oauthError = oauthErrorMessage(searchParams.get('error'));
  // A second click would start a fresh authorization while the first
  // full-page redirect is still in flight — two provider round-trips for
  // one intent. The page is navigating away, so this never needs resetting.
  const [oauthRedirecting, setOauthRedirecting] = useState(false);

  function startOAuth(begin) {
    if (oauthRedirecting) return;
    setOauthRedirecting(true);
    begin();
  }
  const redirectTo = location.state?.from?.pathname || ROUTES.HOME;

  // browserSupportsWebAuthn() just checks for navigator.credentials —
  // constant for the life of the page, so this doesn't need to live in state.
  const passkeySupported = browserSupportsWebAuthn();
  const [passkeyPanel, setPasskeyPanel] = useState(PASSKEY_PANEL.CLOSED);
  const [passkeyEmail, setPasskeyEmail] = useState('');
  const [passkeyName, setPasskeyName] = useState('');
  const [passkeyError, setPasskeyError] = useState(null);
  // Set instead of passkeyError when the backend's 409 tells us this email
  // already has a Google/Facebook account — an expected, informational
  // outcome for an anonymous visitor, not a failure. Distinct from
  // passkeyError so the two are never both true and never render as a red
  // "Something went wrong" box on top of the "create one?" prompt.
  const [passkeyConflictEmail, setPasskeyConflictEmail] = useState(null);
  const [passkeySubmitting, setPasskeySubmitting] = useState(false);

  // --- Signed-in shopper adding a passkey to their own account -----------
  const [addPasskeyOpen, setAddPasskeyOpen] = useState(false);
  const [addPasskeyNickname, setAddPasskeyNickname] = useState('');
  const [addPasskeyError, setAddPasskeyError] = useState(null);
  const [addPasskeySubmitting, setAddPasskeySubmitting] = useState(false);
  const [addPasskeyDone, setAddPasskeyDone] = useState(false);

  function closePasskeyPanel() {
    setPasskeyPanel(PASSKEY_PANEL.CLOSED);
    setPasskeyError(null);
    setPasskeyConflictEmail(null);
    setPasskeyEmail('');
    setPasskeyName('');
  }

  async function handlePasskeyLogin(event) {
    event.preventDefault();
    setPasskeyError(null);
    setPasskeyConflictEmail(null);
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
    setPasskeyConflictEmail(null);
    setPasskeySubmitting(true);
    try {
      await registerPasskey({ name: passkeyName, email: passkeyEmail });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err?.status === 409) {
        // Backend: email belongs to a Google/Facebook-only account already.
        // Not an error to alarm the user with — it just means the next step
        // is signing in with that provider, which the conflict view below
        // offers directly.
        setPasskeyConflictEmail(passkeyEmail);
      } else {
        setPasskeyError(passkeyErrorMessage(err));
      }
    } finally {
      setPasskeySubmitting(false);
    }
  }

  async function handleAddPasskey(event) {
    event.preventDefault();
    setAddPasskeyError(null);
    setAddPasskeySubmitting(true);
    try {
      // No name/email: the backend attaches this credential to the
      // currently authenticated account (req.user) regardless of what a
      // request body might contain — see authController.passkeyRegisterOptions.
      await registerPasskey({ nickname: addPasskeyNickname || undefined });
      setAddPasskeyDone(true);
      setAddPasskeyOpen(false);
    } catch (err) {
      setAddPasskeyError(passkeyErrorMessage(err));
    } finally {
      setAddPasskeySubmitting(false);
    }
  }

  if (isAuthenticated) {
    return (
      <PageWrapper className="flex items-center">
        <div className="mx-auto w-full max-w-md py-4 sm:py-8">
          <div className="flex flex-col items-center text-center">
            <Avatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              className="h-14 w-14 bg-brand-100 text-lg font-bold text-brand-800"
            />
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
              You&apos;re signed in
            </h1>
            <p className="mt-2.5 text-pretty text-sm leading-relaxed text-slate-600">
              Signed in as <strong className="text-slate-900">{user.name}</strong> ({user.email})
            </p>
          </div>

          <div className="mt-8 animate-scale-in rounded-panel border border-slate-200/80 bg-white p-6 shadow-panel sm:p-8">
            {addPasskeyDone && (
              <SuccessMessage message="Passkey added. You can use it to sign in next time." />
            )}

            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-600">
                Add a passkey to sign in faster next time, using your device&apos;s screen lock instead
                of a password.
              </p>

              {!addPasskeyOpen ? (
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  disabled={!passkeySupported}
                  title={passkeySupported ? undefined : 'Passkeys are not supported in this browser'}
                  onClick={() => {
                    setAddPasskeyDone(false);
                    setAddPasskeyOpen(true);
                  }}
                >
                  <Icon name="key" size="md" />
                  Add a passkey to my account
                </Button>
              ) : (
                <form
                  className="flex animate-scale-in flex-col gap-4 rounded-card border border-slate-200 bg-sunken/70 p-5"
                  onSubmit={handleAddPasskey}
                >
                  {addPasskeyError && <ErrorMessage message={addPasskeyError} />}
                  <Input
                    label="Nickname (optional)"
                    autoFocus
                    placeholder="e.g. My laptop"
                    hint="Helps you tell devices apart later — you can skip this."
                    value={addPasskeyNickname}
                    onChange={(e) => setAddPasskeyNickname(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" fullWidth loading={addPasskeySubmitting}>
                      Continue
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAddPasskeyOpen(false);
                        setAddPasskeyError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              <Button variant="ghost" size="lg" fullWidth onClick={() => navigate(redirectTo, { replace: true })}>
                Not now — continue to SmartCart
              </Button>
            </div>
          </div>
        </div>
      </PageWrapper>
    );
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
            {oauthError && <ErrorMessage title="Sign-in didn't complete" message={oauthError} />}
            <Button
              variant="outline"
              size="lg"
              fullWidth
              disabled={oauthRedirecting}
              onClick={() => startOAuth(loginWithGoogle)}
            >
              <Icon name="google" size="md" />
              Continue with Google
            </Button>
            <Button
              variant="outline"
              size="lg"
              fullWidth
              disabled={oauthRedirecting}
              onClick={() => startOAuth(loginWithFacebook)}
            >
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

            {passkeyPanel === PASSKEY_PANEL.REGISTER && passkeyConflictEmail && (
              // The 409 case: passkeyConflictEmail already has an account —
              // via Google/Facebook, since it has no passkeys (that's what
              // brought us here from the LOGIN panel above). This isn't a
              // failure state, so it gets an informational panel with a
              // direct way forward, not an ErrorMessage/"Something went
              // wrong" box stacked underneath the "create one?" prompt.
              <div
                role="status"
                className="flex animate-scale-in flex-col gap-4 rounded-card border border-brand-200 bg-brand-50/70 p-5 text-left"
              >
                <div className="flex gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"
                    aria-hidden="true"
                  >
                    <Icon name="info" size="md" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">You already have an account</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      <strong className="text-slate-900">{passkeyConflictEmail}</strong> is already
                      registered with SmartCart. Sign in below, then add a passkey from your account.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    fullWidth
                    disabled={oauthRedirecting}
                    onClick={() => startOAuth(loginWithGoogle)}
                  >
                    <Icon name="google" size="md" />
                    Continue with Google
                  </Button>
                  <Button
                    variant="outline"
                    fullWidth
                    disabled={oauthRedirecting}
                    onClick={() => startOAuth(loginWithFacebook)}
                  >
                    <Icon name="facebook" size="md" />
                    Continue with Facebook
                  </Button>
                  <Button type="button" variant="ghost" onClick={closePasskeyPanel}>
                    Back
                  </Button>
                </div>
              </div>
            )}

            {passkeyPanel === PASSKEY_PANEL.REGISTER && !passkeyConflictEmail && (
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
