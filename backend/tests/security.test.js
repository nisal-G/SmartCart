const request = require('supertest');
const app = require('../src/app');
const errorHandler = require('../src/middleware/errorHandler');
const { connect, clearDatabase, closeDatabase } = require('./utils/db');
// FRONTEND_URL is normalised to bare origins (a browser Origin header never
// carries a path), so assert against what the allow-list actually holds.
const { allowedOrigins } = require('../src/config/cors');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Security headers (helmet)', () => {
  test('sets baseline security headers and removes X-Powered-By', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });

  test('marks API responses as cross-origin-embeddable by the configured frontend', async () => {
    // Deliberately overridden away from helmet's 'same-origin' default —
    // this API is meant to be consumed from a separate frontend origin
    // (see app.js). Access is still gated by the CORS allow-list, not by
    // this header.
    const res = await request(app).get('/api/categories');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});

describe('CORS configuration', () => {
  test('allows a request from the configured frontend origin', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Origin', allowedOrigins[0]);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigins[0]);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  test('rejects a request from an origin that is not on the allow-list', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Origin', 'https://not-smartcart.example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    // No `.status` is attached to the cors package's rejection error, so it
    // falls through the global error handler as an unexpected 500 — the
    // important assertion is that CORS never grants this origin access.
    expect(res.status).toBe(500);
  });

  test('requests with no Origin header (server-to-server calls, curl, tests) are not blocked by CORS', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
  });

  test('the CORS config module refuses to load in production without a configured frontend origin', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalFrontendUrl = process.env.FRONTEND_URL;
    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_URL;

    try {
      expect(() => {
        jest.isolateModules(() => {
          require('../src/config/cors');
        });
      }).toThrow(/FRONTEND_URL/);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  test('the CORS config module does NOT fall back to allowing any origin in production', () => {
    // Regression guard for the exact issue the audit flagged
    // (`origin: process.env.FRONTEND_URL || true`): even with FRONTEND_URL
    // set, an origin that isn't in the allow-list must never be reflected.
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    let corsOptions;
    try {
      jest.isolateModules(() => {
        ({ corsOptions } = require('../src/config/cors'));
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }

    const callback = jest.fn();
    corsOptions.origin('https://not-smartcart.example.com', callback);
    expect(callback).toHaveBeenCalledWith(expect.any(Error));
    expect(callback.mock.calls[0][1]).toBeUndefined();
  });
});

describe('Environment-aware error handling (src/middleware/errorHandler.js)', () => {
  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('an unexpected (no .status) error returns a generic message in production', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('MongoServerError: connect ECONNREFUSED 127.0.0.1:27017');
    const req = {};
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });

  test('an unexpected (no .status) error still returns its real message outside production', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('MongoServerError: connect ECONNREFUSED 127.0.0.1:27017');
    const req = {};
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: err.message });
  });

  test('a controlled error (explicit .status) keeps its client-facing message in production', () => {
    process.env.NODE_ENV = 'production';
    const err = Object.assign(new Error('Category not found'), { status: 404 });
    const req = {};
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Category not found' });
  });

  test('a controlled 5xx error (e.g. an external-service failure) keeps its safe message in production', () => {
    process.env.NODE_ENV = 'production';
    const err = Object.assign(new Error('Failed to upload image'), { status: 502 });
    const req = {};
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ message: 'Failed to upload image' });
  });

  test('falls back to a generic message when even the error itself has no message', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error();
    err.message = '';
    const req = {};
    const res = mockRes();

    errorHandler(err, req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });

  test('uses req.log when pino-http has attached one, and never throws without it', () => {
    const err = new Error('boom');
    const reqWithLogger = { log: { error: jest.fn() } };
    const res = mockRes();

    expect(() => errorHandler(err, reqWithLogger, res, jest.fn())).not.toThrow();
    expect(reqWithLogger.log.error).toHaveBeenCalled();

    const reqWithoutLogger = {};
    expect(() => errorHandler(err, reqWithoutLogger, mockRes(), jest.fn())).not.toThrow();
  });
});
