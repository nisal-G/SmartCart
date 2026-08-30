const crypto = require('crypto');
const jwt = require('jsonwebtoken');
// Cookie attributes (SameSite/Secure) are derived centrally there — a
// cross-site frontend needs SameSite=None; Secure, or the browser stores
// these cookies and then never sends them again.
const { baseCookieOptions } = require('../config/cookies');

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7);
const REFRESH_EXPIRES_MS = REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
const ACCESS_COOKIE_MS = 15 * 60 * 1000;

if (!JWT_SECRET) {
  // Fail loudly at boot rather than silently signing tokens with `undefined`.
  throw new Error(
    'JWT_SECRET is not set. Add it to backend/.env before starting the server.'
  );
}

function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Issues a new opaque refresh token for `user`, stores only its hash on the
 * user document, and returns the raw cookie value (`<userId>.<rawToken>`)
 * to hand to the client. The userId prefix lets /refresh look the user up
 * without an index scan across every user's token hashes.
 */
async function issueRefreshToken(user, { userAgent, ip } = {}) {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

  user.refreshTokens.push({
    tokenHash: hashToken(rawToken),
    expiresAt,
    userAgent,
    ip,
  });

  return `${user._id.toString()}.${rawToken}`;
}

function parseRefreshCookie(cookieValue) {
  if (!cookieValue || !cookieValue.includes('.')) return null;
  const [userId, rawToken] = cookieValue.split('.');
  if (!userId || !rawToken) return null;
  return { userId, rawToken };
}

/**
 * Finds the matching, non-expired refresh token entry on `user` (if any)
 * and removes it (rotation: every refresh consumes the token it was given).
 */
function consumeMatchingRefreshToken(user, rawToken) {
  const tokenHash = hashToken(rawToken);
  const now = Date.now();
  const index = user.refreshTokens.findIndex(
    (t) => t.tokenHash === tokenHash && t.expiresAt.getTime() > now
  );
  if (index === -1) return false;
  user.refreshTokens.splice(index, 1);
  return true;
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie('accessToken', accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_COOKIE_MS,
    path: '/',
  });
  // Scoped to /api/auth only: the browser won't attach it to unrelated
  // requests, shrinking the surface that could leak or misuse it.
  res.cookie('refreshToken', refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_EXPIRES_MS,
    path: '/api/auth',
  });
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken', { ...baseCookieOptions, path: '/' });
  res.clearCookie('refreshToken', { ...baseCookieOptions, path: '/api/auth' });
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  parseRefreshCookie,
  consumeMatchingRefreshToken,
  setAuthCookies,
  clearAuthCookies,
};
