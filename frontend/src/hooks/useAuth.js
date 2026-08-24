import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/** Access the current session and auth actions from anywhere under AuthProvider. */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
