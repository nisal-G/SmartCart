const { verifyAccessToken } = require('../services/tokenService');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Like `authenticate`, but never rejects the request. If a valid session
 * exists, `req.user` is populated; otherwise the request proceeds as
 * anonymous. Used by endpoints that behave differently for logged-in users
 * without requiring login (e.g. "register a passkey" doubles as both
 * "add a device to my account" and "sign up with a passkey").
 */
const optionalAuthenticate = asyncHandler(async function optionalAuthenticate(
  req,
  res,
  next
) {
  const token = req.cookies && req.cookies.accessToken;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.status === 'active') {
      req.user = user;
    }
  } catch (err) {
    // Invalid/expired token: treat as anonymous rather than failing.
  }
  next();
});

module.exports = optionalAuthenticate;
