const { body, param } = require('express-validator');

// Sanity ceiling on a single line item's quantity — prevents integer-abuse
// requests (e.g. quantity: 99999999) without getting in a real shopper's way.
const MAX_ITEM_QUANTITY = 1000;

const addItemValidators = [
  body('productId')
    .trim()
    .notEmpty()
    .withMessage('Product ID is required')
    .bail()
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .bail()
    .isInt({ min: 1, max: MAX_ITEM_QUANTITY })
    .withMessage(`Quantity must be a whole number between 1 and ${MAX_ITEM_QUANTITY}`),
];

const productIdParamValidators = [
  param('productId').isMongoId().withMessage('Invalid product ID'),
];

const updateQuantityValidators = [
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .bail()
    .isInt({ min: 1, max: MAX_ITEM_QUANTITY })
    .withMessage(`Quantity must be a whole number between 1 and ${MAX_ITEM_QUANTITY}`),
];

module.exports = {
  MAX_ITEM_QUANTITY,
  addItemValidators,
  productIdParamValidators,
  updateQuantityValidators,
};
