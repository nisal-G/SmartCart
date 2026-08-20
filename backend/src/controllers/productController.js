const Product = require('../models/Product');
const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const imageStorageService = require('../services/imageStorageService');

// Storage folder this feature's uploads live under — keeps them separate
// from Category Management's uploads (see categoryController.js).
const IMAGE_FOLDER = 'products';

// Fields returned when a product's category is populated for browsing —
// enough for a listing/detail view without pulling the whole category doc.
const CATEGORY_PREVIEW_FIELDS = 'name image';

/** Best-effort cleanup: never fails the request that triggered it. */
function cleanupImage(url) {
  if (!url) return;
  imageStorageService.deleteImageByUrl(url).catch((err) => {
    console.error('Failed to delete product image from storage:', err.message);
  });
}

/** Loads the category or throws a request error the global handler can render as 400/404. */
async function requireCategory(categoryId) {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw Object.assign(new Error('Category not found'), { status: 404 });
  }
  return category;
}

// --- CRUD --------------------------------------------------------------

const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, category } = req.body;
  // A file upload (multipart/form-data) takes precedence over a plain
  // `image` URL string in the JSON body, when both are somehow present.
  let { image } = req.body;

  await requireCategory(category);

  if (req.file) {
    const uploaded = await imageStorageService.uploadImage(IMAGE_FOLDER, req.file);
    image = uploaded.url;
  }

  let product;
  try {
    product = await Product.create({
      name,
      description,
      price,
      category,
      image,
      createdBy: req.user._id,
    });
  } catch (err) {
    // Never leave an orphaned upload behind if the write itself fails.
    if (req.file) cleanupImage(image);
    throw err;
  }

  res.status(201).json({ product });
});

const getProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) {
    filter.name = { $regex: escapeRegex(req.query.search), $options: 'i' };
  }
  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {};
    if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', CATEGORY_PREVIEW_FIELDS)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate(
    'category',
    CATEGORY_PREVIEW_FIELDS
  );
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.status(200).json({ product });
});

const getProductsByCategory = asyncHandler(async (req, res) => {
  await requireCategory(req.params.categoryId);

  const products = await Product.find({ category: req.params.categoryId })
    .populate('category', CATEGORY_PREVIEW_FIELDS)
    .sort({ name: 1 });

  res.status(200).json({ products });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const { name, description, price, category, image } = req.body;

  if (category !== undefined && category !== String(product.category)) {
    await requireCategory(category);
    product.category = category;
  }

  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = price;

  // Track the previous image so it can be removed from storage once the
  // new one is safely saved — never delete before the write succeeds.
  const previousImage = product.image;
  let newUploadUrl;

  if (req.file) {
    const uploaded = await imageStorageService.uploadImage(IMAGE_FOLDER, req.file);
    newUploadUrl = uploaded.url;
    product.image = newUploadUrl;
  } else if (image !== undefined) {
    product.image = image;
  }

  try {
    await product.save();
  } catch (err) {
    if (newUploadUrl) cleanupImage(newUploadUrl);
    throw err;
  }

  if (previousImage && previousImage !== product.image) {
    cleanupImage(previousImage);
  }

  await product.populate('category', CATEGORY_PREVIEW_FIELDS);
  res.status(200).json({ product });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  await product.deleteOne();
  cleanupImage(product.image);

  res.status(200).json({ message: 'Product deleted successfully' });
});

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  getProductsByCategory,
  updateProduct,
  deleteProduct,
};
