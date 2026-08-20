const multer = require('multer');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Reusable image-upload middleware shared by every feature that stores
 * images in Supabase Storage (Category Management now, Product Management
 * later). Buffers the file in memory only — it's handed straight to
 * imageStorageService.uploadImage, never written to local disk.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WEBP, or GIF images are allowed'));
    }
    cb(null, true);
  },
});

/**
 * Wraps `upload.single(field)` so multer's errors (oversized file, bad
 * mimetype, malformed multipart body) come back as the project's normal
 * `{ message }` 400 response instead of reaching the global error handler
 * as an uncategorized 500. The field is optional — a JSON request with no
 * file simply falls through with `req.file` left undefined.
 */
function handleUpload(field) {
  const middleware = upload.single(field);
  return function handleUploadMiddleware(req, res, next) {
    middleware(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: `Image must be smaller than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
        });
      }
      return res.status(400).json({ message: err.message });
    });
  };
}

module.exports = { handleUpload };
