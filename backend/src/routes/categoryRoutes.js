const express = require('express');
const categoryController = require('../controllers/categoryController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { handleUpload } = require('../middleware/upload');
const {
  categoryIdValidators,
  createCategoryValidators,
  updateCategoryValidators,
} = require('../validators/categoryValidators');

const router = express.Router();

// --- Public browsing (SRS §3.2 — no login required to browse) --------------
router.get('/', categoryController.getCategories);
router.get('/:id', categoryIdValidators, validate, categoryController.getCategoryById);

// --- Admin management (SRS §3.5 — categories are admin-only) ---------------
// POST/PUT accept either a JSON body with `image` as a URL string, or
// multipart/form-data with an `image` file — handleUpload no-ops for JSON
// requests and populates req.file (+ req.body's text fields) for multipart
// ones, so it must run before the field validators below.
router.post(
  '/',
  authenticate,
  authorize('admin'),
  handleUpload('image'),
  createCategoryValidators,
  validate,
  categoryController.createCategory
);
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  categoryIdValidators,
  handleUpload('image'),
  updateCategoryValidators,
  validate,
  categoryController.updateCategory
);
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  categoryIdValidators,
  validate,
  categoryController.deleteCategory
);

module.exports = router;
