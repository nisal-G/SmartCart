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

// Capability statements, matching the ones used on the homepage — each is
// something the app actually does.
const ASSURANCES = [
  { icon: 'shield', text: 'PayHere-secured payments' },
  { icon: 'receipt', text: 'Order history on your account' },
  { icon: 'leaf', text: 'Fresh produce and bakery' },
];

export function Footer() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // The admin console gets a single-line footer instead of the storefront's
  // shop/account columns — those links belong to the shopper experience and
  // read as clutter (and as the wrong context) inside the admin area.
  // /admin/login is excluded: it's a public sign-in page (linked to from
  // the "Admin Portal" link below), not the authenticated console itself.
  if (location.pathname.startsWith(ROUTES.ADMIN) && location.pathname !== ROUTES.ADMIN_LOGIN) {
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
    <footer className="relative mt-auto overflow-hidden border-t border-slate-800 bg-slate-950 text-slate-300">
      {/* One soft brand wash so the dark footer doesn't read as a flat black
          slab. Decoration only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand-600/10 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Link to={ROUTES.HOME} className="inline-flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-brand">
                <Icon name="cart" size="md" strokeWidth={2} />
              </span>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Smart<span className="text-brand-400">Cart</span>
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-400">
              Browse fresh vegetables, fruits and bakery items, build your cart, and pay securely
              through PayHere.
            </p>

            <ul className="mt-6 flex flex-col gap-2.5">
              {ASSURANCES.map((item) => (
                <li key={item.text} className="flex items-center gap-2.5 text-sm text-slate-400">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-brand-400 ring-1 ring-white/10"
                    aria-hidden="true"
                  >
                    <Icon name={item.icon} size="xs" />
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Shop">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Shop</h2>
            <ul className="mt-5 space-y-3">
              {SHOP_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-brand-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Account</h2>
            <ul className="mt-5 space-y-3">
              {accountLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-brand-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {/*
                Discreet staff/admin entry point. Deliberately styled a
                notch smaller and quieter than the shopper links above it —
                this is a navigation convenience, not a security boundary
                (admin routes are enforced by ProtectedRoute + backend
                authorization regardless of whether this link is visible).
              */}
              <li className="pt-2">
                <Link
                  to={ROUTES.ADMIN_LOGIN}
                  className="rounded-sm text-xs text-slate-600 transition-colors hover:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Admin Portal
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} SmartCart. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <Icon name="shield" size="sm" className="text-brand-500" />
            Payments processed by PayHere
          </p>
        </div>
      </div>
    </footer>
  );
}
