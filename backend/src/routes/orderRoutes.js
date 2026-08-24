const express = require('express');
const orderController = require('../controllers/orderController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  orderIdParamValidators,
  updateOrderStatusValidators,
  listOrdersValidators,
} = require('../validators/orderValidators');

const router = express.Router();

// --- Order management (SRS §3.4) ----------------------------------------
// Every order operation either acts on req.user's own orders or requires
// the admin role, so — like Cart Management — every route requires an
// authenticated user at minimum, applied once for the whole router.
router.use(authenticate);

// Checkout: converts req.user's cart into an Order (see orderController).
router.post('/', orderController.checkout);

// The authenticated user's own orders.
router.get('/', listOrdersValidators, validate, orderController.getMyOrders);

// --- Admin management ----------------------------------------------------
// Must be declared before the generic '/:id' routes below so 'all' is never
// parsed as an order id (same pattern as productRoutes' /category/:categoryId).
router.get(
  '/all',
  authorize('admin'),
  listOrdersValidators,
  validate,
  orderController.getAllOrders
);
router.get(
  '/all/:id',
  authorize('admin'),
  orderIdParamValidators,
  validate,
  orderController.getOrderByIdAdmin
);
router.patch(
  '/:id/status',
  authorize('admin'),
  orderIdParamValidators,
  updateOrderStatusValidators,
  validate,
  orderController.updateOrderStatus
);

// A single order belonging to req.user.
router.get('/:id', orderIdParamValidators, validate, orderController.getOrderById);

module.exports = router;
