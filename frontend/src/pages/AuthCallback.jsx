import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';

/**
 * Landing page for the OAuth redirect flow. After a successful Google/
 * Facebook login, the backend sets the session cookies and redirects the
 * browser here (see backend authController.oauthCallback ->
 * `${FRONTEND_URL}/auth/callback`). This page's only job is to confirm the
 * session took (via GET /auth/me) and continue on into the app.
 */
export function AuthCallback() {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState('checking'); // 'checking' | 'done' | 'failed'

  useEffect(() => {
    refreshUser().then(() => setStatus('done'));
  }, [refreshUser]);

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
        <ErrorMessage message="We couldn't complete sign-in. Please try again." />
      </PageWrapper>
    );
  }

  return <Navigate to={ROUTES.HOME} replace />;
}
