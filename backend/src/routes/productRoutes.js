const express = require('express');
const productController = require('../controllers/productController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { handleUpload } = require('../middleware/upload');
const {
  productIdValidators,
  categoryIdParamValidators,
  createProductValidators,
  updateProductValidators,
  listProductsValidators,
} = require('../validators/productValidators');

const router = express.Router();

// --- Public browsing (SRS §3.2 — no login required to browse) --------------
// /category/:categoryId must come before /:id so "category" is never parsed
// as a product id.
router.get('/', listProductsValidators, validate, productController.getProducts);
router.get(
  '/category/:categoryId',
  categoryIdParamValidators,
  validate,
  productController.getProductsByCategory
);
router.get('/:id', productIdValidators, validate, productController.getProductById);

// --- Admin management (SRS §3.5 — products are admin-only) -----------------
// POST/PUT accept either a JSON body with `image` as a URL string, or
// multipart/form-data with an `image` file — handleUpload no-ops for JSON
// requests and populates req.file (+ req.body's text fields) for multipart
// ones, so it must run before the field validators below.
router.post(
  '/',
  authenticate,
  authorize('admin'),
  handleUpload('image'),
  createProductValidators,
  validate,
  productController.createProduct
);
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  productIdValidators,
  handleUpload('image'),
  updateProductValidators,
  validate,
  productController.updateProduct
);
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  productIdValidators,
  validate,
  productController.deleteProduct
);

module.exports = router;
