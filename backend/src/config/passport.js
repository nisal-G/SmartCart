const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: FacebookStrategy } = require('passport-facebook');
const User = require('../models/User');
const logger = require('./logger');

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
  const avatarUrl = profile.photos && profile.photos[0] && profile.photos[0].value;

  let user = await User.findOne({ [`providers.${provider}.id`]: providerId });
  if (user) return user;

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

const isGoogleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);
const isFacebookConfigured = Boolean(
  process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET
);

if (isGoogleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          '/api/auth/google/callback',
      },
      (accessToken, refreshToken, profile, done) => {
        findOrCreateOAuthUser('google', profile)
          .then((user) => done(null, user))
          .catch((err) => done(err));
      }
    )
  );
} else {
  logger.warn(
    '[auth] Google OAuth not configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET) — /api/auth/google will return 503.'
  );
}

if (isFacebookConfigured) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL:
          process.env.FACEBOOK_CALLBACK_URL ||
          '/api/auth/facebook/callback',
        profileFields: ['id', 'displayName', 'emails', 'photos'],
        graphAPIVersion: 'v21.0',
      },
      (accessToken, refreshToken, profile, done) => {
        findOrCreateOAuthUser('facebook', profile)
          .then((user) => done(null, user))
          .catch((err) => done(err));
      }
    )
  );
} else {
  logger.warn(
    '[auth] Facebook OAuth not configured (missing FACEBOOK_APP_ID/FACEBOOK_APP_SECRET) — /api/auth/facebook will return 503.'
  );
}

module.exports = { passport, isGoogleConfigured, isFacebookConfigured };
