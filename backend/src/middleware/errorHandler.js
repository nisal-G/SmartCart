const logger = require('../config/logger');

/**
 * Global error handler (SRS §4 Security/Reliability NFRs).
 *
 * `isProd` is read fresh on every request rather than captured once at
 * process boot — cheap, and it's what lets this exact same handler (and
 * app instance) be exercised in both "production" and "development/test"
 * modes from the test suite by toggling `process.env.NODE_ENV` around a
 * single request, instead of needing a separate process per environment.
 *
 * An error with an explicit `.status` was thrown deliberately by our own
 * code with a client-safe message in mind — validation failures, 404s,
 * 409 conflicts, or a wrapped external-service failure like
 * imageStorageService's `storageError` (502) / `notConfiguredError` (503).
 * Those are always safe to return as-is, in any environment.
 *
 * An error with NO `.status` is something unanticipated — a driver/ORM
 * exception, a bug, an unhandled edge case — defaulting to 500. Its raw
 * `.message` can contain internals (stack fragments, schema field paths,
 * driver detail) that must never reach a client in production, so those
 * get replaced with a generic message there. In development/test the real
 * message still comes through, since that's exactly what's needed to
 * debug the failure.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const isUnexpected = !err.status;

  const message =
    isUnexpected && isProd ? 'Internal Server Error' : err.message || 'Internal Server Error';

  const log = req.log || logger;
  log.error({ err, status }, err.message || 'Unhandled error');

  res.status(status).json({ message });
}

module.exports = errorHandler;
