const express = require('express');
const request = require('supertest');
const app = require('../src/app');
const authController = require('../src/controllers/authController');
const { connect, clearDatabase, closeDatabase } = require('./utils/db');
const { createUser } = require('./utils/auth');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

// NOTE: these tests never make a real network call to Google/Facebook.
// `/google` and `/facebook` only need passport to build a local
// redirect URL (no external request happens until the browser follows it),
// and the `/callback` routes' actual post-auth logic is tested directly
// against `authController.oauthCallback` below with a stubbed `req.user` —
// exactly what passport's verify callback would have produced after a real
// exchange, without performing one.

describe('Google OAuth routes (credentials configured in this environment)', () => {
  test('GET /api/auth/google redirects to Google without making a real request', async () => {
    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });

  test('GET /api/auth/google/failure responds 401', async () => {
    const res = await request(app).get('/api/auth/google/failure');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/oauth sign-in failed/i);
  });
});

describe('Facebook OAuth routes (credentials configured in this environment)', () => {
  test('GET /api/auth/facebook redirects to Facebook without making a real request', async () => {
    const res = await request(app).get('/api/auth/facebook');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('facebook.com');
  });

  test('GET /api/auth/facebook/failure responds 401', async () => {
    const res = await request(app).get('/api/auth/facebook/failure');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/oauth sign-in failed/i);
  });
});

/**
 * Builds a bare Express app mounting a FRESH copy of authRoutes with the
 * given OAuth env vars removed beforehand, so passport/config/passport.js
 * computes isGoogleConfigured/isFacebookConfigured as false — exercising
 * the "provider not configured" branch that's unreachable in this dev
 * environment's real `app` (real credentials are present in .env). Neither
 * the 503 branch under test nor route mounting touches the database, so
 * the fresh, disconnected module graph jest.isolateModules produces here
 * is safe to use.
 */
function buildAppWithoutProvider(envVarsToDelete) {
  const originalValues = {};
  envVarsToDelete.forEach((key) => {
    originalValues[key] = process.env[key];
    delete process.env[key];
  });

  let authRoutes;
  try {
    jest.isolateModules(() => {
      authRoutes = require('../src/routes/authRoutes');
    });
  } finally {
    envVarsToDelete.forEach((key) => {
      process.env[key] = originalValues[key];
    });
  }

  const miniApp = express();
  miniApp.use(express.json());
  miniApp.use('/api/auth', authRoutes);
  return miniApp;
}

describe('OAuth routes when a provider is NOT configured', () => {
  test('Google: /google and /google/callback both respond 503', async () => {
    const unconfiguredApp = buildAppWithoutProvider(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);

    const initiate = await request(unconfiguredApp).get('/api/auth/google');
    expect(initiate.status).toBe(503);
    expect(initiate.body.message).toMatch(/not configured/i);

    const callback = await request(unconfiguredApp).get('/api/auth/google/callback');
    expect(callback.status).toBe(503);
  });

  test('Facebook: /facebook and /facebook/callback both respond 503', async () => {
    const unconfiguredApp = buildAppWithoutProvider(['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']);

    const initiate = await request(unconfiguredApp).get('/api/auth/facebook');
    expect(initiate.status).toBe(503);
    expect(initiate.body.message).toMatch(/not configured/i);

    const callback = await request(unconfiguredApp).get('/api/auth/facebook/callback');
    expect(callback.status).toBe(503);
  });
});

describe('oauthCallback controller (post-authentication session logic)', () => {
  function appWithStubbedPassportUser(user) {
    const miniApp = express();
    // Stands in for what passport's verify callback (config/passport.js's
    // findOrCreateOAuthUser) would have already attached to req.user by the
    // time this controller runs in the real route.
    miniApp.use((req, res, next) => {
      req.user = user;
      next();
    });
    miniApp.get('/callback', authController.oauthCallback);
    return miniApp;
  }

  test('issues a session (sets auth cookies) and redirects to FRONTEND_URL/auth/callback', async () => {
    const { user } = await createUser();
    const miniApp = appWithStubbedPassportUser(user);

    const res = await request(miniApp).get('/callback');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${process.env.FRONTEND_URL}/auth/callback`);
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  test('updates lastLoginAt as part of issuing the session', async () => {
    const { user } = await createUser();
    expect(user.lastLoginAt).toBeUndefined();
    const miniApp = appWithStubbedPassportUser(user);

    await request(miniApp).get('/callback');

    const User = require('../src/models/User');
    const reloaded = await User.findById(user._id);
    expect(reloaded.lastLoginAt).toBeInstanceOf(Date);
  });
});
