import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { Icon } from '../ui/Icon';
import { classNames } from '../../utils/classNames';

const ADMIN_LINKS = [
  { to: ROUTES.ADMIN, label: 'Dashboard', icon: 'dashboard', end: true },
  { to: ROUTES.ADMIN_PRODUCTS, label: 'Products', icon: 'package' },
  { to: ROUTES.ADMIN_CATEGORIES, label: 'Categories', icon: 'tag' },
  { to: ROUTES.ADMIN_ORDERS, label: 'Orders', icon: 'receipt' },
  { to: ROUTES.ADMIN_USERS, label: 'Users', icon: 'users' },
];

function sidebarLinkClass({ isActive }) {
  return classNames(
    'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors duration-150',
    isActive
      ? 'bg-slate-900 text-white shadow-xs'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  );
}

function pillLinkClass({ isActive }) {
  return classNames(
    'inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors duration-150',
    isActive
      ? 'border-slate-900 bg-slate-900 text-white'
      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
  );
}

/**
 * Admin area navigation (Dashboard / Products / Categories / Orders /
 * Users). Two presentations of the same link set:
 *
 *  - `variant="sidebar"` — the persistent desktop rail.
 *  - `variant="pills"`   — a horizontally scrolling strip for narrow
 *                          screens, where a rail would eat the content.
 *
 * Exactly one of the two is ever displayed at a given breakpoint (the
 * other is `display:none` via its wrapper in AdminLayout), so assistive
 * tech only ever sees one "Admin navigation" landmark.
 */
export function AdminNav({ variant = 'sidebar' }) {
  if (variant === 'pills') {
    return (
      <nav
        aria-label="Admin navigation"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0"
      >
        {ADMIN_LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={pillLinkClass}>
            <Icon name={link.icon} size="sm" />
            {link.label}
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-1">
      {ADMIN_LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end} className={sidebarLinkClass}>
          <Icon name={link.icon} size="md" />
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
