const rateLimit = require('express-rate-limit');

// `--runInBand` runs every test FILE in the same Node process, so an
// in-memory rate limiter's counters would otherwise accumulate across
// unrelated test suites (e.g. Category/Product/Cart tests would eat into
// Auth's login-attempt budget) and produce flaky, order-dependent 429s that
// have nothing to do with what each test is actually checking. Both
// limiters below are skipped under NODE_ENV=test for that reason; the
// limiting mechanism itself (express-rate-limit wired up correctly, 429 on
// the configured threshold, Retry-After header present) is verified
// directly in tests/rateLimiter.test.js against a small standalone
// instance, independent of the shared app.
const isTestEnv = process.env.NODE_ENV === 'test';

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
  skip: () => isTestEnv,
  message: { message: 'Too many attempts. Please try again later.' },
});

/**
 * General-purpose limiter for the rest of the API (products, categories,
 * cart, orders). Much looser than authLimiter — this isn't guarding a
 * guessable secret, it's just a ceiling against scripted scraping/abuse of
 * otherwise-public or per-user endpoints. Generous enough that a real
 * shopper (or a browsing session hammering pagination/search) never comes
 * close to it.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { message: 'Too many requests. Please try again later.' },
});

module.exports = { authLimiter, generalLimiter };
