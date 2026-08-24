import api from './api';

/** Category API client — mirrors backend/src/routes/categoryRoutes.js. */
const categoryService = {
  // Public browsing (no auth required).
  getCategories() {
    return api.get('/categories').then((res) => res.data.categories);
  },
  getCategoryById(id) {
    return api.get(`/categories/${id}`).then((res) => res.data.category);
  },

  // Admin-only (requires an authenticated admin session).
  createCategory(payload) {
    return api.post('/categories', payload).then((res) => res.data.category);
  },
  updateCategory(id, payload) {
    return api.put(`/categories/${id}`, payload).then((res) => res.data.category);
  },
  deleteCategory(id) {
    return api.delete(`/categories/${id}`).then((res) => res.data);
  },
};

export default categoryService;
