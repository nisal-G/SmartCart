import { useContext } from 'react';
import { ToastContext } from '../context/ToastContext';

/** Access the admin toast stack from anywhere under ToastProvider (see layouts/AdminLayout.jsx). */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
