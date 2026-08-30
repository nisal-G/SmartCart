const logger = require('./logger');

const isProd = process.env.NODE_ENV === 'production';

/**
 * FRONTEND_URL may be a single URL or a comma-separated list (e.g. a local
 * dev frontend plus the deployed one sharing this API). Each entry is
 * normalised to a bare *origin* (`scheme://host[:port]`) because that is the
 * only shape a browser ever puts in an `Origin` header — a value carrying a
 * path (`https://app.example.com/products`) would silently match nothing in
 * the CORS allow-list and reject every request from the real frontend.
 *
 * The first entry is the "primary" origin: the one users are sent back to
 * after an OAuth login.
 */
function toOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const rawEntries = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const configuredOrigins = [];
rawEntries.forEach((entry) => {
  const origin = toOrigin(entry);
  if (!origin) {
    logger.warn({ entry }, '[frontend] Ignoring FRONTEND_URL entry that is not a valid absolute URL');
    return;
  }
  if (origin !== entry.replace(/\/+$/, '')) {
    logger.warn(
      { entry, origin },
      '[frontend] FRONTEND_URL entry carries a path/trailing slash — using its origin only'
    );
  }
  if (!configuredOrigins.includes(origin)) configuredOrigins.push(origin);
});

if (isProd && configuredOrigins.length === 0) {
  // Fail loudly at boot rather than silently starting an API that either
  // rejects every browser request or (with an "allow anything" fallback)
  // accepts requests from every origin. Same fail-fast pattern as
  // tokenService's JWT_SECRET check.
  throw new Error(
    'FRONTEND_URL is not set. Refusing to start in production without a configured frontend origin for CORS.'
  );
}

// Local dev/test convenience only — never used in production (the check
// above guarantees configuredOrigins is non-empty there).
const frontendOrigins =
  configuredOrigins.length > 0 ? configuredOrigins : ['http://localhost:5173'];

if (!isProd && configuredOrigins.length === 0) {
  logger.warn(
    { frontendOrigins },
    '[frontend] FRONTEND_URL not set — defaulting to localhost:5173 for local development only'
  );
}

const primaryFrontendOrigin = frontendOrigins[0];

/**
 * True when the browser will treat a call from the frontend to this API as
 * *cross-site* (a Vercel-hosted SPA calling an API on onrender.com), which
 * is what decides whether the session cookies need `SameSite=None; Secure`.
 *
 * Derived from the primary origin rather than from NODE_ENV, because a
 * deployment that forgets to set NODE_ENV=production would otherwise issue
 * `SameSite=Lax` cookies that the browser silently refuses to send on any
 * cross-site XHR — the session would appear to vanish right after login.
 * A localhost frontend stays same-site (and plain http), where `None`
 * (which browsers only honour together with `Secure`) would be dropped.
 */
const isLoopback = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(origin);
const isCrossSiteFrontend = /^https:\/\//.test(primaryFrontendOrigin) && !isLoopback(primaryFrontendOrigin);

/**
 * Absolute URL on the primary frontend origin. `path` must start with '/'.
 * `query` entries with a null/undefined value are omitted.
 */
function frontendUrl(path, query) {
  const url = new URL(path, primaryFrontendOrigin);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  });
  return url.toString();
}

module.exports = {
  frontendOrigins,
  primaryFrontendOrigin,
  isCrossSiteFrontend,
  frontendUrl,
};
