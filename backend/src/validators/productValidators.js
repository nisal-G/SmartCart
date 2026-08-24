const { body, param, query } = require('express-validator');

const productIdValidators = [
  param('id').isMongoId().withMessage('Invalid product ID'),
];

const categoryIdParamValidators = [
  param('categoryId').isMongoId().withMessage('Invalid category ID'),
];

const createProductValidators = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 100 })
    .withMessage('Product name must be at most 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be at most 1000 characters'),
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .bail()
    .isFloat({ gt: 0 })
    .withMessage('Price must be a positive number'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .bail()
    .isMongoId()
    .withMessage('Invalid category ID'),
  body('image').optional().trim().isString(),
];

const updateProductValidators = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Product name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Product name must be at most 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be at most 1000 characters'),
  body('price')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Price must be a positive number'),
  body('category')
    .optional()
    .trim()
    .isMongoId()
    .withMessage('Invalid category ID'),
  body('image').optional().trim().isString(),
];

const listProductsValidators = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('category').optional().isMongoId().withMessage('Invalid category ID'),
  query('search').optional().trim().isLength({ max: 100 }),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a positive number'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a positive number'),
];

module.exports = {
  productIdValidators,
  categoryIdParamValidators,
  createProductValidators,
  updateProductValidators,
  listProductsValidators,
};
