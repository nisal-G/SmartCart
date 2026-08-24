// This file deliberately exports both the context object and its provider
// component together (the idiomatic React context pattern) — that trips
// react-refresh's "only export components" rule, which otherwise exists to
// keep Fast Refresh working, so it's turned off for this file only.
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService';
import { setSessionExpiredHandler } from '../services/api';
import { ROLES } from '../constants/roles';

export const AuthContext = createContext(null);

/**
 * Owns the current session. The backend session lives in httpOnly cookies
 * (see backend/src/services/tokenService.js) that JS can't read directly,
 * so "am I logged in" is only ever known by asking GET /auth/me and reacting
 * to whether it succeeds — never by inspecting a token client-side.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first mount, silently check whether a session cookie from a previous
  // visit is still valid. Written as an inline promise chain (rather than
  // calling a shared helper) so every setState call is a literal callback
  // passed to .then/.catch/.finally, not a synchronous call in the effect
  // body itself.
  useEffect(() => {
    let ignore = false;
    authService
      .getMe()
      .then((currentUser) => {
        if (!ignore) setUser(currentUser);
      })
      .catch(() => {
        if (!ignore) setUser(null);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authService.getMe();
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // Registers this provider as api.js's single point of contact for "the
  // session just ended" (a refresh attempt failed) so the UI drops back to
  // logged-out state immediately instead of on the next manual /me check.
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  const loginWithGoogle = useCallback(() => {
    window.location.href = authService.getGoogleLoginUrl();
  }, []);

  const loginWithFacebook = useCallback(() => {
    window.location.href = authService.getFacebookLoginUrl();
  }, []);

  const adminLogin = useCallback(async (credentials) => {
    const { user: loggedInUser } = await authService.adminLogin(credentials);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === ROLES.ADMIN,
      loginWithGoogle,
      loginWithFacebook,
      adminLogin,
      logout,
      refreshUser,
    }),
    [user, loading, loginWithGoogle, loginWithFacebook, adminLogin, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
