import api, { API_BASE_URL } from './api';

/**
 * Auth API client — mirrors backend/src/routes/authRoutes.js exactly.
 * Sessions are httpOnly cookies set by the server on every successful call
 * here; this module never handles a raw token.
 */
const authService = {
  // --- OAuth (Google / Facebook) -----------------------------------------
  // These are full-page redirects, not XHR calls: the browser must navigate
  // away to the provider, so callers should set `window.location.href` to
  // these URLs rather than calling them through axios. On success the
  // backend redirects back to `${FRONTEND_URL}/auth/callback` with the
  // session cookies already set (see backend authController.oauthCallback).
  getGoogleLoginUrl() {
    return `${API_BASE_URL}/auth/google`;
  },
  getFacebookLoginUrl() {
    return `${API_BASE_URL}/auth/facebook`;
  },

  // --- Passkey / WebAuthn -------------------------------------------------
  // Ceremony option/verify payloads are handed as-is to/from
  // @simplewebauthn/browser once the passkey UI is built (not yet a
  // dependency of this foundation branch).
  passkeyRegisterOptions(payload) {
    return api.post('/auth/passkey/register/options', payload).then((res) => res.data);
  },
  passkeyRegisterVerify(payload) {
    return api.post('/auth/passkey/register/verify', payload).then((res) => res.data);
  },
  passkeyLoginOptions(payload) {
    return api.post('/auth/passkey/login/options', payload).then((res) => res.data);
  },
  passkeyLoginVerify(payload) {
    return api.post('/auth/passkey/login/verify', payload).then((res) => res.data);
  },

  // --- Admin (email + password) -------------------------------------------
  adminLogin({ email, password }) {
    return api.post('/auth/admin/login', { email, password }).then((res) => res.data);
  },

  // --- Session lifecycle ---------------------------------------------------
  refresh() {
    return api.post('/auth/refresh').then((res) => res.data);
  },
  logout() {
    return api.post('/auth/logout').then((res) => res.data);
  },
  getMe() {
    return api.get('/auth/me').then((res) => res.data.user);
  },
};

export default authService;
