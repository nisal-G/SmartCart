const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { baseCookieOptions } = require('../config/cookies');

const JWT_SECRET = process.env.JWT_SECRET;
const STATE_TTL_MS = 10 * 60 * 1000; // a login should never take longer

/**
 * A `state` store for passport-oauth2 that keeps the nonce in a signed,
 * httpOnly cookie instead of a server-side session (this API is stateless —
 * there is no express-session to hang passport's default NonceStore off).
 *
 * Without a store passport-oauth2 falls back to its NullStore, which means
 * no `state` parameter is sent at all and the callback accepts ANY request
 * carrying a `code` — no CSRF protection, and no way for the server to tell
 * a genuine callback from a replayed one. Both matter here: the state check
 * is what makes a forged/replayed callback fail *before* the authorization
 * code is ever presented to the provider.
 *
 * The cookie is cleared on first verification, so a given state is usable
 * exactly once. `SameSite` comes from config/cookies.js; either value it
 * produces ('lax' or 'none') is sent on the top-level GET navigation the
 * provider redirects the browser through, which is the only request that
 * needs it.
 */
class CookieStateStore {
  constructor(provider) {
    this.provider = provider;
    this.cookieName = `oauth_state_${provider}`;
    // Scoped to the auth routes only: the browser never attaches it to
    // unrelated API calls.
    this.cookieOptions = { ...baseCookieOptions, path: '/api/auth' };
  }

  /** passport-oauth2 calls this (arity 3) on the way out to the provider. */
  store(req, meta, callback) {
    let state;
    try {
      state = crypto.randomBytes(24).toString('base64url');
      const token = jwt.sign({ st: state, pv: this.provider }, JWT_SECRET, {
        expiresIn: Math.floor(STATE_TTL_MS / 1000),
      });
      req.res.cookie(this.cookieName, token, {
        ...this.cookieOptions,
        maxAge: STATE_TTL_MS,
      });
    } catch (err) {
      return callback(err);
    }
    return callback(null, state);
  }

  /**
   * Non-destructive state check: does this request actually hold the state
   * cookie that was issued when *this* login started, and does it match the
   * `state` the provider echoed back?
   *
   * Separated from `verify` so the answer can be had BEFORE anything else
   * in the callback chain touches the authorization code. Anything holding
   * the callback URL but not the cookie — Facebook's own
   * `facebookexternalhit` link scanner, a prefetch, a forged link — has to
   * be turned away before it can affect the real browser's login. Reading
   * it does not consume it; only `verify` does that.
   *
   * Returns `{ ok, reason, hasCookie }`; `reason` is for logs, never shown.
   */
  check(req, state) {
    const token = req.cookies && req.cookies[this.cookieName];
    if (!token) return { ok: false, reason: 'state_cookie_missing', hasCookie: false };

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      // Expired (older than STATE_TTL_MS) or tampered with.
      return { ok: false, reason: 'state_cookie_invalid', hasCookie: true };
    }

    if (payload.pv !== this.provider) {
      return { ok: false, reason: 'state_provider_mismatch', hasCookie: true };
    }
    if (!state) return { ok: false, reason: 'state_param_missing', hasCookie: true };
    if (!safeEqual(payload.st, state)) {
      return { ok: false, reason: 'state_mismatch', hasCookie: true };
    }

    return { ok: true, reason: 'state_ok', hasCookie: true };
  }

  /** passport-oauth2 calls this (arity 4) when the provider redirects back. */
  verify(req, state, meta, callback) {
    const result = this.check(req, state);

    // Single use: burn the cookie whether or not it checks out, so a
    // captured callback URL can never be replayed against a live state.
    req.res.clearCookie(this.cookieName, this.cookieOptions);

    if (result.ok) return callback(null, true);

    return callback(null, false, {
      reason: result.reason,
      message: result.hasCookie
        ? 'Sign-in could not be verified. Please start again.'
        : 'Sign-in session expired or cookies are blocked. Please try again.',
    });
  }
}

// One instance per provider, shared by the passport strategy (which does the
// authoritative, cookie-consuming `verify`) and by the route-level state gate
// (which only `check`s). Both must agree on the cookie name and options.
const stores = new Map();

function stateStoreFor(provider) {
  if (!stores.has(provider)) stores.set(provider, new CookieStateStore(provider));
  return stores.get(provider);
}

/** Constant-time compare of two ASCII strings of possibly different length. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { CookieStateStore, stateStoreFor, STATE_TTL_MS };
