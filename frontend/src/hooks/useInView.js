import { useEffect, useRef, useState } from 'react';

/**
 * Reports whether the returned ref's node has scrolled into the viewport,
 * via IntersectionObserver rather than a scroll listener (no per-frame
 * work, no layout thrashing). Backs the scroll-reveal system (`Reveal`) —
 * shared by every "animate in on scroll" spot in the app rather than each
 * one wiring up its own observer.
 *
 * `once: true` (the default) disconnects after the first reveal: content
 * that has already appeared shouldn't animate again on a re-scroll.
 */
export function useInView({ once = true, rootMargin = '0px 0px -10% 0px', threshold = 0.15 } = {}) {
  const ref = useRef(null);
  // No IntersectionObserver support — start already "in view" rather than
  // leaving the content permanently at opacity-0. Computed once, up front,
  // rather than via a same-render setState in the effect below.
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold]);

  return [ref, inView];
}
