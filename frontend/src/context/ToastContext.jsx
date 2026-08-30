/* eslint-disable react-refresh/only-export-components -- see AuthContext.jsx */
import { createContext, useCallback, useMemo, useRef, useState } from 'react';
import { ToastViewport } from '../components/ui/Toast';

export const ToastContext = createContext(null);

const DISPLAY_DURATION = 4000;
const EXIT_DURATION = 160; // matches --animate-toast-out in index.css

/**
 * Lightweight, dependency-free toast stack. Mounted per-area (see
 * layouts/AdminLayout.jsx) rather than at the app root, so its blast radius
 * stays scoped to wherever it's actually used — today, just /admin/*.
 *
 * Deliberately only used for admin actions that don't already have their
 * own on-page confirmation: product/category delete, user status changes.
 * Flows that already show an inline SuccessMessage (product/category
 * create+update, order status update) are left alone — those exact strings
 * are asserted on by the Playwright suite, and a toast on top would just be
 * a second notification for the same event.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    // Flip to "leaving" first so the exit animation actually plays, then
    // remove after it's had time to finish — never yanked out mid-animation.
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_DURATION);
  }, []);

  const push = useCallback(
    (message, tone) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, tone, leaving: false }]);
      setTimeout(() => dismiss(id), DISPLAY_DURATION);
      return id;
    },
    [dismiss]
  );

  const success = useCallback((message) => push(message, 'success'), [push]);
  const error = useCallback((message) => push(message, 'error'), [push]);

  const value = useMemo(() => ({ success, error, dismiss }), [success, error, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
