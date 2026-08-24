import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { ROUTES } from '../../constants/routes';
import { Button } from '../ui/Button';
import { classNames } from '../../utils/classNames';

const NAV_LINKS = [
  { to: ROUTES.HOME, label: 'Home' },
  { to: ROUTES.PRODUCTS, label: 'Products' },
  { to: ROUTES.ORDERS, label: 'Orders' },
];

function linkClass({ isActive }) {
  return classNames(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'
  );
}

/** Responsive site header. No feature/business logic — only navigation and session-aware links. */
export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const { itemCount } = useCart();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to={ROUTES.HOME} className="text-lg font-semibold text-slate-900">
          SmartCart
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to={ROUTES.ADMIN} className={linkClass}>
              Admin
            </NavLink>
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to={ROUTES.CART}
            className="relative rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cart
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">
                {itemCount}
              </span>
            )}
          </Link>
          {isAuthenticated ? (
            <>
              <span className="text-sm text-slate-600">{user.name}</span>
              <Button size="sm" variant="outline" onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <Link to={ROUTES.LOGIN}>
              <Button size="sm">Login</Button>
            </Link>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span className="sr-only">Menu</span>
          <div className="flex h-5 w-6 flex-col justify-between">
            <span className="h-0.5 w-full bg-current" />
            <span className="h-0.5 w-full bg-current" />
            <span className="h-0.5 w-full bg-current" />
          </div>
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="border-t border-slate-200 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass} onClick={() => setMobileOpen(false)}>
                {link.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to={ROUTES.ADMIN} className={linkClass} onClick={() => setMobileOpen(false)}>
                Admin
              </NavLink>
            )}
            <NavLink to={ROUTES.CART} className={linkClass} onClick={() => setMobileOpen(false)}>
              Cart{itemCount > 0 ? ` (${itemCount})` : ''}
            </NavLink>
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            {isAuthenticated ? (
              <Button size="sm" variant="outline" fullWidth onClick={logout}>
                Logout {user.name}
              </Button>
            ) : (
              <Link to={ROUTES.LOGIN} onClick={() => setMobileOpen(false)}>
                <Button size="sm" fullWidth>
                  Login
                </Button>
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
