const express = require('express');
const { passport, isGoogleConfigured, isFacebookConfigured } = require('../config/passport');
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const optionalAuthenticate = require('../middleware/optionalAuthenticate');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const {
  adminLoginValidators,
  passkeyRegisterOptionsValidators,
  passkeyLoginOptionsValidators,
} = require('../validators/authValidators');

const router = express.Router();

// --- Google OAuth --------------------------------------------------------
router.get('/google', (req, res, next) => {
  if (!isGoogleConfigured) {
    return res.status(503).json({
      message:
        'Google login is not configured on this server yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
    });
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(
    req,
    res,
    next
  );
});

router.get('/google/callback', (req, res, next) => {
  if (!isGoogleConfigured) {
    return res.status(503).json({ message: 'Google login is not configured on this server yet.' });
  }
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/auth/google/failure',
  })(req, res, next);
}, authController.oauthCallback);

router.get('/google/failure', authController.oauthFailure);

// --- Facebook OAuth ------------------------------------------------------
router.get('/facebook', (req, res, next) => {
  if (!isFacebookConfigured) {
    return res.status(503).json({
      message:
        'Facebook login is not configured on this server yet. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.',
    });
  }
  passport.authenticate('facebook', { scope: ['email'], session: false })(req, res, next);
});

router.get('/facebook/callback', (req, res, next) => {
  if (!isFacebookConfigured) {
    return res.status(503).json({ message: 'Facebook login is not configured on this server yet.' });
  }
  passport.authenticate('facebook', {
    session: false,
    failureRedirect: '/api/auth/facebook/failure',
  })(req, res, next);
}, authController.oauthCallback);

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
