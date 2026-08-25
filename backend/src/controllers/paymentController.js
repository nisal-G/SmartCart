const mongoose = require('mongoose');
const Order = require('../models/Order');
const payhereService = require('../services/payhereService');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../config/logger');

/** Loads the request error the global handler renders with the given status — same helper as orderController. */
function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

/**
 * Reads PayHere merchant configuration from the environment on every call
 * (not once at module load) so: (1) it always reflects the current
 * process.env, which matters for tests that set these vars per-test, and
 * (2) an unconfigured gateway fails a single request with 503 rather than
 * crashing the whole server at boot — same posture as
 * imageStorageService/config/supabase.js for an optional third-party
 * integration.
 */
function getPayhereConfig() {
  const merchantId = process.env.PAYHERE_MERCHANT_ID;
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
  const returnUrl = process.env.PAYHERE_RETURN_URL;
  const cancelUrl = process.env.PAYHERE_CANCEL_URL;
  const notifyUrl = process.env.PAYHERE_NOTIFY_URL;
  // SmartCart's intended currency (LKR — PayHere's primary market). Not
  // exposed as something a client can override: every order is priced and
  // charged in this one currency.
  const currency = process.env.PAYHERE_CURRENCY || 'LKR';
  // Sandbox by default — a deliberate fail-safe so a missing/blank
  // PAYHERE_SANDBOX env var can never accidentally point at PayHere's live
  // environment. Must be the literal string 'false' to go live.
  const sandbox = process.env.PAYHERE_SANDBOX !== 'false';

  const isConfigured = Boolean(merchantId && merchantSecret && returnUrl && cancelUrl && notifyUrl);

  return { merchantId, merchantSecret, returnUrl, cancelUrl, notifyUrl, currency, sandbox, isConfigured };
}

function notConfiguredError() {
  return requestError(503, 'Payment gateway is not configured on this server');
}

/** Splits User.name into PayHere's separate first_name/last_name — the User model only ever stores one combined name field (see report). */
function splitName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Customer', lastName: 'Customer' };
  const [firstName, ...rest] = parts;
  return { firstName, lastName: rest.join(' ') || firstName };
}

// --- Handlers --------------------------------------------------------------

/**
 * POST /api/payments/payhere/session — prepares the exact PayHere Checkout
 * parameter set (and server-generated hash) the frontend needs to open a
 * PayHere payment for one of the caller's own orders.
 *
 * The order id, amount, and currency all come from the authoritative Order
 * document that POST /api/orders already created — never from anything the
 * client sends in this request. The only client-supplied data used here is
 * billing contact info PayHere additionally requires and the User model
 * does not store (see splitName/report) — none of it affects the amount
 * that gets charged or the hash's integrity.
 */
const createPayhereSession = asyncHandler(async (req, res) => {
  const config = getPayhereConfig();
  if (!config.isConfigured) throw notConfiguredError();

  const order = await Order.findOne({ _id: req.body.orderId, user: req.user._id });
  if (!order) {
    throw requestError(404, 'Order not found');
  }
  if (order.status === 'cancelled') {
    throw requestError(400, 'This order has been cancelled and cannot be paid');
  }
  if (order.payment.status === 'paid') {
    throw requestError(409, 'This order has already been paid');
  }

  const orderId = String(order._id);
  const amount = payhereService.formatAmount(order.total);
  const hash = payhereService.generateHash({
    merchantId: config.merchantId,
    orderId,
    amount,
    currency: config.currency,
    merchantSecret: config.merchantSecret,
  });

  const { firstName, lastName } = splitName(req.user.name);
  const { phone, address, city, country } = req.body.customer;

  res.status(200).json({
    payment: {
      sandbox: config.sandbox,
      merchant_id: config.merchantId,
      order_id: orderId,
      items: order.items.map((item) => item.name).join(', ').slice(0, 255),
      amount,
      currency: config.currency,
      first_name: firstName,
      last_name: lastName,
      // Authoritative — the caller's own verified account email, never a
      // client-supplied value, so PayHere's receipt/notification always
      // goes to the actual account holder.
      email: req.user.email,
      phone,
      address,
      city,
      country,
      return_url: config.returnUrl,
      cancel_url: config.cancelUrl,
      notify_url: config.notifyUrl,
      hash,
    },
  });
});

/**
 * POST /api/payments/payhere/notify — PayHere's server-to-server
 * `notify_url`. PUBLIC on purpose (mounted before this router's
 * `authenticate`, see routes/paymentRoutes.js): PayHere's servers call this
 * directly, with no session cookie, so it cannot require one. Its only
 * trust boundary is `md5sig`.
 *
 * PayHere posts `application/x-www-form-urlencoded`, already parsed by
 * `express.urlencoded()` mounted globally in app.js.
 */
const handlePayhereNotify = asyncHandler(async (req, res) => {
  const log = req.log || logger;
  const config = getPayhereConfig();

  const {
    merchant_id: merchantId,
    order_id: orderId,
    payment_id: paymentId,
    payhere_amount: payhereAmount,
    payhere_currency: payhereCurrency,
    status_code: statusCode,
    md5sig,
    method,
    status_message: statusMessage,
  } = req.body;

  log.info({ orderId, paymentId, statusCode }, '[payhere] notification received');

  if (!config.isConfigured) {
    // Not the caller's fault, but also not something to reveal server
    // config details about — 503 with a generic message either way.
    throw notConfiguredError();
  }

  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    log.warn({ orderId }, '[payhere] notification with a malformed order id');
    throw requestError(400, 'Unknown order');
  }

  // Identify the order first (per PayHere integration convention), but note
  // that NONE of the fields read from `req.body` are trusted for anything
  // that changes state until `md5sig` is verified below — an order_id that
  // happens to be valid is not proof this notification is genuine.
  const order = await Order.findById(orderId);
  if (!order) {
    log.warn({ orderId }, '[payhere] notification for an unknown order');
    throw requestError(404, 'Unknown order');
  }

  if (merchantId !== config.merchantId) {
    log.warn({ orderId }, '[payhere] merchant_id mismatch on notification');
    throw requestError(400, 'Merchant mismatch');
  }

  const signatureValid = payhereService.verifyNotificationSignature({
    merchantId,
    orderId,
    payhereAmount,
    payhereCurrency,
    statusCode,
    merchantSecret: config.merchantSecret,
    md5sig,
  });
  if (!signatureValid) {
    log.warn({ orderId, paymentId }, '[payhere] invalid notification signature — order NOT updated');
    throw requestError(400, 'Invalid signature');
  }

  const mappedStatus = payhereService.mapStatusCode(statusCode);
  if (!mappedStatus) {
    log.warn({ orderId, statusCode }, '[payhere] unrecognized status_code — order NOT updated');
    throw requestError(400, 'Unrecognized status code');
  }

  // --- Idempotency / state-transition guard --------------------------------
  // 'paid' and 'charged_back' are the only states we treat as finalized.
  // Once finalized:
  //   - an identical repeat of the same event (same mapped status + same
  //     PayHere payment_id) is a benign retry — acknowledged, not reapplied.
  //   - paid → charged_back is the one legitimate forward transition.
  //   - anything else (e.g. a late/out-of-order 'pending' or 'failed'
  //     notification arriving after 'paid') is ignored rather than allowed
  //     to regress an already-settled order.
  // Non-finalized orders (pending/failed/cancelled) can freely move to any
  // status, including 'paid' — a shopper is allowed to retry payment on an
  // order whose first attempt failed or was cancelled.
  const currentStatus = order.payment.status;
  const isFinalized = currentStatus === 'paid' || currentStatus === 'charged_back';
  if (isFinalized) {
    const isDuplicate = mappedStatus === currentStatus && order.payment.paymentId === paymentId;
    const isChargebackAfterPaid = currentStatus === 'paid' && mappedStatus === 'charged_back';

    if (isDuplicate) {
      log.info({ orderId, paymentId }, '[payhere] duplicate notification — already processed');
      return res.status(200).json({ message: 'Notification already processed' });
    }
    if (!isChargebackAfterPaid) {
      log.warn(
        { orderId, currentStatus, mappedStatus },
        '[payhere] notification for an already-finalized order — ignored'
      );
      return res.status(200).json({ message: 'Order already finalized' });
    }
    // else: fall through and apply the chargeback below.
  }

  // --- Amount / currency verification --------------------------------------
  // Only meaningful — and only performed — for the two mapped statuses that
  // actually move money. A signed 'pending'/'failed'/'cancelled'
  // notification is trusted for its status alone; PayHere doesn't
  // necessarily echo a chargeable amount for those.
  if (mappedStatus === 'paid' || mappedStatus === 'charged_back') {
    if (payhereCurrency !== config.currency) {
      log.warn(
        { orderId, expected: config.currency, received: payhereCurrency },
        '[payhere] currency mismatch — order NOT updated'
      );
      throw requestError(400, 'Currency mismatch');
    }
    if (!payhereService.amountsMatch(payhereAmount, order.total)) {
      log.warn(
        { orderId, expected: order.total, received: payhereAmount },
        '[payhere] amount mismatch — order NOT updated'
      );
      throw requestError(400, 'Amount mismatch');
    }
  }

  order.payment.status = mappedStatus;
  order.payment.paymentId = paymentId;
  order.payment.method = method;
  order.payment.currency = payhereCurrency;
  if (payhereAmount !== undefined) order.payment.amount = Number(payhereAmount);
  order.payment.statusMessage = statusMessage;
  if (mappedStatus === 'paid') order.payment.paidAt = new Date();
  await order.save();

  log.info({ orderId, paymentId, mappedStatus }, '[payhere] order payment status updated');

  res.status(200).json({ message: 'Notification processed' });
});

module.exports = {
  createPayhereSession,
  handlePayhereNotify,
};
