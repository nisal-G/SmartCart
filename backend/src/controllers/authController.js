const jwt = require('jsonwebtoken');
const User = require('../models/User');
const WebAuthnChallenge = require('../models/WebAuthnChallenge');
const tokenService = require('../services/tokenService');
const webauthnService = require('../services/webauthnService');
const asyncHandler = require('../utils/asyncHandler');
const oauthCodeRegistry = require('../services/oauthCodeRegistry');
const logger = require('../config/logger');
const { frontendUrl } = require('../config/frontend');
const { stateStoreFor } = require('../services/oauthStateStore');
const traceRef = require('../utils/traceRef');

const JWT_SECRET = process.env.JWT_SECRET;

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
// The redirect out to the provider and the authorization-code exchange are
// handled by the Passport strategies wired up in config/passport.js; by the
// time oauthCallback runs, `req.user` is the Mongo user document passport's
// verify callback returned.
//
// The callback URL is a plain GET that anything can request: it sits in the
// browser's address bar and history, and — as Facebook's own
// `facebookexternalhit` link scanner demonstrates — third parties fetch it
// too. So the chain is ordered strictly by trust:
//
//   1. oauthStateGate  - prove possession of the state cookie issued when
//                        THIS login started. Nothing else may run first,
//                        because everything after it touches the single-use
//                        authorization code.
//   2. oauthCodeGuard  - claim the code, so it is exchanged exactly once
//                        however many times the callback is requested.
//   3. passport        - re-verifies state (authoritatively, consuming the
//                        cookie) and performs the one token exchange.
//
// Every failure path lands the user back on the frontend with a reason,
// never on an API error page.

/** Where the browser goes after a successful OAuth login. */
const OAUTH_SUCCESS_PATH = process.env.OAUTH_SUCCESS_PATH || '/auth/callback';
/** Where the browser goes when OAuth could not be completed. */
const OAUTH_FAILURE_PATH = process.env.OAUTH_FAILURE_PATH || '/login';

/**
 * Per-request diagnostic context for one OAuth callback, built once and
 * reused by every phase so the log lines for a single attempt line up with
 * each other. The code and state are referenced by hash only — they are
 * single-use credentials and never go to a log.
 */
function oauthTrace(req, provider, extra) {
  if (!req.oauthTrace) {
    req.oauthTrace = {
      provider,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      referer: req.headers.referer,
      codeRef: traceRef(req.query && req.query.code),
      stateRef: traceRef(req.query && req.query.state),
      hasStateParam: Boolean(req.query && req.query.state),
      hasStateCookie: Boolean(req.cookies && req.cookies[`oauth_state_${provider}`]),
    };
  }
  return { ...req.oauthTrace, ...extra };
}

/**
 * Gate 1: does this request hold the state cookie from the login that
 * produced this code?
 *
 * This has to run before ANYTHING that touches the authorization code,
 * the de-duplication registry included. Facebook's link scanner
 * (`facebookexternalhit`) follows the callback URL it sees during the login
 * flow, carrying the `code` and `state` query parameters but — being a
 * server-side fetcher rather than the user's browser — no cookies. It has
 * to be a complete non-event: it may not exchange the code, and it may not
 * claim, settle or otherwise disturb the registry entry the real browser is
 * about to need.
 *
 * The check is deliberately non-destructive (see oauthStateStore.check).
 * Passport still performs its own authoritative verification a step later,
 * which is what actually consumes the cookie.
 */
const oauthStateGate = (provider) => (req, res, next) => {
  const code = req.query && req.query.code;
  // No code means the provider reported an error (`?error=access_denied`) or
  // somebody opened the URL by hand. There is no code to protect, so let
  // passport produce the proper outcome.
  if (!code) return next();

  const result = stateStoreFor(provider).check(req, req.query.state);

  if (!result.ok) {
    logger.warn(
      oauthTrace(req, provider, { phase: 'state_check', stateValid: false, reason: result.reason }),
      '[auth] OAuth callback rejected before the authorization code was touched: no valid state cookie'
    );
    return redirectOAuthFailure(res, 'oauth_state_invalid');
  }

  logger.info(
    oauthTrace(req, provider, { phase: 'state_check', stateValid: true }),
    '[auth] OAuth callback presented a valid state cookie'
  );
  return next();
};

/**
 * Gate 2: one authorization code is only ever exchanged with the provider
 * once. Runs after the state gate and before passport, so a duplicate never
 * reaches the strategy and never triggers a second token exchange.
 *
 *  - first request for this code: claims it, and passes `req.oauthCodeClaim`
 *    down the chain to be settled with the result.
 *  - duplicate: waits for the first request's outcome and completes from it —
 *    issuing a session for the same user on success, so a retry still logs
 *    the user in instead of showing "authorization code has been used".
 *
 * Issuing a session on the duplicate path is safe precisely because of the
 * ordering: only a request that already proved possession of this login's
 * state cookie ever reaches it.
 */
const oauthCodeGuard = (provider) =>
  asyncHandler(async (req, res, next) => {
    const code = req.query && req.query.code;
    if (!code) return next();

    const claim = oauthCodeRegistry.claim(provider, code);

    if (!claim.duplicate) {
      req.oauthCodeClaim = claim;
      logger.info(
        oauthTrace(req, provider, { phase: 'code_claim', duplicate: false }),
        '[auth] Claimed the authorization code — this request owns the token exchange'
      );
      // Safety net: if this request ends without settling (an unhandled
      // crash, an aborted connection), release any waiter rather than
      // leaving it hanging until its timeout.
      res.on('close', () => claim.settle({ ok: false, reason: 'incomplete' }));
      return next();
    }

    logger.warn(
      oauthTrace(req, provider, { phase: 'code_claim', duplicate: true }),
      '[auth] Duplicate OAuth callback for an already-claimed authorization code — reusing the first exchange instead of calling the provider again'
    );

    const outcome = await claim.outcome();
    if (outcome && outcome.ok) {
      try {
        return await finishOAuthLogin(req, res, outcome.userId);
      } catch (err) {
        logger.error(
          oauthTrace(req, provider, { phase: 'duplicate_complete', err }),
          '[auth] Could not complete a duplicate OAuth callback'
        );
        return redirectOAuthFailure(res, 'session_not_established');
      }
    }
    return redirectOAuthFailure(res, (outcome && outcome.reason) || 'duplicate_callback');
  });

/** Issues the session for `userId` and sends the browser to the frontend. */
async function finishOAuthLogin(req, res, userId) {
  const user = await User.findById(userId);
  if (!user || user.status !== 'active') {
    return redirectOAuthFailure(res, 'account_unavailable');
  }
  await issueSession(user, req, res);
  const location = frontendUrl(OAUTH_SUCCESS_PATH);
  logger.info(
    { ...req.oauthTrace, phase: 'redirect', outcome: 'success', userId: String(user._id), location },
    '[auth] OAuth login complete — session cookies set'
  );
  return res.redirect(location);
}

/**
 * Sends the browser back to the frontend with a machine-readable reason
 * instead of rendering an API error page at this URL. The underlying error
 * is not swallowed — callers log it in full (see oauthAuthenticate in
 * routes/authRoutes.js) before calling this.
 */
function redirectOAuthFailure(res, reason) {
  const location = frontendUrl(OAUTH_FAILURE_PATH, { error: reason || 'oauth_failed' });
  logger.warn(
    { ...(res.req && res.req.oauthTrace), phase: 'redirect', outcome: 'failure', reason, location },
    '[auth] OAuth callback finished without a session'
  );
  return res.redirect(location);
}

const oauthCallback = asyncHandler(async (req, res) => {
  try {
    await issueSession(req.user, req, res);
  } catch (err) {
    // The provider leg worked; we failed to start the session (the database
    // being unreachable, say). Log it, then still put the user back on the
    // frontend — the last remaining way this route could dead-end them on
    // an API error page.
    logger.error({ err }, '[auth] Could not issue a session after a successful OAuth exchange');
    if (req.oauthCodeClaim) {
      req.oauthCodeClaim.settle({ ok: false, reason: 'session_not_established' });
    }
    return redirectOAuthFailure(res, 'session_not_established');
  }

  // Record the successful exchange before responding, so a duplicate already
  // waiting on it completes from this result rather than timing out.
  if (req.oauthCodeClaim) {
    req.oauthCodeClaim.settle({ ok: true, userId: req.user._id.toString() });
  }

  const location = frontendUrl(OAUTH_SUCCESS_PATH);
  logger.info(
    {
      ...req.oauthTrace,
      phase: 'redirect',
      outcome: 'success',
      userId: req.user._id.toString(),
      location,
    },
    '[auth] OAuth login complete — session cookies set'
  );
  return res.redirect(location);
});

/** Kept for the legacy /:provider/failure routes. */
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
  oauthStateGate,
  oauthCodeGuard,
  redirectOAuthFailure,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  passkeyLoginOptions,
  passkeyLoginVerify,
  adminLogin,
  refresh,
  logout,
  me,
};
