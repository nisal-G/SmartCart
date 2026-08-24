const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const imageStorageService = require('../services/imageStorageService');
const logger = require('../config/logger');

// Storage folder this feature's uploads live under — keeps them separate
// from Product Management's uploads, which will use their own folder.
const IMAGE_FOLDER = 'categories';

/** Best-effort cleanup: never fails the request that triggered it. */
function cleanupImage(url) {
  if (!url) return;
  imageStorageService.deleteImageByUrl(url).catch((err) => {
    logger.error({ err, url }, 'Failed to delete category image from storage');
  });
}

/** Case-insensitive exact-name lookup, used for duplicate checks. */
function findByNameCI(name, excludeId) {
  const query = { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } };
  if (excludeId) query._id = { $ne: excludeId };
  return Category.findOne(query);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- CRUD ------------------------------------------------------------------

const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  // A file upload (multipart/form-data) takes precedence over a plain
  // `image` URL string in the JSON body, when both are somehow present.
  let { image } = req.body;

  const existing = await findByNameCI(name);
  if (existing) {
    return res.status(409).json({ message: 'A category with this name already exists' });
  }

  if (req.file) {
    const uploaded = await imageStorageService.uploadImage(IMAGE_FOLDER, req.file);
    image = uploaded.url;
  }

  let category;
  try {
    category = await Category.create({
      name,
      description,
      image,
      createdBy: req.user._id,
    });
  } catch (err) {
    // Race-condition safety net: two admins creating the same category at
    // the same time can both pass the pre-check above; the unique index
    // is the actual source of truth. Clean up the now-orphaned upload.
    if (err.code === 11000) {
      if (req.file) cleanupImage(image);
      return res.status(409).json({ message: 'A category with this name already exists' });
    }
    throw err;
  }

  res.status(201).json({ category });
});

const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.status(200).json({ categories });
});

const getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: 'Category not found' });
  }
  res.status(200).json({ category });
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: 'Category not found' });
  }

  const { name, description, image } = req.body;

  if (name && name.toLowerCase() !== category.name.toLowerCase()) {
    const existing = await findByNameCI(name, category._id);
    if (existing) {
      return res.status(409).json({ message: 'A category with this name already exists' });
    }
    category.name = name;
  }

  if (description !== undefined) category.description = description;

  // Track the previous image so it can be removed from storage once the
  // new one is safely saved — never delete before the write succeeds.
  const previousImage = category.image;
  let newUploadUrl;

  if (req.file) {
    const uploaded = await imageStorageService.uploadImage(IMAGE_FOLDER, req.file);
    newUploadUrl = uploaded.url;
    category.image = newUploadUrl;
  } else if (image !== undefined) {
    category.image = image;
  }

  try {
    await category.save();
  } catch (err) {
    if (err.code === 11000) {
      if (newUploadUrl) cleanupImage(newUploadUrl);
      return res.status(409).json({ message: 'A category with this name already exists' });
    }
    throw err;
  }

  if (previousImage && previousImage !== category.image) {
    cleanupImage(previousImage);
  }

  res.status(200).json({ category });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: 'Category not found' });
  }

  await category.deleteOne();
  cleanupImage(category.image);

  res.status(200).json({ message: 'Category deleted successfully' });
});

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
