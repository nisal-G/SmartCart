/**
 * Reasons the backend can put on `?error=` when it sends the browser back
 * from an OAuth callback it could not complete (see backend
 * authController.redirectOAuthFailure). Anything not listed falls back to
 * the generic message rather than showing a raw code to the shopper.
 */
export const OAUTH_ERROR_MESSAGES = {
  oauth_failed: "We couldn't complete sign-in with that provider. Please try again.",
  oauth_cancelled: 'Sign-in was cancelled, or the sign-in session expired. Please try again.',
  duplicate_callback: 'That sign-in link had already been used. Please sign in again.',
  account_unavailable: 'This account is not available. Please contact support.',
  timeout: 'Sign-in took too long to complete. Please try again.',
  incomplete: 'Sign-in did not finish. Please try again.',
  session_not_established: 'Sign-in completed, but your session could not be started. Please try again.',
};

export function oauthErrorMessage(code) {
  if (!code) return null;
  return OAUTH_ERROR_MESSAGES[code] || 'Sign-in could not be completed. Please try again.';
}
