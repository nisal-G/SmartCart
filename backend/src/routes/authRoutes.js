const express = require('express');
const { passport, isGoogleConfigured, isFacebookConfigured } = require('../config/passport');
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const optionalAuthenticate = require('../middleware/optionalAuthenticate');
const { authLimiter } = require('../middleware/rateLimiter');
const logger = require('../config/logger');
const validate = require('../middleware/validate');
const {
  adminLoginValidators,
  passkeyRegisterOptionsValidators,
  passkeyLoginOptionsValidators,
} = require('../validators/authValidators');

const router = express.Router();

// --- OAuth (Google / Facebook) -------------------------------------------
// Each provider gets the same three-step chain:
//   1. requireProvider  - 503 when the server has no credentials for it
//   2. oauthCodeGuard   - the authorization code is exchanged exactly once,
//                         no matter how often the callback URL is requested
//   3. oauthAuthenticate- passport, with a custom callback so that NO failure
//                         can escape as an API error page at this URL
// See controllers/authController.js for why (2) and (3) exist.

function requireProvider(provider, isConfigured) {
  const label = provider === 'google' ? 'Google' : 'Facebook';
  const envVars =
    provider === 'google'
      ? 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'
      : 'FACEBOOK_APP_ID and FACEBOOK_APP_SECRET';
  return (req, res, next) => {
    if (isConfigured) return next();
    return res.status(503).json({
      message: `${label} login is not configured on this server yet. Set ${envVars}.`,
    });
  };
}

/**
 * passport.authenticate with an explicit callback, so every outcome is
 * handled here rather than by passport's default behaviour.
 *
 * The default `failureRedirect`/`next(err)` handling was what surfaced the
 * provider's own words ("This authorization code has been used.") as a JSON
 * body on this API's URL: a token-exchange failure is passed to
 * `next(err)`, and the global error handler renders it. The error still
 * gets logged in full here — it is the *user* who is sent somewhere useful
 * instead of being left on a dead end.
 */
function oauthAuthenticate(provider) {
  return (req, res, next) => {
    passport.authenticate(provider, { session: false }, (err, user, info) => {
      if (err) {
        logger.error({ err, provider }, '[auth] OAuth callback failed');
        if (req.oauthCodeClaim) req.oauthCodeClaim.settle({ ok: false, reason: 'exchange_failed' });
        return authController.redirectOAuthFailure(res, 'oauth_failed');
      }
      if (!user) {
        // No error, no user: the person cancelled at the provider, or the
        // `state` check rejected the callback (see oauthStateStore).
        logger.warn({ provider, info }, '[auth] OAuth callback did not produce a user');
        if (req.oauthCodeClaim) req.oauthCodeClaim.settle({ ok: false, reason: 'oauth_cancelled' });
        return authController.redirectOAuthFailure(res, 'oauth_cancelled');
      }
      req.user = user;
      return next();
    })(req, res, next);
  };
}

const googleConfigured = requireProvider('google', isGoogleConfigured);
const facebookConfigured = requireProvider('facebook', isFacebookConfigured);

router.get('/google', googleConfigured, (req, res, next) => {
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get(
  '/google/callback',
  googleConfigured,
  authController.oauthCodeGuard('google'),
  oauthAuthenticate('google'),
  authController.oauthCallback
);

router.get('/facebook', facebookConfigured, (req, res, next) => {
  passport.authenticate('facebook', { scope: ['email'], session: false })(req, res, next);
});

router.get(
  '/facebook/callback',
  facebookConfigured,
  authController.oauthCodeGuard('facebook'),
  oauthAuthenticate('facebook'),
  authController.oauthCallback
);

// Retained so an old bookmark/link still resolves to a sensible response;
// nothing redirects here any more.
router.get('/google/failure', authController.oauthFailure);
router.get('/facebook/failure', authController.oauthFailure);

// --- Passkey / WebAuthn ----------------------------------------------
router.post(
  '/passkey/register/options',
  optionalAuthenticate,
  passkeyRegisterOptionsValidators,
  validate,
  authController.passkeyRegisterOptions
);
router.post(
  '/passkey/register/verify',
  authLimiter,
  authController.passkeyRegisterVerify
);
router.post(
  '/passkey/login/options',
  passkeyLoginOptionsValidators,
  validate,
  authController.passkeyLoginOptions
);
router.post('/passkey/login/verify', authLimiter, authController.passkeyLoginVerify);

// --- Admin ---------------------------------------------------------------
router.post(
  '/admin/login',
  authLimiter,
  adminLoginValidators,
  validate,
  authController.adminLogin
);

// --- Session lifecycle -----------------------------------------------
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

module.exports = router;
