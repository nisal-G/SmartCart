const { frontendOrigins } = require('./frontend');

// The allow-list is the set of normalised frontend origins parsed from
// FRONTEND_URL (see config/frontend.js, which also fails fast in production
// when none is configured). Never fall back to reflecting an arbitrary
// origin — that combined with `credentials: true` would let ANY site read
// authenticated responses via the user's cookies.
const allowedOrigins = frontendOrigins;

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
