const { param, body, query } = require('express-validator');
const User = require('../models/User');

const userIdParamValidators = [param('id').isMongoId().withMessage('Invalid user ID')];

// An admin may only move an account between 'active' and 'suspended'.
// 'pending' is a system-only state — an incomplete passkey registration
// (see authController.passkeyRegisterOptions) — never something an admin
// sets directly.
const ADMIN_SETTABLE_STATUSES = ['active', 'suspended'];

const updateUserStatusValidators = [
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .bail()
    .isIn(ADMIN_SETTABLE_STATUSES)
    .withMessage(`Status must be one of: ${ADMIN_SETTABLE_STATUSES.join(', ')}`),
];

const listUsersValidators = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  // The full status enum (including 'pending') is a valid filter even
  // though it isn't admin-settable — an admin may still want to see who's
  // stuck in that state.
  query('status').optional().isIn(User.STATUSES).withMessage('Invalid status filter'),
  query('role').optional().isIn(User.ROLES).withMessage('Invalid role filter'),
];

module.exports = {
  userIdParamValidators,
  updateUserStatusValidators,
  listUsersValidators,
  ADMIN_SETTABLE_STATUSES,
};
