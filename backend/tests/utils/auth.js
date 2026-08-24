const User = require('../../src/models/User');
const { signAccessToken } = require('../../src/services/tokenService');

let counter = 0;

/** Creates an active user directly in the DB and signs a valid access token for it — mirrors what a real login would leave in place, without exercising the OAuth/passkey flows tested separately by Auth's own suite. */
async function createUser(overrides = {}) {
  counter += 1;
  const user = await User.create({
    name: overrides.name || 'Test User',
    email: overrides.email || `user${counter}.${Date.now()}@example.test`,
    role: overrides.role || 'user',
    status: overrides.status || 'active',
  });
  const accessToken = signAccessToken(user);
  return { user, accessToken };
}

function createAdmin(overrides = {}) {
  return createUser({ ...overrides, role: 'admin' });
}

/** Value for supertest's `.set('Cookie', ...)`, matching how authenticate.js reads the cookie. */
function accessCookie(token) {
  return [`accessToken=${token}`];
}

module.exports = { createUser, createAdmin, accessCookie };
