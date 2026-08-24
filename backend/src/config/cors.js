const logger = require('./logger');

const isProd = process.env.NODE_ENV === 'production';

// FRONTEND_URL may be a single origin or a comma-separated list (e.g. a
// staging + production frontend sharing one API). Never fall back to
// reflecting an arbitrary origin — that combined with `credentials: true`
// would let ANY site read authenticated responses via the user's cookies.
const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProd && configuredOrigins.length === 0) {
  // Fail loudly at boot rather than silently starting an API that either
  // rejects every browser request or (with the old `|| true` fallback)
  // accepts requests from every origin. Same fail-fast pattern as
  // tokenService's JWT_SECRET check.
  throw new Error(
    'FRONTEND_URL is not set. Refusing to start in production without a configured frontend origin for CORS.'
  );
}

// Local dev/test convenience only — never used in production (the check
// above guarantees configuredOrigins is non-empty there).
const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : ['http://localhost:5173'];

if (!isProd && configuredOrigins.length === 0) {
  logger.warn(
    { allowedOrigins },
    '[cors] FRONTEND_URL not set — defaulting to localhost:5173 for local development only'
  );
}

/**
 * express `cors` options. Requests with no Origin header (server-to-server
 * calls, curl, mobile apps, same-origin requests, and supertest requests in
 * tests) are allowed through — there's no origin to spoof/reflect for them.
 * Any browser request that DOES carry an Origin header must match the
 * configured allow-list exactly.
 */
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin "${origin}" is not allowed by CORS`));
  },
  credentials: true, // required so the browser sends/receives the auth cookies
};

module.exports = { corsOptions, allowedOrigins };
