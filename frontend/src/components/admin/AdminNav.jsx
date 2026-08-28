import { Link, NavLink } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { Icon } from '../ui/Icon';
import { classNames } from '../../utils/classNames';

// Same flat link set as before, just grouped for the sidebar's section
// captions — the pills/mobile-drawer variants below flatten it back out, so
// this grouping never changes a link's own accessible name or href.
const ADMIN_GROUPS = [
  {
    label: 'Overview',
    links: [{ to: ROUTES.ADMIN, label: 'Dashboard', icon: 'dashboard', end: true }],
  },
  {
    label: 'Catalog',
    links: [
      { to: ROUTES.ADMIN_PRODUCTS, label: 'Products', icon: 'package' },
      { to: ROUTES.ADMIN_CATEGORIES, label: 'Categories', icon: 'tag' },
    ],
  },
  {
    label: 'Operations',
    links: [
      { to: ROUTES.ADMIN_ORDERS, label: 'Orders', icon: 'receipt' },
      { to: ROUTES.ADMIN_USERS, label: 'Users', icon: 'users' },
    ],
  },
];

const ADMIN_LINKS = ADMIN_GROUPS.flatMap((group) => group.links);

function sidebarLinkClass({ isActive }) {
  return classNames(
    'group relative flex items-center gap-3 rounded-control py-2.5 pl-4 pr-3 text-sm font-medium transition-colors duration-150',
    isActive ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  );
}

function pillLinkClass({ isActive }) {
  return classNames(
    'inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors duration-150',
    isActive
      ? 'border-brand-200 bg-brand-50 text-brand-800'
      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
  );
}

/** One nav item, with the small brand-tinted "active" indicator bar on its leading edge. */
function NavItem({ link, className, onClick }) {
  return (
    <NavLink to={link.to} end={link.end} className={className} onClick={onClick}>
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={classNames(
              'absolute inset-y-1 left-0 w-1 rounded-full bg-brand-600 transition-opacity duration-150',
              isActive ? 'opacity-100' : 'opacity-0'
            )}
          />
          <Icon
            name={link.icon}
            size="md"
            className={isActive ? 'text-brand-700' : 'text-slate-400 group-hover:text-slate-500'}
          />
          {link.label}
        </>
      )}
    </NavLink>
  );
}

/**
 * Admin area navigation (Dashboard / Products / Categories / Orders /
 * Users). Three presentations of the same link set:
 *
 *  - `variant="sidebar"` — the persistent desktop rail, grouped under small
 *                          uppercase section captions (Overview/Catalog/
 *                          Operations).
 *  - `variant="pills"`   — a horizontally scrolling strip for the tablet
 *                          width band, where a rail would eat the content.
 *  - `variant="drawer"`  — same grouped layout as `sidebar`, sized for the
 *                          phone-width off-canvas panel (see Navbar.jsx).
 *
 * Exactly one of these is ever displayed at a given breakpoint (the others
 * are `display:none`/unmounted via their callers), so assistive tech only
 * ever sees one "Admin navigation" landmark.
 */
export function AdminNav({ variant = 'sidebar', onNavigate }) {
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

  const isDrawer = variant === 'drawer';

  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-5">
      {ADMIN_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {group.label}
          </p>
          {group.links.map((link) => (
            <NavItem key={link.to} link={link} className={sidebarLinkClass} onClick={onNavigate} />
          ))}
        </div>
      ))}
      {isDrawer && (
        <div className="border-t border-slate-100 pt-3">
          <Link
            to={ROUTES.HOME}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-control py-2.5 pl-4 pr-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <Icon name="store" size="md" />
            View storefront
          </Link>
        </div>
      )}
    </nav>
  );
}
