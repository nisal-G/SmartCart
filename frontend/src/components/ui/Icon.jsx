import { classNames } from '../../utils/classNames';

/**
 * The app's single icon set. No icon library is installed (and adding one
 * for a handful of glyphs isn't worth the bundle), so these are hand-drawn
 * on one consistent grid: 24×24 viewBox, 1.75 stroke, round caps/joins,
 * `currentColor` — which is what keeps them from looking like a mix of
 * three different icon packs.
 *
 * Icons are decorative by default (`aria-hidden`): the accessible name
 * always comes from the control's own text or aria-label, never from here.
 */
const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>,
  cart: (
    <>
      <path d="M3 4h2.2l1.9 10.4a1.6 1.6 0 0 0 1.6 1.3h7.9a1.6 1.6 0 0 0 1.6-1.2L20 8H6.3" />
      <circle cx="9.5" cy="19.5" r="1.4" />
      <circle cx="17" cy="19.5" r="1.4" />
    </>
  ),
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  arrowLeft: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></>,
  alert: <><path d="M12 8v5" /><path d="M12 16.5h.01" /><circle cx="12" cy="12" r="9" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5h.01" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M6.5 7 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5L17.5 7" /></>,
  pencil: <><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14.5 6.5 3 3" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  filter: <><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></>,
  package: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5" /><path d="M12 12v9" /></>,
  tag: <><path d="M4 11.2V5a1 1 0 0 1 1-1h6.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-5.8 5.8a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4Z" /><path d="M8 8h.01" /></>,
  receipt: <><path d="M6 3h12v18l-3-1.8-3 1.8-3-1.8L6 21V3Z" /><path d="M9.5 8h5" /><path d="M9.5 12h5" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0" /><path d="M16 5.6a3.2 3.2 0 0 1 0 6.2" /><path d="M17.5 14.2A5.6 5.6 0 0 1 21 19" /></>,
  dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" /></>,
  store: <><path d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5" /><path d="M3 9.5 5 4h14l2 5.5a3 3 0 0 1-5.6 1.6 3 3 0 0 1-5.4 0A3 3 0 0 1 3 9.5Z" /><path d="M10 20v-5h4v5" /></>,
  shield: <><path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6l7-2.5Z" /><path d="m9.5 12 1.8 1.8L15 10" /></>,
  logout: <><path d="M14 4h3.5A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M10 8 6 12l4 4" /><path d="M6 12h9" /></>,
  key: <><circle cx="8" cy="14" r="4" /><path d="m11 11 8-8" /><path d="m16.5 5.5 2 2" /><path d="m14 8 2 2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3.2 2" /></>,
  truck: <><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H14v10H3V7.5Z" /><path d="M14 10h3.6a1.5 1.5 0 0 1 1.3.75L21 14v2h-7v-6Z" /><circle cx="7.5" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  leaf: <><path d="M5 19c0-7 4.5-12 15-12 0 8-4.5 12-11 12H5Z" /><path d="M8.5 15.5c1.8-3 4-5 7.5-6.5" /></>,
  sparkles: <><path d="m12 4 1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Z" /><path d="M18.5 15.5 19 17l1.5.5L19 18l-.5 1.5L18 18l-1.5-.5L18 17l.5-1.5Z" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.5-5.8" /><path d="M20 4v4h-4" /></>,
  creditCard: <><rect x="3" y="5.5" width="18" height="13" rx="2.2" /><path d="M3 10h18" /><path d="M7 14.5h3" /></>,
  headset: <><path d="M5 13v-1a7 7 0 0 1 14 0v1" /><path d="M5 13h1.8a1.2 1.2 0 0 1 1.2 1.2v2.6A1.2 1.2 0 0 1 6.8 18H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" /><path d="M19 13h-1.8a1.2 1.2 0 0 0-1.2 1.2v2.6A1.2 1.2 0 0 0 17.2 18H19a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1Z" /></>,
  google: 'brand-google',
  facebook: 'brand-facebook',
};

const SIZE_CLASSES = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
};

/** Multi-colour brand marks — drawn as fills, so they sit outside the stroked set above. */
function GoogleMark({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M21.6 12.23c0-.7-.06-1.37-.18-2.02H12v3.82h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.32Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.9a6 6 0 0 1 0-3.82V7.49H3.06a10 10 0 0 0 0 9.02l3.35-2.6Z" />
      <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.06 7.49l3.35 2.6C7.2 7.73 9.4 5.97 12 5.97Z" />
    </svg>
  );
}

function FacebookMark({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill="#1877F2"
        d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.5-3.9 3.77-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z"
      />
    </svg>
  );
}

/** `name` must be a key of PATHS. Renders nothing for an unknown name rather than throwing. */
export function Icon({ name, size = 'md', className, strokeWidth = 1.75 }) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const combined = classNames('shrink-0', sizeClass, className);

  if (name === 'google') return <GoogleMark className={combined} />;
  if (name === 'facebook') return <FacebookMark className={combined} />;

  const path = PATHS[name];
  if (!path || typeof path === 'string') return null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={combined}
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}
