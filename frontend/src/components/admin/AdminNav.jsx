import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { classNames } from '../../utils/classNames';

const ADMIN_LINKS = [
  { to: ROUTES.ADMIN, label: 'Dashboard', end: true },
  { to: ROUTES.ADMIN_PRODUCTS, label: 'Products' },
  { to: ROUTES.ADMIN_CATEGORIES, label: 'Categories' },
  { to: ROUTES.ADMIN_ORDERS, label: 'Orders' },
  { to: ROUTES.ADMIN_USERS, label: 'Users' },
];

function linkClass({ isActive }) {
  return classNames(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  );
}

/** Sub-navigation for the admin area (Dashboard / Products / Categories / Orders / Users). Scrolls horizontally instead of wrapping on narrow screens. */
export function AdminNav() {
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Admin navigation">
      {ADMIN_LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
