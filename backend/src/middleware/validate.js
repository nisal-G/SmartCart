const { validationResult } = require('express-validator');

/**
 * Runs after an array of express-validator `check()`/`body()` chains.
 * Usage: router.post('/x', [body('email').isEmail()], validate, handler)
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = validate;
