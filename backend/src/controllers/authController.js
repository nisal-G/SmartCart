const jwt = require('jsonwebtoken');
const User = require('../models/User');
const WebAuthnChallenge = require('../models/WebAuthnChallenge');
const tokenService = require('../services/tokenService');
const webauthnService = require('../services/webauthnService');
const asyncHandler = require('../utils/asyncHandler');

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;

// --- shared helpers --------------------------------------------------------

/** Issues a fresh access+refresh session for `user` and sets both cookies. */
async function issueSession(user, req, res) {
  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  user.lastLoginAt = new Date();
  await user.save();
  tokenService.setAuthCookies(res, { accessToken, refreshToken });
}

/** Short-lived ticket binding an anonymous passkey ceremony to a user id. */
function signCeremonyTicket(userId, purpose) {
  return jwt.sign({ sub: userId.toString(), purpose }, JWT_SECRET, {
    expiresIn: '5m',
  });
}

function verifyCeremonyTicket(ticket, purpose) {
  const payload = jwt.verify(ticket, JWT_SECRET);
  if (payload.purpose !== purpose) {
    throw new Error('Ticket purpose mismatch');
  }
  return payload.sub;
}

/** Most recent not-yet-expired challenge for this user+type. */
function getLatestChallenge(userId, type) {
  return WebAuthnChallenge.findOne({ user: userId, type }).sort({
    createdAt: -1,
  });
}

// --- OAuth (Google / Facebook) ---------------------------------------------
// The actual redirect to the provider and the token exchange are handled by
// Passport strategies in routes/authRoutes.js; by the time these run,
// `req.user` is the Mongo user document passport's verify callback returned.

const oauthCallback = asyncHandler(async (req, res) => {
  await issueSession(req.user, req, res);

  if (FRONTEND_URL) {
    return res.redirect(`${FRONTEND_URL}/auth/callback`);
  }
  // No frontend configured yet — respond with the profile directly so the
  // flow is testable end-to-end via a browser hitting the API alone.
  return res.status(200).json({ user: req.user });
});

const oauthFailure = (req, res) => {
  res.status(401).json({ message: 'OAuth sign-in failed or was cancelled' });
};

// --- Passkey / WebAuthn ------------------------------------------------

/**
 * Starts a passkey ceremony. If the caller is already authenticated
 * (optionalAuthenticate ran first), this registers an additional device on
 * their existing account. Otherwise it's a new-account signup: {name,email}
 * are required, and a 'pending' user is created that only becomes 'active'
 * once passkeyRegisterVerify succeeds.
 */
const passkeyRegisterOptions = asyncHandler(async (req, res) => {
  let user = req.user;

  if (!user) {
    const { name, email } = req.body;
    if (!name || !email) {
      return res
        .status(400)
        .json({ message: 'name and email are required to register a passkey' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      // Don't let an anonymous caller attach a credential to someone else's
      // account. They must log in first (via an existing provider) and add
      // the passkey from there.
      return res.status(409).json({
        message:
          'An account with this email already exists. Log in first, then add a passkey from your account.',
      });
    }
    user = await User.create({
      name,
      email: email.toLowerCase(),
      role: 'user',
      status: 'pending',
    });
  }

  const excludeCredentials = user.passkeys.map((pk) => ({
    id: pk.credentialId,
    transports: pk.transports,
  }));

  const options = await webauthnService.buildRegistrationOptions(
    user,
    excludeCredentials
  );

  await WebAuthnChallenge.create({
    user: user._id,
    challenge: options.challenge,
    type: 'registration',
  });

  res.status(200).json({
    options,
    ticket: signCeremonyTicket(user._id, 'passkey_register'),
  });
});

const passkeyRegisterVerify = asyncHandler(async (req, res) => {
  const { ticket, attestationResponse, nickname } = req.body;
  if (!ticket || !attestationResponse) {
    return res
      .status(400)
      .json({ message: 'ticket and attestationResponse are required' });
  }

  let userId;
  try {
    userId = verifyCeremonyTicket(ticket, 'passkey_register');
  } catch (err) {
    return res.status(401).json({ message: 'Registration session expired, please try again' });
  }

  const [user, challengeDoc] = await Promise.all([
    User.findById(userId),
    getLatestChallenge(userId, 'registration'),
  ]);
  if (!user || !challengeDoc) {
    return res.status(400).json({ message: 'No pending passkey registration found' });
  }

  let verification;
  try {
    verification = await webauthnService.verifyRegistration(
      attestationResponse,
      challengeDoc.challenge
    );
  } catch (err) {
    return res.status(400).json({ message: `Passkey verification failed: ${err.message}` });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ message: 'Passkey verification failed' });
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  user.passkeys.push({
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports || [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    nickname,
  });
  user.status = 'active';

  await challengeDoc.deleteOne();
  await issueSession(user, req, res);

  res.status(201).json({ user });
});

const passkeyLoginOptions = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'email is required' });
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
    status: 'active',
  });
  if (!user || user.passkeys.length === 0) {
    // Intentional trade-off: this reveals whether an email has a passkey
    // account. Acceptable for now since Google/Facebook lookups have the
    // same property; revisit with a discoverable-credential (usernameless)
    // flow if stronger anti-enumeration guarantees are needed later.
    return res.status(404).json({ message: 'No passkey account found for this email' });
  }

  const allowCredentials = user.passkeys.map((pk) => ({
    id: pk.credentialId,
    transports: pk.transports,
  }));

  const options = await webauthnService.buildAuthenticationOptions(allowCredentials);

  await WebAuthnChallenge.create({
    user: user._id,
    challenge: options.challenge,
    type: 'authentication',
  });

  res.status(200).json({
    options,
    ticket: signCeremonyTicket(user._id, 'passkey_login'),
  });
});

const passkeyLoginVerify = asyncHandler(async (req, res) => {
  const { ticket, assertionResponse } = req.body;
  if (!ticket || !assertionResponse) {
    return res.status(400).json({ message: 'ticket and assertionResponse are required' });
  }

  let userId;
  try {
    userId = verifyCeremonyTicket(ticket, 'passkey_login');
  } catch (err) {
    return res.status(401).json({ message: 'Login session expired, please try again' });
  }

  const [user, challengeDoc] = await Promise.all([
    User.findById(userId),
    getLatestChallenge(userId, 'authentication'),
  ]);
  if (!user || !challengeDoc) {
    return res.status(400).json({ message: 'No pending passkey login found' });
  }

  const credential = user.passkeys.find((pk) => pk.credentialId === assertionResponse.id);
  if (!credential) {
    return res.status(400).json({ message: 'Unrecognized passkey credential' });
  }

  let verification;
  try {
    verification = await webauthnService.verifyAuthentication(
      assertionResponse,
      challengeDoc.challenge,
      {
        id: credential.credentialId,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports,
      }
    );
  } catch (err) {
    return res.status(400).json({ message: `Passkey verification failed: ${err.message}` });
  }

  if (!verification.verified) {
    return res.status(401).json({ message: 'Passkey verification failed' });
  }

  credential.counter = verification.authenticationInfo.newCounter;
  credential.lastUsedAt = new Date();

  await challengeDoc.deleteOne();
  await issueSession(user, req, res);

  res.status(200).json({ user });
});

// --- Admin (email + password) -----------------------------------------

const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({
    email: email.toLowerCase(),
    role: 'admin',
  }).select('+password');

  // Same generic message whether the email doesn't exist, isn't an admin,
  // has no password set, or the password is wrong — avoids confirming
  // which case applies to an attacker.
  const genericFailure = () =>
    res.status(401).json({ message: 'Invalid email or password' });

  if (!user || user.status !== 'active') return genericFailure();

  const passwordOk = await user.comparePassword(password);
  if (!passwordOk) return genericFailure();

  await issueSession(user, req, res);
  res.status(200).json({ user });
});

// --- Session lifecycle ------------------------------------------------

const refresh = asyncHandler(async (req, res) => {
  const parsed = tokenService.parseRefreshCookie(req.cookies.refreshToken);
  if (!parsed) {
    tokenService.clearAuthCookies(res);
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const user = await User.findById(parsed.userId);
  if (!user || !tokenService.consumeMatchingRefreshToken(user, parsed.rawToken)) {
    tokenService.clearAuthCookies(res);
    return res.status(401).json({ message: 'Session expired, please log in again' });
  }

  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  await user.save();
  tokenService.setAuthCookies(res, { accessToken, refreshToken });

  res.status(200).json({ message: 'Session refreshed' });
});

const logout = asyncHandler(async (req, res) => {
  const parsed = tokenService.parseRefreshCookie(req.cookies.refreshToken);
  if (parsed) {
    const user = await User.findById(parsed.userId);
    if (user) {
      tokenService.consumeMatchingRefreshToken(user, parsed.rawToken);
      await user.save();
    }
  }
  tokenService.clearAuthCookies(res);
  res.status(200).json({ message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  res.status(200).json({ user: req.user });
});

module.exports = {
  oauthCallback,
  oauthFailure,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  passkeyLoginOptions,
  passkeyLoginVerify,
  adminLogin,
  refresh,
  logout,
  me,
};
