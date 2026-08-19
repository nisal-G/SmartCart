const { body } = require('express-validator');

const adminLoginValidators = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const passkeyRegisterOptionsValidators = [
  body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('email').optional().isEmail().withMessage('A valid email is required'),
];

const passkeyLoginOptionsValidators = [
  body('email').isEmail().withMessage('A valid email is required'),
];

module.exports = {
  adminLoginValidators,
  passkeyRegisterOptionsValidators,
  passkeyLoginOptionsValidators,
};
