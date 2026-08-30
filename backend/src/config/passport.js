const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: FacebookStrategy } = require('passport-facebook');
const User = require('../models/User');
const logger = require('./logger');
const { stateStoreFor } = require('../services/oauthStateStore');
const traceRef = require('../utils/traceRef');

/**
 * Only ever store a profile picture URL we can safely drop into an <img src>
 * on the frontend. Rejects anything that isn't a well-formed http(s) URL
 * (e.g. a malformed value, or a `javascript:`/`data:` URL) — the provider
 * SDKs shouldn't ever hand us those, but the DB should never trust that
 * blindly. Returns undefined (leaves any existing value untouched) rather
 * than throwing, since a bad photo URL should never fail a login.
 */
function sanitizeAvatarUrl(url) {
  if (!url || typeof url !== 'string') return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
    return url;
  } catch {
    return undefined;
  }
}

/**
 * Finds an existing user for this OAuth identity, linking it to an existing
 * account by email if one already exists (e.g. a user who signed up with
 * Google later logs in with Facebook using the same address), otherwise
 * creates a brand-new user.
 *
 * NOTE: linking by email trusts the provider's `email_verified` claim.
 * Both Google and Facebook only return an email in the profile when it has
 * been verified by them, so this is a reasonable trust boundary.
 */
async function findOrCreateOAuthUser(provider, profile) {
  const providerId = profile.id;
  const email = profile.emails && profile.emails[0] && profile.emails[0].value;
  const name = profile.displayName || email || 'SmartCart User';
  const avatarUrl = sanitizeAvatarUrl(profile.photos && profile.photos[0] && profile.photos[0].value);

  let user = await User.findOne({ [`providers.${provider}.id`]: providerId });
  if (user) {
    // Keep the stored picture in step with the provider's current one (it
    // can change, or a first login before this feature existed may have
    // left avatarUrl unset) — cheap to check, and avoids ever going stale.
    if (avatarUrl && user.avatarUrl !== avatarUrl) {
      user.avatarUrl = avatarUrl;
      await user.save();
    }
    return user;
  }

  if (email) {
    user = await User.findOne({ email: email.toLowerCase() });
  }

  if (user) {
    user.providers[provider] = { id: providerId, email };
    if (!user.avatarUrl && avatarUrl) user.avatarUrl = avatarUrl;
    await user.save();
    return user;
  }

  if (!email) {
    throw new Error(
      `${provider} did not return a verified email address; cannot create account.`
    );
  }

  user = await User.create({
    name,
    email,
    avatarUrl,
    role: 'user', // OAuth sign-in NEVER grants admin, regardless of provider data
    status: 'active',
    providers: { [provider]: { id: providerId, email } },
  });
  return user;
}

/**
 * Wraps a strategy's token-exchange call so the one network round-trip
 * that actually spends the authorization code is visible in the logs:
 * when it starts, how long it took, whether it succeeded, and — when it
 * did not — what the provider said.
 *
 * This is the line that answers "did that request reach the token
 * exchange?". A request turned away by the state gate never produces one.
 * The code itself is only ever referenced by hash (see utils/traceRef),
 * and the client secret lives in the OAuth2 client, never in these fields.
 */
function instrumentTokenExchange(strategy, provider) {
  const oauth2 = strategy._oauth2;
  const exchange = oauth2.getOAuthAccessToken.bind(oauth2);

  oauth2.getOAuthAccessToken = function getOAuthAccessToken(code, params, callback) {
    const codeRef = traceRef(code);
    const startedAt = Date.now();
    logger.info(
      { provider, phase: 'token_exchange_start', codeRef },
      '[auth] Exchanging the authorization code with the provider'
    );

    return exchange(code, params, (err, accessToken, refreshToken, results) => {
      const durationMs = Date.now() - startedAt;
      if (err) {
        logger.error(
          {
            provider,
            phase: 'token_exchange_result',
            codeRef,
            durationMs,
            ok: false,
            providerStatus: err.statusCode,
            providerError: providerErrorMessage(err),
          },
          '[auth] Token exchange rejected by the provider'
        );
      } else {
        logger.info(
          { provider, phase: 'token_exchange_result', codeRef, durationMs, ok: true },
          '[auth] Token exchange succeeded'
        );
      }
      return callback(err, accessToken, refreshToken, results);
    });
  };
}

/** The provider's own words from a failed exchange — no tokens, no secret. */
function providerErrorMessage(err) {
  if (err && err.data) {
    try {
      const body = JSON.parse(err.data);
      if (body && body.error && body.error.message) return body.error.message;
    } catch {
      // Not JSON — fall through to the generic message.
    }
  }
  return (err && err.message) || null;
}
const isGoogleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);
const isFacebookConfigured = Boolean(
  process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET
);

if (isGoogleConfigured) {
  const googleStrategy = new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        '/api/auth/google/callback',
      // Sends (and then verifies) an OAuth `state` nonce — see
      // services/oauthStateStore.js. Without a store, passport-oauth2
      // falls back to its NullStore and omits `state` altogether, which
      // leaves the callback with no CSRF protection and no way to tell a
      // genuine callback from a forged or replayed one.
      store: stateStoreFor('google'),
      // Honour X-Forwarded-Proto when resolving a relative callbackURL,
      // so a TLS-terminating platform proxy can't yield an http:// one.
      proxy: true,
    },
    (accessToken, refreshToken, profile, done) => {
      findOrCreateOAuthUser('google', profile)
        .then((user) => done(null, user))
        .catch((err) => done(err));
    }
  );
  instrumentTokenExchange(googleStrategy, 'google');
  passport.use(googleStrategy);
} else {
  logger.warn(
    '[auth] Google OAuth not configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET) — /api/auth/google will return 503.'
  );
}

if (isFacebookConfigured) {
  const facebookStrategy = new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL:
        process.env.FACEBOOK_CALLBACK_URL ||
        '/api/auth/facebook/callback',
      profileFields: ['id', 'displayName', 'emails', 'photos'],
      graphAPIVersion: 'v21.0',
      store: stateStoreFor('facebook'),
      proxy: true,
    },
    (accessToken, refreshToken, profile, done) => {
      findOrCreateOAuthUser('facebook', profile)
        .then((user) => done(null, user))
        .catch((err) => done(err));
    }
  );
  instrumentTokenExchange(facebookStrategy, 'facebook');
  passport.use(facebookStrategy);
} else {
  logger.warn(
    '[auth] Facebook OAuth not configured (missing FACEBOOK_APP_ID/FACEBOOK_APP_SECRET) — /api/auth/facebook will return 503.'
  );
}

module.exports = { passport, isGoogleConfigured, isFacebookConfigured };
