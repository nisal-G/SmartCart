const { param, body, query } = require('express-validator');
const Order = require('../models/Order');

const orderIdParamValidators = [
  param('id').isMongoId().withMessage('Invalid order ID'),
];

const updateOrderStatusValidators = [
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .bail()
    .isIn(Order.STATUSES)
    .withMessage(`Status must be one of: ${Order.STATUSES.join(', ')}`),
];

const listOrdersValidators = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(Order.STATUSES).withMessage('Invalid status filter'),
];

module.exports = {
  orderIdParamValidators,
  updateOrderStatusValidators,
  listOrdersValidators,
};
