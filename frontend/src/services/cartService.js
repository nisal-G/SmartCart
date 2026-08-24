import api from './api';

/**
 * Cart API client — mirrors backend/src/routes/cartRoutes.js. Every route
 * requires an authenticated session; the cart always belongs to the
 * currently logged-in user, so no user id is ever passed here.
 */
const cartService = {
  getCart() {
    return api.get('/cart').then((res) => res.data.cart);
  },
  addItem(productId, quantity) {
    return api.post('/cart/items', { productId, quantity }).then((res) => res.data.cart);
  },
  updateItemQuantity(productId, quantity) {
    return api
      .put(`/cart/items/${productId}`, { quantity })
      .then((res) => res.data.cart);
  },
  removeItem(productId) {
    return api.delete(`/cart/items/${productId}`).then((res) => res.data.cart);
  },
  clearCart() {
    return api.delete('/cart').then((res) => res.data.cart);
  },
};

export default cartService;
