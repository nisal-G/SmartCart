import api from './api';

/** Product API client — mirrors backend/src/routes/productRoutes.js. */
const productService = {
  // Public browsing (no auth required).
  /** `params` may include page, limit, category, search, minPrice, maxPrice. */
  getProducts(params = {}) {
    return api.get('/products', { params }).then((res) => res.data);
  },
  getProductById(id) {
    return api.get(`/products/${id}`).then((res) => res.data.product);
  },
  getProductsByCategory(categoryId) {
    return api.get(`/products/category/${categoryId}`).then((res) => res.data.products);
  },

  // Admin-only (requires an authenticated admin session).
  createProduct(payload) {
    return api.post('/products', payload).then((res) => res.data.product);
  },
  updateProduct(id, payload) {
    return api.put(`/products/${id}`, payload).then((res) => res.data.product);
  },
  deleteProduct(id) {
    return api.delete(`/products/${id}`).then((res) => res.data);
  },
};

export default productService;
