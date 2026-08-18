const { verifyAccessToken } = require('../services/tokenService');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Requires a valid access token cookie. Also re-checks the user's live
 * status in the DB on every request (not just the JWT claims) so a
 * suspended/deleted account loses access immediately, without waiting for
 * its access token to expire.
 */
const authenticate = asyncHandler(async function authenticate(req, res, next) {
  const token = req.cookies && req.cookies.accessToken;
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res
        .status(401)
        .json({ code: 'TOKEN_EXPIRED', message: 'Access token expired' });
    }
    return res.status(401).json({ message: 'Invalid access token' });
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') {
    return res.status(401).json({ message: 'Account not available' });
  }

  req.user = user;
  next();
});

module.exports = authenticate;
