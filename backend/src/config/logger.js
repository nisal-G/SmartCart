const pino = require('pino');

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * App-wide structured logger (SRS §4 Reliability — replaces ad-hoc
 * console.log/console.error calls in request-handling code).
 *
 * - production: JSON logs at 'info' and above, ready for a log
 *   aggregator (nothing here writes to a file — stdout only).
 * - development: pretty, colorized, human-readable via pino-pretty.
 * - test: silent by default so `npm test` output stays readable; set
 *   LOG_LEVEL explicitly (e.g. `LOG_LEVEL=debug npm test`) to see logs
 *   while debugging a failing test.
 *
 * `redact` guarantees credentials/tokens are never written to a log line,
 * even if a whole request/response or user document is ever logged.
 */
const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : isTest ? 'silent' : 'debug'),
  transport:
    !isProd && !isTest
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        }
      : undefined,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      'password',
      '*.password',
      'accessToken',
      '*.accessToken',
      'refreshToken',
      '*.refreshToken',
      'refreshTokens',
      '*.refreshTokens',
      'token',
      '*.token',
      'ticket',
      '*.ticket',
      'merchantSecret',
      '*.merchantSecret',
      'PAYHERE_MERCHANT_SECRET',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
