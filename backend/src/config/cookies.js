const { isCrossSiteFrontend } = require('./frontend');

/**
 * Cookie attributes shared by every cookie this API sets (the session
 * cookies in services/tokenService.js and the short-lived OAuth state
 * cookie in services/oauthStateStore.js).
 *
 * A frontend on a different site (Vercel SPA -> Render API) makes every
 * XHR a *cross-site* request, and browsers only attach a cookie to those
 * when it is `SameSite=None`, which they in turn only accept together with
 * `Secure`. With the `SameSite=Lax` default the login succeeds, the cookie
 * is stored, and then never gets sent again — the user lands back on the
 * frontend logged out. A same-site/localhost setup keeps `Lax` (strictly
 * better) and stays non-Secure so it still works over plain http.
 *
 * COOKIE_SAMESITE / COOKIE_SECURE override the derived values if a
 * deployment ever needs something different.
 */
const sameSite = process.env.COOKIE_SAMESITE || (isCrossSiteFrontend ? 'none' : 'lax');
const secure =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === 'true'
    : // `SameSite=None` is rejected outright by browsers without `Secure`.
      sameSite === 'none' || process.env.NODE_ENV === 'production';

const baseCookieOptions = {
  httpOnly: true,
  secure,
  sameSite,
  domain: process.env.COOKIE_DOMAIN || undefined,
};

module.exports = { baseCookieOptions };
