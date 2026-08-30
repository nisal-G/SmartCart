import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { ROUTES } from '../../constants/routes';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { AdminNav } from '../admin/AdminNav';
import categoryService from '../../services/categoryService';
import { classNames } from '../../utils/classNames';

// Only routes that actually exist (see routes/AppRoutes.jsx). "Orders" is
// session-gated because /orders is behind ProtectedRoute — offering it to a
// logged-out visitor would just bounce them to /login.
const PRIMARY_LINKS = [
  { to: ROUTES.HOME, label: 'Home', end: true },
  { to: ROUTES.PRODUCTS, label: 'All products' },
];

// The category strip is a convenience, not the catalogue: the full list
// always lives on /products, which owns filtering.
const MAX_CATEGORY_LINKS = 6;

// Announcement strip copy. Capability statements only — each one is
// something the app genuinely does; no invented delivery promises.
const ANNOUNCEMENTS = [
  { icon: 'shield', text: 'Secure checkout powered by PayHere' },
  { icon: 'leaf', text: 'Fresh produce, bakery and everyday essentials' },
  { icon: 'receipt', text: 'Track every order from your account' },
];

/**
 * Slim strip above the header. Deliberately *not* sticky — it scrolls away
 * with the page so the sticky header stays as short as possible, and it
 * carries no landmark role or links, so it never competes with the real
 * navigation below it.
 */
function AnnouncementBar() {
  return (
    <div className="bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-8 px-4 py-2 sm:px-6 lg:justify-between lg:px-8">
        <ul className="flex items-center gap-8">
          {ANNOUNCEMENTS.map((item, index) => (
            <li
              key={item.text}
              className={classNames(
                'flex items-center gap-2 text-xs font-medium text-white/75',
                // Only the first point fits on a phone; the rest appear as
                // the viewport allows rather than wrapping to a second row.
                index === 0 ? 'flex' : index === 1 ? 'hidden md:flex' : 'hidden xl:flex'
              )}
            >
              <Icon name={item.icon} size="xs" className="text-brand-400" />
              {item.text}
            </li>
          ))}
        </ul>
        <p className="hidden text-xs font-medium text-white/50 lg:block">
          Prices shown in LKR
        </p>
      </div>
    </div>
  );
}

/**
 * Storefront search. Submits to /products?search=… — the same server-side
 * `search` filter the catalogue already supports (see
 * backend/src/validators/productValidators.js); no new API is invented here.
 */
function SearchForm({ className }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // The URL is the source of truth for the current query, so the field is
  // uncontrolled and keyed on that value: React remounts it whenever the
  // URL's `search` changes (including on back/forward), which keeps the
  // two in step without an effect that mirrors one into component state.
  const urlTerm = location.pathname === ROUTES.PRODUCTS ? searchParams.get('search') || '' : '';

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = String(new FormData(event.currentTarget).get('q') || '').trim();
    navigate(trimmed ? `${ROUTES.PRODUCTS}?search=${encodeURIComponent(trimmed)}` : ROUTES.PRODUCTS);
  }

  return (
    <form role="search" onSubmit={handleSubmit} className={classNames('group relative', className)}>
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400 transition-colors duration-200 group-focus-within:text-brand-600">
        <Icon name="search" size="md" />
      </span>
      <input
        key={urlTerm}
        name="q"
        type="search"
        defaultValue={urlTerm}
        aria-label="Search products"
        placeholder="Search vegetables, fruits, bakery…"
        className={classNames(
          'h-12 w-full rounded-full border border-slate-200 bg-slate-100/70 pl-12 pr-28 text-sm text-slate-900',
          'transition-[background-color,border-color,box-shadow] duration-200 ease-standard',
          'placeholder:text-slate-500',
          'hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:shadow-card focus:outline-none focus:ring-4 focus:ring-brand-500/12'
        )}
      />
      <div className="absolute inset-y-1.5 right-1.5 flex">
        <Button type="submit" size="sm" className="rounded-full px-4">
          Search
        </Button>
      </div>
    </form>
  );
}

function CartLink({ itemCount }) {
  const label = itemCount > 0 ? `Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}` : 'Cart';

  // A one-shot "bump" on the badge whenever the count actually changes —
  // not a `key` on the count itself (which would also fire on every
  // *unrelated* re-render that happens to run while the count is
  // unchanged), but a counter bumped only inside the effect that compares
  // the new value against the previous one.
  const previousCount = useRef(itemCount);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (itemCount !== previousCount.current) {
      setBump((value) => value + 1);
      previousCount.current = itemCount;
    }
  }, [itemCount]);

  return (
    <Link
      to={ROUTES.CART}
      aria-label={label}
      className={classNames(
        'relative inline-flex h-11 items-center gap-2 rounded-full border border-transparent px-3.5 text-sm font-semibold text-slate-700',
        'transition-[background-color,border-color,color,transform] duration-200 ease-standard',
        'hover:-translate-y-px hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
      )}
    >
      <span className="relative">
        <Icon name="cart" size="lg" />
        {itemCount > 0 && (
          <span
            key={bump}
            className="absolute -right-2 -top-1.5 flex h-4.5 min-w-4.5 animate-cart-bump items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white"
          >
            {itemCount}
          </span>
        )}
      </span>
      <span className="hidden lg:inline">Cart</span>
    </Link>
  );
}

function desktopLinkClass({ isActive }) {
  return classNames(
    'relative inline-flex h-12 items-center rounded-md px-3 text-sm font-semibold transition-colors duration-200',
    // The underline animates its width from the centre out rather than
    // appearing all at once — the one flourish in the header.
    'after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:origin-center after:rounded-full after:bg-brand-600',
    'after:transition-transform after:duration-250 after:ease-entrance',
    isActive
      ? 'text-brand-700 after:scale-x-100'
      : 'text-slate-600 hover:text-slate-900 after:scale-x-0 hover:after:scale-x-100'
  );
}

function mobileLinkClass({ isActive }) {
  return classNames(
    'flex items-center justify-between rounded-control px-3 py-3 text-[15px] font-semibold transition-colors',
    isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-100'
  );
}

/** Responsive site header. No feature/business logic — only navigation and session-aware links. */
export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const { itemCount } = useCart();
  const location = useLocation();

  // Shrinks the brand row a touch and deepens the shadow once the page has
  // actually scrolled, so the sticky header still reads as "there" over
  // busy content without permanently taking more space than it needs.
  // rAF-throttled: `scroll` can fire far more often than the browser paints.
  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 8);
        ticking = false;
      });
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The admin area gets a deliberately quieter header — no storefront
  // search, category strip or announcement bar — so it never reads as the
  // shop itself. /admin/login is a public sign-in page, not the
  // authenticated admin console — it keeps the normal storefront header
  // (see MainLayout.jsx / Footer.jsx for the same exclusion).
  const isAdminArea =
    location.pathname.startsWith(ROUTES.ADMIN) && location.pathname !== ROUTES.ADMIN_LOGIN;

  // Non-critical: if categories fail to load the strip simply doesn't render.
  useEffect(() => {
    let ignore = false;
    categoryService
      .getCategories()
      .then((data) => {
        if (!ignore) setCategories(data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  // The panel closes on navigation because every link inside it calls
  // closeMobile on click (see below) — deliberately not an effect on
  // `location`, which would be a setState-in-effect cascade for something
  // the click handlers already know.

  // Escape closes the panel, matching the usual overlay convention.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const visibleCategories = categories.slice(0, MAX_CATEGORY_LINKS);

  return (
    <>
      {!isAdminArea && <AnnouncementBar />}

      <header
        className={classNames(
          'sticky top-0 z-40 border-b bg-white/95 backdrop-blur-xl',
          'supports-backdrop-filter:bg-white/85 transition-[box-shadow,border-color] duration-300 ease-standard',
          scrolled ? 'border-slate-200 shadow-card-hover' : 'border-slate-200/70 shadow-header'
        )}
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Row 1 — brand, search, account, cart. Height eases down a couple
              of pixels once scrolled — a fixed h-* pair, not `auto`, so the
              transition actually animates rather than snapping. */}
          <div
            className={classNames(
              'flex items-center gap-3 transition-[height] duration-300 ease-standard',
              scrolled ? 'h-16' : 'h-18'
            )}
          >
            <button
              type="button"
              className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-control text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileOpen((open) => !open)}
            >
              <Icon name={mobileOpen ? 'close' : 'menu'} size="lg" />
            </button>

            <Link
              to={ROUTES.HOME}
              className="group flex shrink-0 items-center gap-2.5 rounded-md py-1 pr-1"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-brand transition-transform duration-300 ease-entrance group-hover:scale-105 group-hover:-rotate-3">
                <Icon name="cart" size="md" strokeWidth={2} />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-xl font-extrabold tracking-tight text-slate-900">
                  Smart<span className="text-brand-600">Cart</span>
                </span>
                {isAdminArea ? (
                  <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Admin
                  </span>
                ) : (
                  <span className="mt-1 hidden text-[11px] font-medium tracking-wide text-slate-500 sm:block">
                    Groceries, delivered
                  </span>
                )}
              </span>
            </Link>

            {!isAdminArea && <SearchForm className="hidden flex-1 md:block lg:max-w-2xl" />}

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              {isAdmin && !isAdminArea && (
                <Link
                  to={ROUTES.ADMIN}
                  className="hidden h-11 items-center gap-1.5 rounded-full border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 transition-[border-color,background-color,transform] duration-200 ease-standard hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 md:inline-flex"
                >
                  <Icon name="shield" size="sm" />
                  Admin
                </Link>
              )}

              {isAuthenticated ? (
                <div className="hidden items-center gap-2 md:flex">
                  <span className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 shadow-xs">
                    <Avatar
                      name={user.name}
                      avatarUrl={user.avatarUrl}
                      className="h-8 w-8 bg-brand-100 text-xs font-bold text-brand-800"
                    />
                    <span className="hidden min-w-0 flex-col leading-tight lg:flex">
                      <span className="max-w-36 truncate text-sm font-semibold text-slate-800">
                        {user.name}
                      </span>
                      <span className="text-[11px] text-slate-500">Signed in</span>
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={logout}>
                    <Icon name="logout" size="sm" />
                    Logout
                  </Button>
                </div>
              ) : (
                <Link to={ROUTES.LOGIN} className="hidden md:block">
                  <Button size="sm" variant="outline">
                    <Icon name="user" size="sm" />
                    Login
                  </Button>
                </Link>
              )}

              <CartLink itemCount={itemCount} />
            </div>
          </div>

          {/* Row 1b — mobile search, always visible on the storefront so the
              catalogue stays one tap away without opening the menu. */}
          {!isAdminArea && <SearchForm className="pb-3 md:hidden" />}

          {/* Row 2 — desktop primary + category navigation */}
          {!isAdminArea && (
            <nav aria-label="Primary" className="hidden h-12 items-center gap-1 md:flex">
              {PRIMARY_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} className={desktopLinkClass}>
                  {link.label}
                </NavLink>
              ))}
              {isAuthenticated && (
                <NavLink to={ROUTES.ORDERS} className={desktopLinkClass}>
                  Orders
                </NavLink>
              )}

              {visibleCategories.length > 0 && (
                <>
                  <span className="mx-3 h-5 w-px bg-slate-200" aria-hidden="true" />
                  <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto scrollbar-none">
                    {visibleCategories.map((category) => (
                      <Link
                        key={category._id}
                        to={`${ROUTES.PRODUCTS}?category=${category._id}`}
                        className="inline-flex h-8 shrink-0 items-center rounded-full border border-transparent px-3 text-sm font-medium text-slate-600 transition-colors duration-200 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </nav>
          )}
        </div>

        {/* Mobile navigation panel */}
        {mobileOpen && (
          <div
            id="mobile-navigation"
            className="animate-slide-down border-t border-slate-200 bg-white shadow-panel md:hidden"
          >
            <nav aria-label="Mobile" className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6">
              {isAdminArea ? (
                // Full grouped admin nav (Dashboard/Products/Categories/
                // Orders/Users + View storefront) — the phone-width
                // counterpart to the desktop sidebar, rather than the single
                // "Admin" link a logged-in admin gets on the storefront.
                <div className="animate-drawer-in">
                  <AdminNav variant="drawer" onNavigate={closeMobile} />
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    {PRIMARY_LINKS.map((link) => (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.end}
                        className={mobileLinkClass}
                        onClick={closeMobile}
                      >
                        {link.label}
                        <Icon name="chevronRight" size="sm" className="text-slate-300" />
                      </NavLink>
                    ))}
                    {isAuthenticated && (
                      <NavLink to={ROUTES.ORDERS} className={mobileLinkClass} onClick={closeMobile}>
                        Orders
                        <Icon name="chevronRight" size="sm" className="text-slate-300" />
                      </NavLink>
                    )}
                    {isAdmin && (
                      <NavLink to={ROUTES.ADMIN} className={mobileLinkClass} onClick={closeMobile}>
                        Admin
                        <Icon name="chevronRight" size="sm" className="text-slate-300" />
                      </NavLink>
                    )}
                  </div>

                  {visibleCategories.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                        Shop by category
                      </p>
                      <div className="flex flex-wrap gap-2 px-1">
                        {visibleCategories.map((category) => (
                          <Link
                            key={category._id}
                            to={`${ROUTES.PRODUCTS}?category=${category._id}`}
                            onClick={closeMobile}
                            className="rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                          >
                            {category.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mt-4 border-t border-slate-100 pt-4">
                {isAuthenticated ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        name={user.name}
                        avatarUrl={user.avatarUrl}
                        className="h-10 w-10 bg-brand-100 text-xs font-bold text-brand-800"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {user.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">Signed in</span>
                      </span>
                    </span>
                    <Button size="sm" variant="outline" onClick={logout}>
                      <Icon name="logout" size="sm" />
                      Logout
                    </Button>
                  </div>
                ) : (
                  <Link to={ROUTES.LOGIN} onClick={closeMobile} className="block">
                    <Button fullWidth>
                      <Icon name="user" size="sm" />
                      Login
                    </Button>
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
