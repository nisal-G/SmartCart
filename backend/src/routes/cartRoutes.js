const express = require('express');
const cartController = require('../controllers/cartController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const {
  addItemValidators,
  productIdParamValidators,
  updateQuantityValidators,
} = require('../validators/cartValidators');

const router = express.Router();

// --- Cart management (SRS §3.3) ---------------------------------------
// Every cart operation acts only on req.user's own cart (see
// cartController — all queries are scoped by req.user._id), so unlike
// Category/Product Management there is no public/admin split here: every
// route requires an authenticated shopper, applied once for the whole
// router rather than repeated per-route.
router.use(authenticate);

router.get('/', cartController.getCart);
router.post('/items', addItemValidators, validate, cartController.addItem);
router.put(
  '/items/:productId',
  productIdParamValidators,
  updateQuantityValidators,
  validate,
  cartController.updateItemQuantity
);
router.delete(
  '/items/:productId',
  productIdParamValidators,
  validate,
  cartController.removeItem
);
router.delete('/', cartController.clearCart);

module.exports = router;
