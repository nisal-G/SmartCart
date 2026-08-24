const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');
const { connect, clearDatabase, closeDatabase } = require('./utils/db');
const { createUser, accessCookie } = require('./utils/auth');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function createAdminWithPassword(password = 'Str0ngPassw0rd!', overrides = {}) {
  const user = await User.create({
    name: overrides.name || 'Site Admin',
    email: overrides.email || `admin${Date.now()}${Math.random()}@example.test`,
    password,
    role: 'admin',
    status: overrides.status || 'active',
  });
  return { user, password };
}

/** Pulls just `name=value` (no attributes) for one cookie out of a Set-Cookie header set. */
function extractCookie(res, name) {
  const raw = res.headers['set-cookie'] || [];
  const match = raw.find((c) => c.startsWith(`${name}=`));
  return match ? match.split(';')[0] : null;
}

describe('POST /api/auth/admin/login', () => {
  test('successful login sets accessToken/refreshToken cookies and returns the user (never the password hash)', async () => {
    const { user, password } = await createAdminWithPassword();

    const res = await request(app).post('/api/auth/admin/login').send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.password).toBeUndefined();
    expect(extractCookie(res, 'accessToken')).toBeTruthy();
    expect(extractCookie(res, 'refreshToken')).toBeTruthy();
  });

  test('wrong password is rejected with a generic message', async () => {
    const { user } = await createAdminWithPassword();
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: user.email, password: 'TheWrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  test('a nonexistent email gets the exact same generic message (no account enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'nobody@example.test', password: 'WhateverPassword1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  test('400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/admin/login').send({ password: 'whatever123' });
    expect(res.status).toBe(400);
  });

  test('400 when password is missing', async () => {
    const res = await request(app).post('/api/auth/admin/login').send({ email: 'admin@example.test' });
    expect(res.status).toBe(400);
  });

  test('a non-admin user cannot log in via the admin endpoint, even with correct credentials', async () => {
    const password = 'Str0ngPassw0rd!';
    const user = await User.create({
      name: 'Shopper',
      email: 'shopper@example.test',
      password,
      role: 'user',
      status: 'active',
    });
    const res = await request(app).post('/api/auth/admin/login').send({ email: user.email, password });
    expect(res.status).toBe(401);
  });

  test('a suspended admin account cannot log in', async () => {
    const { user, password } = await createAdminWithPassword(undefined, { status: 'suspended' });
    const res = await request(app).post('/api/auth/admin/login').send({ email: user.email, password });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  test('returns the authenticated user profile', async () => {
    const { user, accessToken } = await createUser();
    const res = await request(app).get('/api/auth/me').set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  test('401 without an access token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('401 with a structurally invalid access token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', ['accessToken=not-a-real-jwt']);
    expect(res.status).toBe(401);
  });

  test('401 with an expired access token, reported with the TOKEN_EXPIRED code', async () => {
    const { user } = await createUser();
    const expiredToken = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
      expiresIn: -10,
    });
    const res = await request(app).get('/api/auth/me').set('Cookie', [`accessToken=${expiredToken}`]);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  test('401 for a valid token belonging to a now-suspended user', async () => {
    const { accessToken } = await createUser({ status: 'suspended' });
    const res = await request(app).get('/api/auth/me').set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(401);
  });

  test('401 for a valid token whose user no longer exists', async () => {
    const { user, accessToken } = await createUser();
    await User.deleteOne({ _id: user._id });
    const res = await request(app).get('/api/auth/me').set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(401);
  });
});

describe('Session lifecycle: refresh, rotation, and logout', () => {
  test('refresh issues a new session, and the OLD refresh token can no longer be reused after rotation', async () => {
    const { user, password } = await createAdminWithPassword();
    const agent = request.agent(app);

    const loginRes = await agent.post('/api/auth/admin/login').send({ email: user.email, password });
    const firstRefreshCookie = extractCookie(loginRes, 'refreshToken');
    expect(firstRefreshCookie).toBeTruthy();

    const refreshRes = await agent.post('/api/auth/refresh');
    expect(refreshRes.status).toBe(200);
    const secondRefreshCookie = extractCookie(refreshRes, 'refreshToken');
    expect(secondRefreshCookie).toBeTruthy();
    expect(secondRefreshCookie).not.toBe(firstRefreshCookie);

    // Replaying the token that was just consumed/rotated away must fail —
    // this is the reuse-detection half of rotation (tokenService's
    // consumeMatchingRefreshToken removes it from the user on use).
    const reuseRes = await request(app).post('/api/auth/refresh').set('Cookie', [firstRefreshCookie]);
    expect(reuseRes.status).toBe(401);

    // The currently-valid (rotated-to) token still works.
    const worksRes = await request(app).post('/api/auth/refresh').set('Cookie', [secondRefreshCookie]);
    expect(worksRes.status).toBe(200);
  });

  test('refresh without a refresh token cookie is rejected', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  test('refresh with a malformed refresh token cookie is rejected', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['refreshToken=not-the-expected-format']);
    expect(res.status).toBe(401);
  });

  test('logout clears the session and the refresh token can no longer be used afterward', async () => {
    const { user, password } = await createAdminWithPassword();
    const agent = request.agent(app);
    await agent.post('/api/auth/admin/login').send({ email: user.email, password });

    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);

    const afterLogout = await agent.post('/api/auth/refresh');
    expect(afterLogout.status).toBe(401);
  });

  test("logging out doesn't error even with no session present", async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
  });
});
