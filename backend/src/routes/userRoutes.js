const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  userIdParamValidators,
  updateUserStatusValidators,
  listUsersValidators,
} = require('../validators/userValidators');

const router = express.Router();

// --- Admin user management -----------------------------------------------
// Every route here is admin-only (there is no self-service profile view —
// GET /api/auth/me already covers that), so authenticate + authorize are
// applied once for the whole router, same pattern as Order Management's
// admin routes (see orderRoutes.js).
router.use(authenticate, authorize('admin'));

router.get('/', listUsersValidators, validate, userController.getAllUsers);
router.patch(
  '/:id/status',
  userIdParamValidators,
  updateUserStatusValidators,
  validate,
  userController.updateUserStatus
);

module.exports = router;
