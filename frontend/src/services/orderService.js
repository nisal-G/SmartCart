import api from './api';

/** Order API client — mirrors backend/src/routes/orderRoutes.js. */
const orderService = {
  /** Converts the authenticated user's current cart into an order. */
  checkout() {
    return api.post('/orders').then((res) => res.data.order);
  },
  /** `params` may include page, limit, status. */
  getMyOrders(params = {}) {
    return api.get('/orders', { params }).then((res) => res.data);
  },
  getOrderById(id) {
    return api.get(`/orders/${id}`).then((res) => res.data.order);
  },

  // Admin-only (requires an authenticated admin session).
  getAllOrders(params = {}) {
    return api.get('/orders/all', { params }).then((res) => res.data);
  },
  getOrderByIdAdmin(id) {
    return api.get(`/orders/all/${id}`).then((res) => res.data.order);
  },
  updateOrderStatus(id, status) {
    return api.patch(`/orders/${id}/status`, { status }).then((res) => res.data.order);
  },
};

export default orderService;
