const { body, param } = require('express-validator');

const categoryIdValidators = [
  param('id').isMongoId().withMessage('Invalid category ID'),
];

const createCategoryValidators = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ max: 50 })
    .withMessage('Category name must be at most 50 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be at most 500 characters'),
  body('image').optional().trim().isString(),
];

const updateCategoryValidators = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category name cannot be empty')
    .isLength({ max: 50 })
    .withMessage('Category name must be at most 50 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be at most 500 characters'),
  body('image').optional().trim().isString(),
];

module.exports = {
  categoryIdValidators,
  createCategoryValidators,
  updateCategoryValidators,
};
