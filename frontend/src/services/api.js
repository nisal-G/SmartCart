import axios from 'axios';

// Falls back to the backend's local dev default (see backend/.env.example)
// so the app still runs if VITE_API_BASE_URL isn't set, but every real
// deployment should set it explicitly.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Centralized Axios instance. The backend authenticates via httpOnly
 * cookies (accessToken/refreshToken — see backend/src/services/tokenService.js),
 * not an Authorization header, so `withCredentials` is what actually carries
 * the session on every request; there is no token to attach manually.
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Session-expiry notification -------------------------------------
// api.js must not import AuthContext directly (that would be a circular
// dependency: context -> services -> context). Instead it exposes a tiny
// subscription point that AuthContext registers itself with, so the rest
// of the app can react to "the session just ended" in one place.
let onSessionExpired = null;
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

let refreshPromise = null;

/** POST /auth/refresh via a plain axios call — bypasses this file's own
 * response interceptor so a failed refresh can never trigger itself again. */
function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, null, { withCredentials: true })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    // Network failure (backend unreachable, offline, CORS, timeout) — no
    // response at all. Let callers distinguish this from a real API error.
    if (!response) {
      return Promise.reject({
        isNetworkError: true,
        message: 'Unable to reach the server. Check your connection and try again.',
      });
    }

    const { status, data } = response;

    // A 401 with TOKEN_EXPIRED (see backend/src/middleware/authenticate.js)
    // means the access token cookie is stale but the session may still be
    // refreshable. Try exactly once per request, then replay it.
    if (status === 401 && data?.code === 'TOKEN_EXPIRED' && config && !config._retry) {
      config._retry = true;
      try {
        await refreshSession();
        return api(config);
      } catch {
        onSessionExpired?.();
      }
    } else if (status === 401 && !config?._retry) {
      // Any other 401 (missing/invalid cookie, suspended account) — the
      // session is not usable. Never surface this as an anonymous 401 to a
      // page that expected to be logged in without telling the app.
      onSessionExpired?.();
    }

    return Promise.reject({
      status,
      code: data?.code,
      message: data?.message || 'Something went wrong. Please try again.',
    });
  }
);

export default api;
