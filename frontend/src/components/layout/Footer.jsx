import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { Icon } from '../ui/Icon';
import { useAuth } from '../../hooks/useAuth';

/**
 * Site footer. Navigation and branding only — every link points at a route
 * that actually exists (routes/AppRoutes.jsx), and no contact details,
 * social profiles or company claims are invented for the sake of filling
 * columns.
 */
const SHOP_LINKS = [
  { to: ROUTES.HOME, label: 'Home' },
  { to: ROUTES.PRODUCTS, label: 'Shop all' },
  { to: ROUTES.CART, label: 'Your cart' },
];

export function Footer() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // The admin console gets a single-line footer instead of the storefront's
  // shop/account columns — those links belong to the shopper experience and
  // read as clutter (and as the wrong context) inside the admin area.
  if (location.pathname.startsWith(ROUTES.ADMIN)) {
    return (
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} SmartCart. Admin console.</p>
          <Link
            to={ROUTES.HOME}
            className="inline-flex items-center gap-1.5 font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            <Icon name="store" size="sm" />
            View storefront
          </Link>
        </div>
      </footer>
    );
  }

  const accountLinks = isAuthenticated
    ? [
        { to: ROUTES.ORDERS, label: 'Your orders' },
        { to: ROUTES.CHECKOUT, label: 'Checkout' },
      ]
    : [{ to: ROUTES.LOGIN, label: 'Sign in' }];

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <Link to={ROUTES.HOME} className="inline-flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Icon name="cart" size="md" strokeWidth={2} />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                Smart<span className="text-brand-600">Cart</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
              Browse fresh vegetables, fruits and bakery items, build your cart, and pay securely
              through PayHere.
            </p>
          </div>

          <nav aria-label="Shop">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Shop</h2>
            <ul className="mt-4 space-y-2.5">
              {SHOP_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-slate-600 transition-colors hover:text-brand-700"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Account
            </h2>
            <ul className="mt-4 space-y-2.5">
              {accountLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-slate-600 transition-colors hover:text-brand-700"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-100 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} SmartCart. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <Icon name="shield" size="sm" className="text-slate-400" />
            Payments processed by PayHere
          </p>
        </div>
      </div>
    </footer>
  );
}
