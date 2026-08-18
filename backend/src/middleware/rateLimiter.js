const rateLimit = require('express-rate-limit');

/**
 * Applied to credential-checking auth endpoints (admin login, passkey
 * verification) to slow down brute-force/guessing attempts, per the SRS
 * security NFR. Deliberately NOT applied to /me, /refresh, or /logout,
 * which don't check a guessable secret.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});

module.exports = { authLimiter };
