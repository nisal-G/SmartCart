const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const WebAuthnChallenge = require('../src/models/WebAuthnChallenge');
const webauthnService = require('../src/services/webauthnService');
const { connect, clearDatabase, closeDatabase } = require('./utils/db');
const { createUser, accessCookie } = require('./utils/auth');

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

async function createUserWithPasskey(overrides = {}) {
  return User.create({
    name: overrides.name || 'Passkey User',
    email: overrides.email || `passkey${Date.now()}${Math.random()}@example.test`,
    role: 'user',
    status: 'active',
    passkeys: [
      {
        credentialId: overrides.credentialId || 'mock-credential-id-1',
        publicKey: Buffer.from('mock-public-key-bytes'),
        counter: 0,
        transports: ['internal'],
        deviceType: 'singleDevice',
        backedUp: false,
      },
    ],
  });
}

describe('POST /api/auth/passkey/register/options', () => {
  test('anonymous signup: creates a pending user and returns registration options + a ticket', async () => {
    const email = `newuser${Date.now()}@example.test`;
    const res = await request(app)
      .post('/api/auth/passkey/register/options')
      .send({ name: 'New User', email });

    expect(res.status).toBe(200);
    expect(res.body.ticket).toBeTruthy();
    expect(res.body.options.challenge).toBeTruthy();

    const pendingUser = await User.findOne({ email: email.toLowerCase() });
    expect(pendingUser).not.toBeNull();
    expect(pendingUser.status).toBe('pending');

    const challenge = await WebAuthnChallenge.findOne({ user: pendingUser._id, type: 'registration' });
    expect(challenge).not.toBeNull();
  });

  test('400 when anonymous and missing name/email', async () => {
    const res = await request(app).post('/api/auth/passkey/register/options').send({});
    expect(res.status).toBe(400);
  });

  test('409 when the email already belongs to an existing account', async () => {
    const { user } = await createUser();
    const res = await request(app)
      .post('/api/auth/passkey/register/options')
      .send({ name: 'Someone Else', email: user.email });
    expect(res.status).toBe(409);
  });

  test('an authenticated user can start registering an additional device without name/email', async () => {
    const { accessToken } = await createUser();
    const res = await request(app)
      .post('/api/auth/passkey/register/options')
      .set('Cookie', accessCookie(accessToken))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ticket).toBeTruthy();
  });

  test('an authenticated user is bound to their own account even if the body names someone else', async () => {
    // A second real account whose email an authenticated caller could try
    // putting in the request body — the endpoint must ignore it entirely
    // rather than let a signed-in user attach a passkey to it.
    const { user: otherUser } = await createUser();
    const { user, accessToken } = await createUser();

    const res = await request(app)
      .post('/api/auth/passkey/register/options')
      .set('Cookie', accessCookie(accessToken))
      .send({ name: 'Someone Else', email: otherUser.email });

    expect(res.status).toBe(200);

    const challenge = await WebAuthnChallenge.findOne({ type: 'registration' });
    expect(challenge.user.toString()).toBe(user._id.toString());
    expect(challenge.user.toString()).not.toBe(otherUser._id.toString());
  });
});

describe('POST /api/auth/passkey/register/verify', () => {
  test('400 when ticket or attestationResponse is missing', async () => {
    const res = await request(app).post('/api/auth/passkey/register/verify').send({ ticket: 'x' });
    expect(res.status).toBe(400);
  });

  test('401 for an invalid/garbage ticket', async () => {
    const res = await request(app)
      .post('/api/auth/passkey/register/verify')
      .send({ ticket: 'not-a-real-jwt', attestationResponse: {} });
    expect(res.status).toBe(401);
  });

  test('400 when no matching challenge is on record', async () => {
    const email = `newuser${Date.now()}@example.test`;
    const optionsRes = await request(app)
      .post('/api/auth/passkey/register/options')
      .send({ name: 'New User', email });
    const { ticket } = optionsRes.body;

    await WebAuthnChallenge.deleteMany({}); // simulate an expired/consumed challenge

    const res = await request(app)
      .post('/api/auth/passkey/register/verify')
      .send({ ticket, attestationResponse: {} });
    expect(res.status).toBe(400);
  });

  test('400 when the WebAuthn library rejects the (malformed) attestation response', async () => {
    const email = `newuser${Date.now()}@example.test`;
    const optionsRes = await request(app)
      .post('/api/auth/passkey/register/options')
      .send({ name: 'New User', email });
    const { ticket } = optionsRes.body;

    // Real (unmocked) verifyRegistration call — garbage input, no browser
    // ever produced this, so @simplewebauthn/server itself must reject it.
    const res = await request(app)
      .post('/api/auth/passkey/register/verify')
      .send({ ticket, attestationResponse: { garbage: true } });
    expect(res.status).toBe(400);
  });

  test('successful verification activates the user, stores the credential, and issues a session', async () => {
    const email = `newuser${Date.now()}@example.test`;
    const optionsRes = await request(app)
      .post('/api/auth/passkey/register/options')
      .send({ name: 'New User', email });
    const { ticket } = optionsRes.body;

    jest.spyOn(webauthnService, 'verifyRegistration').mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'cred-abc',
          publicKey: Buffer.from('pk'),
          counter: 0,
          transports: ['internal'],
        },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
      },
    });

    const res = await request(app)
      .post('/api/auth/passkey/register/verify')
      .send({ ticket, attestationResponse: {}, nickname: 'My Phone' });

    expect(res.status).toBe(201);
    expect(res.body.user.passkeys).toHaveLength(1);
    expect(res.body.user.passkeys[0].nickname).toBe('My Phone');
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);

    const dbUser = await User.findOne({ email: email.toLowerCase() });
    expect(dbUser.status).toBe('active');
    expect(dbUser.passkeys).toHaveLength(1);
  });

  test('400 when the library reports the ceremony as not verified', async () => {
    const email = `newuser${Date.now()}@example.test`;
    const optionsRes = await request(app)
      .post('/api/auth/passkey/register/options')
      .send({ name: 'New User', email });
    const { ticket } = optionsRes.body;

    jest.spyOn(webauthnService, 'verifyRegistration').mockResolvedValue({ verified: false });

    const res = await request(app)
      .post('/api/auth/passkey/register/verify')
      .send({ ticket, attestationResponse: {} });
    expect(res.status).toBe(400);

    const dbUser = await User.findOne({ email: email.toLowerCase() });
    expect(dbUser.status).toBe('pending'); // never activated
  });
});

describe('POST /api/auth/passkey/login/options', () => {
  test('400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/passkey/login/options').send({});
    expect(res.status).toBe(400);
  });

  test('404 for an email with no account', async () => {
    const res = await request(app)
      .post('/api/auth/passkey/login/options')
      .send({ email: 'nobody@example.test' });
    expect(res.status).toBe(404);
  });

  test('404 when the account exists but has no registered passkeys', async () => {
    const { user } = await createUser();
    const res = await request(app).post('/api/auth/passkey/login/options').send({ email: user.email });
    expect(res.status).toBe(404);
  });

  test('200 for a user with a registered passkey, and records a challenge', async () => {
    const user = await createUserWithPasskey();
    const res = await request(app).post('/api/auth/passkey/login/options').send({ email: user.email });

    expect(res.status).toBe(200);
    expect(res.body.ticket).toBeTruthy();
    expect(res.body.options.challenge).toBeTruthy();

    const challenge = await WebAuthnChallenge.findOne({ user: user._id, type: 'authentication' });
    expect(challenge).not.toBeNull();
  });
});

describe('POST /api/auth/passkey/login/verify', () => {
  test('400 when ticket or assertionResponse is missing', async () => {
    const res = await request(app).post('/api/auth/passkey/login/verify').send({ ticket: 'x' });
    expect(res.status).toBe(400);
  });

  test('401 for an invalid/garbage ticket', async () => {
    const res = await request(app)
      .post('/api/auth/passkey/login/verify')
      .send({ ticket: 'not-a-real-jwt', assertionResponse: { id: 'whatever' } });
    expect(res.status).toBe(401);
  });

  test('400 when no matching challenge is on record', async () => {
    const user = await createUserWithPasskey({ credentialId: 'real-cred-id' });
    const optionsRes = await request(app).post('/api/auth/passkey/login/options').send({ email: user.email });
    const { ticket } = optionsRes.body;

    await WebAuthnChallenge.deleteMany({});

    const res = await request(app)
      .post('/api/auth/passkey/login/verify')
      .send({ ticket, assertionResponse: { id: 'real-cred-id' } });
    expect(res.status).toBe(400);
  });

  test('400 for a credential id that does not belong to the user', async () => {
    const user = await createUserWithPasskey({ credentialId: 'real-cred-id' });
    const optionsRes = await request(app).post('/api/auth/passkey/login/options').send({ email: user.email });
    const { ticket } = optionsRes.body;

    const res = await request(app)
      .post('/api/auth/passkey/login/verify')
      .send({ ticket, assertionResponse: { id: 'someone-elses-credential' } });
    expect(res.status).toBe(400);
  });

  test('successful verification issues a session and updates the credential counter/lastUsedAt', async () => {
    const user = await createUserWithPasskey({ credentialId: 'real-cred-id' });
    const optionsRes = await request(app).post('/api/auth/passkey/login/options').send({ email: user.email });
    const { ticket } = optionsRes.body;

    jest.spyOn(webauthnService, 'verifyAuthentication').mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 7 },
    });

    const res = await request(app)
      .post('/api/auth/passkey/login/verify')
      .send({ ticket, assertionResponse: { id: 'real-cred-id' } });

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);

    const dbUser = await User.findById(user._id);
    expect(dbUser.passkeys[0].counter).toBe(7);
    expect(dbUser.passkeys[0].lastUsedAt).toBeInstanceOf(Date);
  });

  test('401 when the library reports the assertion as not verified', async () => {
    const user = await createUserWithPasskey({ credentialId: 'real-cred-id' });
    const optionsRes = await request(app).post('/api/auth/passkey/login/options').send({ email: user.email });
    const { ticket } = optionsRes.body;

    jest.spyOn(webauthnService, 'verifyAuthentication').mockResolvedValue({ verified: false });

    const res = await request(app)
      .post('/api/auth/passkey/login/verify')
      .send({ ticket, assertionResponse: { id: 'real-cred-id' } });
    expect(res.status).toBe(401);
  });

  test('400 when the WebAuthn library rejects a malformed (real, unmocked) assertion response', async () => {
    const user = await createUserWithPasskey({ credentialId: 'real-cred-id' });
    const optionsRes = await request(app).post('/api/auth/passkey/login/options').send({ email: user.email });
    const { ticket } = optionsRes.body;

    const res = await request(app)
      .post('/api/auth/passkey/login/verify')
      .send({ ticket, assertionResponse: { id: 'real-cred-id', garbage: true } });
    expect(res.status).toBe(400);
  });
});
