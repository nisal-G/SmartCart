const express = require('express');
const request = require('supertest');
const rateLimit = require('express-rate-limit');

/**
 * Rate-limit behavior is tested against small, standalone Express apps
 * (never the shared `../src/app` instance) for two reasons:
 *
 *  1. `--runInBand` runs every test file in one Node process, so a shared
 *     in-memory limiter's counters would accumulate across every other
 *     test suite in this run — flaky, order-dependent 429s that have
 *     nothing to do with what a given test is checking.
 *  2. Because of (1), `middleware/rateLimiter.js` deliberately skips real
 *     limiting when NODE_ENV=test (see that file). These tests prove that
 *     skip works, and separately prove the underlying express-rate-limit
 *     wiring itself does enforce a threshold when NODE_ENV isn't 'test'.
 */

describe('express-rate-limit mechanism', () => {
  test('allows requests under the threshold and blocks with 429 once it is exceeded', async () => {
    const app = express();
    app.use(
      rateLimit({
        windowMs: 60 * 1000,
        max: 3,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: 'Too many requests. Please try again later.' },
      })
    );
    app.get('/ping', (req, res) => res.status(200).json({ ok: true }));

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).get('/ping');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many requests/i);
    expect(blocked.headers['ratelimit-limit']).toBeDefined();
  });
});

describe('middleware/rateLimiter.js under NODE_ENV=test', () => {
  test('authLimiter does not block even well beyond its configured max (20) while NODE_ENV=test', async () => {
    const { authLimiter } = require('../src/middleware/rateLimiter');
    const app = express();
    app.use(authLimiter);
    app.post('/login-like', (req, res) => res.status(200).json({ ok: true }));

    for (let i = 0; i < 25; i += 1) {
      const res = await request(app).post('/login-like'); // eslint-disable-line no-await-in-loop
      expect(res.status).toBe(200);
    }
  });

  test('generalLimiter does not block a burst of requests while NODE_ENV=test', async () => {
    const { generalLimiter } = require('../src/middleware/rateLimiter');
    const app = express();
    app.use(generalLimiter);
    app.get('/browse-like', (req, res) => res.status(200).json({ ok: true }));

    for (let i = 0; i < 30; i += 1) {
      const res = await request(app).get('/browse-like'); // eslint-disable-line no-await-in-loop
      expect(res.status).toBe(200);
    }
  });
});

describe('middleware/rateLimiter.js outside the test environment', () => {
  test('authLimiter enforces its real 20-request threshold when NODE_ENV is not "test"', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      let authLimiter;
      jest.isolateModules(() => {
        ({ authLimiter } = require('../src/middleware/rateLimiter'));
      });

      const app = express();
      app.use(authLimiter);
      app.post('/login-like', (req, res) => res.status(200).json({ ok: true }));

      for (let i = 0; i < 20; i += 1) {
        const res = await request(app).post('/login-like'); // eslint-disable-line no-await-in-loop
        expect(res.status).toBe(200);
      }

      const blocked = await request(app).post('/login-like');
      expect(blocked.status).toBe(429);
      expect(blocked.body.message).toMatch(/too many attempts/i);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }, 30000);
});
