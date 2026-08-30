const express = require('express');
const request = require('supertest');
const app = require('../src/app');
const authController = require('../src/controllers/authController');
const oauthCodeRegistry = require('../src/services/oauthCodeRegistry');
const { frontendUrl, primaryFrontendOrigin } = require('../src/config/frontend');
const { connect, clearDatabase, closeDatabase } = require('./utils/db');
const { createUser } = require('./utils/auth');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
  oauthCodeRegistry.reset();
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

/**
 * Runs the real initiating leg (GET /api/auth/facebook) and returns the
 * `state` it sent to Facebook together with the cookie it set — i.e. exactly
 * what the user's browser carries into the callback. No network call is made:
 * passport only builds a redirect URL here.
 */
async function startFacebookLogin() {
  const res = await request(app).get('/api/auth/facebook');
  const state = new URL(res.headers.location).searchParams.get('state');
  const cookie = (res.headers['set-cookie'] || [])
    .find((c) => c.startsWith('oauth_state_facebook='))
    .split(';')[0];
  return { state, cookie };
}
describe('Google OAuth routes (credentials configured in this environment)', () => {
  test('GET /api/auth/google redirects to Google without making a real request', async () => {
    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });

  test('sends a state nonce and stores it in a single-use cookie', async () => {
    const res = await request(app).get('/api/auth/google');

    const state = new URL(res.headers.location).searchParams.get('state');
    expect(state).toBeTruthy();
    expect((res.headers['set-cookie'] || []).some((c) => c.startsWith('oauth_state_google='))).toBe(
      true
    );
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

  test('sends a state nonce and stores it in a single-use cookie', async () => {
    const res = await request(app).get('/api/auth/facebook');

    const state = new URL(res.headers.location).searchParams.get('state');
    expect(state).toBeTruthy();
    expect(
      (res.headers['set-cookie'] || []).some((c) => c.startsWith('oauth_state_facebook='))
    ).toBe(true);
  });

  test('a callback with no state cookie is rejected and redirected to the frontend, never exchanged', async () => {
    // No oauth_state_facebook cookie is sent, so the state check fails
    // before passport ever presents the code to Facebook — which is what
    // makes a forged or replayed callback a non-event. The user must end
    // up back on the frontend, not on an API error page.
    const res = await request(app).get(
      '/api/auth/facebook/callback?code=NEVER_EXCHANGED&state=bogus'
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(frontendUrl('/login', { error: 'oauth_state_invalid' }));
    expect(res.headers.location.startsWith(primaryFrontendOrigin)).toBe(true);
  });

  test("a cookie-less fetch of the callback URL does not claim the browser's authorization code", async () => {
    // Facebook's own link scanner (facebookexternalhit) follows the callback
    // URL during the login flow: same `code` and `state` query parameters,
    // no cookies. It has to be a complete non-event. If it were allowed to
    // claim the code first, the real browser arriving a moment later would
    // be treated as a duplicate and handed the scanner's failed outcome —
    // a login that can never succeed.
    const res = await request(app)
      .get('/api/auth/facebook/callback?code=BROWSER_CODE&state=bogus')
      .set('User-Agent', 'facebookexternalhit/1.1');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(frontendUrl('/login', { error: 'oauth_state_invalid' }));

    // The code is still untouched: the browser's request would own it.
    expect(oauthCodeRegistry.claim('facebook', 'BROWSER_CODE').duplicate).toBe(false);
  });

  test('a cookie-less fetch cannot pick up a session from an already-completed login', async () => {
    // The scanner can also arrive AFTER the browser has finished. Presenting
    // the code alone must not be enough to be handed that session: the state
    // gate turns the request away before the de-duplication path is reached.
    const { user } = await createUser();
    const claim = oauthCodeRegistry.claim('facebook', 'COMPLETED_CODE');
    claim.settle({ ok: true, userId: user._id.toString() });

    const res = await request(app)
      .get('/api/auth/facebook/callback?code=COMPLETED_CODE&state=bogus')
      .set('User-Agent', 'facebookexternalhit/1.1');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(frontendUrl('/login', { error: 'oauth_state_invalid' }));
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(false);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(false);
  });

  test('a repeated callback for the same code is completed from the first result, not re-exchanged', async () => {
    // Stand in for a first request that already exchanged this code
    // successfully (a reload, a proxy retry, a prefetch arriving after it).
    const { user } = await createUser();
    const claim = oauthCodeRegistry.claim('facebook', 'ALREADY_EXCHANGED');
    expect(claim.duplicate).toBe(false);
    claim.settle({ ok: true, userId: user._id.toString() });

    const { state, cookie } = await startFacebookLogin();
    const res = await request(app)
      .get(`/api/auth/facebook/callback?code=ALREADY_EXCHANGED&state=${state}`)
      .set('Cookie', cookie);

    // Logged in and sent to the frontend — no second call to Facebook, and
    // no "This authorization code has been used." rendered at this URL.
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(frontendUrl('/auth/callback'));
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  test('a repeated callback whose first exchange failed redirects to the frontend with the reason', async () => {
    const claim = oauthCodeRegistry.claim('facebook', 'FAILED_CODE');
    claim.settle({ ok: false, reason: 'exchange_failed' });

    const { state, cookie } = await startFacebookLogin();
    const res = await request(app)
      .get(`/api/auth/facebook/callback?code=FAILED_CODE&state=${state}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(frontendUrl('/login', { error: 'exchange_failed' }));
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
    expect(res.headers.location).toBe(frontendUrl('/auth/callback'));
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
