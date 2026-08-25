import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onStoreChange) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/**
 * Live `prefers-reduced-motion` reading, for the few things CSS alone can't
 * calm down — currently the homepage hero clip, which has to be *paused*
 * rather than merely sped up. Everything that is a plain CSS animation or
 * transition is already handled by the reduced-motion block in index.css.
 *
 * `useSyncExternalStore` rather than state + an effect: the media query is
 * exactly an external store, and this way the first render already has the
 * right answer instead of correcting itself a frame later.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
