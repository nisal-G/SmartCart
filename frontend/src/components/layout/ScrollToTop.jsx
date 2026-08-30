import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scrolls to the top of the page on a real navigation (a clicked link, a
 * programmatic `navigate()`) so nobody lands halfway down the previous
 * page's scroll position. Deliberately does nothing on `POP` (browser
 * back/forward) — that's the one case where landing back where you were
 * scrolled to is the expected, natural behaviour, and browsers already
 * handle it.
 *
 * Keyed on `pathname` alone: changing only the query string (Products'
 * category/search/page filters) doesn't count as "a new page" here, so
 * adjusting a filter never yanks the user back to the top of a list they're
 * scrolled through.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== 'POP') {
      // `behavior: 'instant'` — not the two-arg `scrollTo(0, 0)` form —
      // because index.css sets `html { scroll-behavior: smooth }` globally
      // (for in-page anchors like the hero's "Browse categories"). Without
      // an explicit `instant`, a route change would inherit that and
      // visibly glide to the top over the next several hundred ms instead
      // of landing there before the page transition's own fade plays.
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [pathname, navigationType]);

  return null;
}
