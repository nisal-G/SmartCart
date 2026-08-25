/**
 * Attaches console/pageerror listeners to `page` and returns a function
 * that returns the unexpected ones collected so far.
 *
 * "Expected" noise is filtered out so a real regression isn't drowned out:
 * - Chromium logs every non-2xx network response as a generic
 *   "Failed to load resource: the server responded with a status of ###"
 *   console.error with no URL in the message text. A 401/403 is expected
 *   all over this app — AuthContext calls GET /auth/me unconditionally on
 *   every mount (logged-out is a normal outcome, not an error), and the
 *   authorization tests deliberately probe protected/admin-only endpoints
 *   while logged out or as a customer.
 * A genuine frontend bug shows up as a real console.error with an actual
 * message, or an uncaught `pageerror` — neither is filtered.
 */
export function watchConsole(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Failed to load resource.*status of 40[13]/.test(text)) return;
    errors.push(`console.error: ${text}`);
  });
  return () => errors;
}
