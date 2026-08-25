const PAYHERE_SCRIPT_SRC = 'https://www.payhere.lk/lib/payhere.js';

// Module-level so concurrent/repeated calls (e.g. a user re-opening
// Checkout) never insert the script twice — every caller awaits the same
// in-flight (or already-resolved) load.
let loadPromise = null;

/**
 * Loads PayHere's official Checkout JS SDK (window.payhere) exactly once
 * and resolves with it. No npm package exists for this — PayHere's
 * integration is "include this script tag" (see
 * https://support.payhere.lk/api-&-mobile-sdk/payhere-checkout), so this is
 * the safe, dependency-free equivalent for a React app.
 */
export function loadPayhereScript() {
  if (typeof window !== 'undefined' && window.payhere) {
    return Promise.resolve(window.payhere);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PAYHERE_SCRIPT_SRC}"]`);

    const onLoad = () => resolve(window.payhere);
    const onError = () => {
      loadPromise = null;
      reject(new Error('Unable to load the PayHere checkout script. Check your connection and try again.'));
    };

    if (existing) {
      existing.addEventListener('load', onLoad, { once: true });
      existing.addEventListener('error', onError, { once: true });
      // The script may have already finished loading before this call.
      if (window.payhere) resolve(window.payhere);
      return;
    }

    const script = document.createElement('script');
    script.src = PAYHERE_SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    document.head.appendChild(script);
  });

  return loadPromise;
}
