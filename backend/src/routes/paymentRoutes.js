const express = require('express');
const paymentController = require('../controllers/paymentController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { createSessionValidators } = require('../validators/paymentValidators');

const router = express.Router();

// --- PayHere notify_url ----------------------------------------------------
// PayHere's servers call this directly — never a logged-in browser — so it
// must be reachable with NO session cookie. Declared before `router.use
// (authenticate)` below so it is genuinely public; its only trust boundary
// is the `md5sig` signature verified inside the controller (see
// paymentController.handlePayhereNotify).
router.post('/payhere/notify', paymentController.handlePayhereNotify);

// --- Everything else requires an authenticated shopper --------------------
router.use(authenticate);

// Prepares the PayHere Checkout parameters (+ server-generated hash) for
// one of the caller's own orders.
router.post(
  '/payhere/session',
  createSessionValidators,
  validate,
  paymentController.createPayhereSession
);

module.exports = router;
