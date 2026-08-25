const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Fields exposed in the admin user list/management view. User's own
// `toJSON` transform already strips password/refreshTokens from any
// document, but this is narrowed explicitly too, so this endpoint's
// contract doesn't silently grow if unrelated fields are added to the
// schema later (e.g. providers, passkeys).
const ADMIN_USER_FIELDS = 'name email role status createdAt updatedAt lastLoginAt';

/** GET /api/users — admin-only: every registered account, newest first. */
const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.role) filter.role = req.query.role;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(ADMIN_USER_FIELDS)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

/**
 * PATCH /api/users/:id/status — admin-only: suspend or reactivate an
 * account. Only ever moves between 'active' and 'suspended' (see
 * validators/userValidators.js ADMIN_SETTABLE_STATUSES) — role and
 * password are never touched here.
 *
 * No separate session-revocation step is needed on suspend: `authenticate`
 * middleware re-checks `user.status === 'active'` against the DB on every
 * request (not just the JWT claims), so a suspended account loses access
 * on its very next request regardless of how long its access token has
 * left to live.
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) {
    return res.status(400).json({ message: 'You cannot change your own account status' });
  }

  const user = await User.findById(req.params.id).select(ADMIN_USER_FIELDS);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.status = req.body.status;
  await user.save();

  res.status(200).json({ user });
});

module.exports = {
  getAllUsers,
  updateUserStatus,
};
