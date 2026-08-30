import { useLocation } from 'react-router-dom';
import { classNames } from '../../utils/classNames';

/**
 * One shared enter transition for routed content: a small fade + upward
 * settle, ~220ms, GPU-only properties (`opacity`/`transform`) — reusing the
 * `animate-rise` keyframe already defined in index.css rather than adding a
 * page-transition-specific one.
 *
 * Keyed on `pathname` (not the full location, so a query-string-only change
 * — e.g. Products' category filter — never re-triggers it) so React
 * remounts this wrapper, and so re-plays the CSS entrance animation, only
 * when the page itself actually changes.
 *
 * Used at two levels rather than one: MainLayout wraps the storefront
 * Outlet directly, while AdminLayout wraps only its own inner Outlet with a
 * second instance — so admin sub-navigation fades just the content pane,
 * never the persistent sidebar around it.
 */
export function PageTransition({ children, className = 'flex flex-1 flex-col' }) {
  const { pathname } = useLocation();

  return (
    <div key={pathname} className={classNames('animate-rise', className)}>
      {children}
    </div>
  );
}
