const crypto = require('crypto');

/**
 * A short, non-reversible reference for a single-use OAuth secret.
 *
 * An authorization code and a `state` nonce are credentials: neither may
 * ever be written to a log. But diagnosing a callback problem means being
 * able to line up several log lines — a state check, a code claim, a token
 * exchange — and say "these are all about the same login attempt, and that
 * one over there is a different request carrying the same code". Hashing
 * the value gives exactly that correlation and nothing else.
 */
function traceRef(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

module.exports = traceRef;
