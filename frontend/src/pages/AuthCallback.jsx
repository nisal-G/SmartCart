import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';
import { oauthErrorMessage } from '../constants/oauthErrors';

/**
 * Landing page for the OAuth redirect flow. After a successful Google/
 * Facebook login the backend sets the session cookies and redirects the
 * browser here (see backend authController.oauthCallback ->
 * `${FRONTEND_URL}/auth/callback`). This page's only job is to confirm the
 * session took (via GET /auth/me) and continue into the app.
 *
 * The check runs exactly once per mount even under React StrictMode's
 * double-invoked effects (see `startedRef`) — /auth/me is harmless to
 * repeat, but the OAuth leg must never look like a retried request.
 */
export function AuthCallback() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // The backend redirects failures to /login?error=..., so an error on this
  // route means someone landed here directly with one — known before the
  // first render, so it seeds the state rather than being set from an effect.
  const errorParam = searchParams.get('error');
  const [status, setStatus] = useState(errorParam ? 'failed' : 'checking'); // 'checking' | 'done' | 'failed'
  const [errorCode, setErrorCode] = useState(errorParam);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || errorParam) return;
    startedRef.current = true;

    refreshUser().then((currentUser) => {
      if (currentUser) {
        setStatus('done');
      } else {
        // The provider leg succeeded but the session cookie did not survive
        // — surface it instead of silently dropping the user on the home
        // page still logged out.
        setErrorCode('session_not_established');
        setStatus('failed');
      }
    });
  }, [refreshUser, errorParam]);

  if (status === 'checking') {
    return (
      <PageWrapper>
        <Loading label="Finishing sign-in…" />
      </PageWrapper>
    );
  }

  if (status === 'failed') {
    return (
      <PageWrapper>
        <div className="mx-auto w-full max-w-md py-10">
          <ErrorMessage
            title="Sign-in didn't complete"
            message={oauthErrorMessage(errorCode)}
            onRetry={() => navigate(ROUTES.LOGIN, { replace: true })}
          />
        </div>
      </PageWrapper>
    );
  }

  return <Navigate to={ROUTES.HOME} replace />;
}
