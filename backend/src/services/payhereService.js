const crypto = require('crypto');

/**
 * PayHere payment-gateway integration helpers (hash generation + notification
 * signature verification + status-code mapping).
 *
 * Deliberately stateless / pure — every function takes its config
 * (merchantId, merchantSecret, currency, ...) as an explicit argument rather
 * than reading `process.env` itself. That keeps the Merchant Secret's only
 * server-side owner one level up (paymentController, which reads env once
 * per request), and makes every function here trivial to unit test with
 * fixed fixtures instead of mutating process.env around each test.
 *
 * Reference: https://support.payhere.lk/api-&-mobile-sdk/payhere-checkout
 */

// PayHere's documented status_code → SmartCart's internal payment.status
// (see models/Order.js's PAYMENT_STATUSES). Keys are strings because
// PayHere's notify_url payload is application/x-www-form-urlencoded, so
// every field — including status_code — arrives as a string.
const STATUS_CODE_MAP = {
  2: 'paid',
  0: 'pending',
  '-1': 'cancelled',
  '-2': 'failed',
  '-3': 'charged_back',
};

/** MD5 hex digest, uppercased — the exact primitive PayHere's hash formula is built from. */
function md5Upper(input) {
  return crypto.createHash('md5').update(String(input), 'utf8').digest('hex').toUpperCase();
}

/**
 * PayHere requires the amount formatted with exactly two decimal places and
 * no thousands separator (e.g. 1000 → "1000.00", 1050.5 → "1050.50") — both
 * for the outgoing checkout hash and for reading back `payhere_amount` on
 * notify. Any other formatting produces a hash PayHere's own server won't
 * recognize.
 */
function formatAmount(amount) {
  return Number(amount).toFixed(2);
}

/**
 * The hash PayHere's Checkout/JS SDK requires to start a payment:
 *   UPPERCASE(MD5(merchant_id + order_id + amount + currency + UPPERCASE(MD5(merchant_secret))))
 * Computed here (server-side) and only here — the Merchant Secret never
 * leaves this function, let alone the server.
 */
function generateHash({ merchantId, orderId, amount, currency, merchantSecret }) {
  const hashedSecret = md5Upper(merchantSecret);
  return md5Upper(`${merchantId}${orderId}${formatAmount(amount)}${currency}${hashedSecret}`);
}

/**
 * Independently recomputes the signature PayHere is documented to send as
 * `md5sig` on a notify_url call:
 *   UPPERCASE(MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPERCASE(MD5(merchant_secret))))
 * and reports whether it matches. Uses a fixed-time comparison
 * (`crypto.timingSafeEqual`) so a byte-by-byte timing difference can't leak
 * how many characters of a forged signature were correct.
 */
function verifyNotificationSignature({
  merchantId,
  orderId,
  payhereAmount,
  payhereCurrency,
  statusCode,
  merchantSecret,
  md5sig,
}) {
  if (!md5sig || typeof md5sig !== 'string') return false;

  const hashedSecret = md5Upper(merchantSecret);
  const expected = md5Upper(
    `${merchantId}${orderId}${formatAmount(payhereAmount)}${payhereCurrency}${statusCode}${hashedSecret}`
  );
  const received = md5sig.toUpperCase();

  // timingSafeEqual throws on mismatched buffer lengths rather than
  // returning false — both hashes are fixed-length (32 hex chars) once
  // valid, so a length mismatch just means "not equal", checked first.
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'));
}

/** Maps a PayHere `status_code` (string or number) to our internal payment status, or null if unrecognized. */
function mapStatusCode(statusCode) {
  return STATUS_CODE_MAP[statusCode] ?? null;
}

/**
 * Whether two money amounts match, compared in integer cents so binary-float
 * formatting differences (e.g. "500" vs "500.00" vs 499.999999998) never
 * cause a false mismatch or, worse, a false match.
 */
function amountsMatch(a, b) {
  const toCents = (value) => Math.round(Number(value) * 100);
  return toCents(a) === toCents(b);
}

module.exports = {
  STATUS_CODE_MAP,
  formatAmount,
  generateHash,
  verifyNotificationSignature,
  mapStatusCode,
  amountsMatch,
};
