import api from './api';

/** User API client — mirrors backend/src/routes/userRoutes.js. Admin-only (requires an authenticated admin session). */
const userService = {
  /** `params` may include page, limit, status, role. */
  getAllUsers(params = {}) {
    return api.get('/users', { params }).then((res) => res.data);
  },
  /** `status` must be 'active' or 'suspended' — see backend/src/validators/userValidators.js ADMIN_SETTABLE_STATUSES. */
  updateUserStatus(id, status) {
    return api.patch(`/users/${id}/status`, { status }).then((res) => res.data.user);
  },
};

export default userService;
