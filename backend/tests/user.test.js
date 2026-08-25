const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { connect, clearDatabase, closeDatabase } = require('./utils/db');
const { createUser, createAdmin, accessCookie } = require('./utils/auth');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
  jest.restoreAllMocks();
});

afterAll(async () => {
  await closeDatabase();
});

/** A syntactically valid Mongo ObjectId that doesn't exist in the DB. */
function nonExistentId() {
  return new mongoose.Types.ObjectId().toString();
}

describe('GET /api/users (admin only)', () => {
  test('401 when unauthenticated', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  test('403 for an authenticated non-admin user', async () => {
    const { accessToken } = await createUser();
    const res = await request(app).get('/api/users').set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(403);
  });

  test('admin: lists accounts newest first, with pagination', async () => {
    const { accessToken: adminToken } = await createAdmin();
    await createUser({ name: 'Alice' });
    await createUser({ name: 'Bob' });

    const res = await request(app)
      .get('/api/users?limit=2')
      .set('Cookie', accessCookie(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });

  test('admin: never exposes password/refreshTokens', async () => {
    const { accessToken: adminToken } = await createAdmin();
    await createUser();

    const res = await request(app).get('/api/users').set('Cookie', accessCookie(adminToken));
    expect(res.status).toBe(200);
    for (const user of res.body.users) {
      expect(user.password).toBeUndefined();
      expect(user.refreshTokens).toBeUndefined();
    }
  });

  test('admin: filters by status', async () => {
    const { accessToken: adminToken } = await createAdmin();
    await createUser({ status: 'active' });
    await createUser({ status: 'suspended' });

    const res = await request(app)
      .get('/api/users?status=suspended')
      .set('Cookie', accessCookie(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].status).toBe('suspended');
  });

  test('an invalid status filter is rejected', async () => {
    const { accessToken: adminToken } = await createAdmin();
    const res = await request(app)
      .get('/api/users?status=bogus')
      .set('Cookie', accessCookie(adminToken));
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/users/:id/status (admin only)', () => {
  test('401 when unauthenticated', async () => {
    const { user } = await createUser();
    const res = await request(app)
      .patch(`/api/users/${user._id}/status`)
      .send({ status: 'suspended' });
    expect(res.status).toBe(401);
  });

  test('403 for an authenticated non-admin user', async () => {
    const { accessToken } = await createUser();
    const { user: target } = await createUser();
    const res = await request(app)
      .patch(`/api/users/${target._id}/status`)
      .set('Cookie', accessCookie(accessToken))
      .send({ status: 'suspended' });
    expect(res.status).toBe(403);
  });

  test('admin can suspend an account', async () => {
    const { accessToken: adminToken } = await createAdmin();
    const { user } = await createUser();

    const res = await request(app)
      .patch(`/api/users/${user._id}/status`)
      .set('Cookie', accessCookie(adminToken))
      .send({ status: 'suspended' });

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('suspended');

    const reloaded = await User.findById(user._id);
    expect(reloaded.status).toBe('suspended');
  });

  test('admin can reactivate a suspended account', async () => {
    const { accessToken: adminToken } = await createAdmin();
    const { user } = await createUser({ status: 'suspended' });

    const res = await request(app)
      .patch(`/api/users/${user._id}/status`)
      .set('Cookie', accessCookie(adminToken))
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('active');
  });

  test('a suspended account loses access on its very next request', async () => {
    const { accessToken: adminToken } = await createAdmin();
    const { user, accessToken: userToken } = await createUser();

    await request(app)
      .patch(`/api/users/${user._id}/status`)
      .set('Cookie', accessCookie(adminToken))
      .send({ status: 'suspended' });

    const res = await request(app).get('/api/auth/me').set('Cookie', accessCookie(userToken));
    expect(res.status).toBe(401);
  });

  test('an invalid status value is rejected', async () => {
    const { accessToken: adminToken } = await createAdmin();
    const { user } = await createUser();
    const res = await request(app)
      .patch(`/api/users/${user._id}/status`)
      .set('Cookie', accessCookie(adminToken))
      .send({ status: 'pending' });
    expect(res.status).toBe(400);
  });

  test('404 for a well-formed id that does not exist', async () => {
    const { accessToken: adminToken } = await createAdmin();
    const res = await request(app)
      .patch(`/api/users/${nonExistentId()}/status`)
      .set('Cookie', accessCookie(adminToken))
      .send({ status: 'suspended' });
    expect(res.status).toBe(404);
  });

  test('400 for a malformed id', async () => {
    const { accessToken: adminToken } = await createAdmin();
    const res = await request(app)
      .patch('/api/users/not-an-id/status')
      .set('Cookie', accessCookie(adminToken))
      .send({ status: 'suspended' });
    expect(res.status).toBe(400);
  });

  test('an admin cannot change their own account status', async () => {
    const { accessToken: adminToken, user: admin } = await createAdmin();
    const res = await request(app)
      .patch(`/api/users/${admin._id}/status`)
      .set('Cookie', accessCookie(adminToken))
      .send({ status: 'suspended' });
    expect(res.status).toBe(400);

    const reloaded = await User.findById(admin._id);
    expect(reloaded.status).toBe('active');
  });
});
