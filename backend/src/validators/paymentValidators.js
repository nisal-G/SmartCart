const { body } = require('express-validator');

// PayHere requires phone/address/city/country for its checkout, but the
// User model has nowhere to store them yet (see paymentController /
// final report) — so the caller supplies them per-request. Validated for
// presence/length only; PayHere itself is the source of truth for whether
// a given value is actually deliverable.
const createSessionValidators = [
  body('orderId').isMongoId().withMessage('Invalid order ID'),
  body('customer').isObject().withMessage('Customer details are required'),
  body('customer.phone')
    .trim()
    .notEmpty()
    .withMessage('Customer phone number is required')
    .isLength({ max: 20 })
    .withMessage('Customer phone number is too long'),
  body('customer.address')
    .trim()
    .notEmpty()
    .withMessage('Customer address is required')
    .isLength({ max: 200 })
    .withMessage('Customer address is too long'),
  body('customer.city')
    .trim()
    .notEmpty()
    .withMessage('Customer city is required')
    .isLength({ max: 100 })
    .withMessage('Customer city is too long'),
  body('customer.country')
    .trim()
    .notEmpty()
    .withMessage('Customer country is required')
    .isLength({ max: 100 })
    .withMessage('Customer country is too long'),
];

module.exports = { createSessionValidators };
