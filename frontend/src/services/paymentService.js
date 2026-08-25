import api from './api';

/**
 * Payment API client — mirrors backend/src/routes/paymentRoutes.js.
 *
 * Only wraps POST /payments/payhere/session. The backend derives the order
 * id, amount, and currency from the authoritative Order document itself
 * (see backend/src/controllers/paymentController.js) — this call only ever
 * sends the order id and the billing contact details PayHere additionally
 * requires. The response is the safe PayHere Checkout parameter set plus a
 * server-generated hash; the Merchant Secret never reaches the client.
 *
 * POST /payments/payhere/notify (PayHere's server-to-server callback) is
 * deliberately NOT wrapped here — the frontend must never call it.
 */
const paymentService = {
  createPayhereSession(orderId, customer) {
    return api
      .post('/payments/payhere/session', { orderId, customer })
      .then((res) => res.data.payment);
  },
};

export default paymentService;
