const crypto = require('crypto');
const path = require('path');
const { supabase, isSupabaseConfigured, BUCKET } = require('../config/supabase');

/**
 * Reusable image storage on top of Supabase Storage. Feature controllers call
 * `uploadImage(folder, file)` with a namespace (`'categories'`, later
 * `'products'`, ...) so uploads from different features never collide, and
 * `deleteImageByUrl(url)` to clean up an object once it's no longer
 * referenced. Deliberately has no knowledge of Category/Product models —
 * keep it that way so it stays reusable.
 */

// Supabase's public-object URL always has this shape:
//   <SUPABASE_URL>/storage/v1/object/public/<bucket>/<path>
// Matching on this segment (rather than the full base URL) means we don't
// need to know SUPABASE_URL again here just to recognize our own uploads.
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${BUCKET}/`;

function notConfiguredError() {
  return Object.assign(new Error('Image storage is not configured on this server'), {
    status: 503,
  });
}

/** Wraps a raw Supabase error so callers/clients never see its internals. */
function storageError(action, err) {
  return Object.assign(new Error(`Failed to ${action} image`), {
    status: 502,
    cause: err,
  });
}

/** Returns the object path for a URL previously returned by `uploadImage`, or null if it isn't one of ours. */
function extractPathFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const idx = url.indexOf(PUBLIC_URL_MARKER);
  if (idx === -1) return null;
  const objectPath = url.slice(idx + PUBLIC_URL_MARKER.length);
  return objectPath || null;
}

/**
 * Uploads a single image (as produced by multer's memory storage — an
 * object with `.buffer`, `.mimetype`, `.originalname`) to
 * `<folder>/<random-uuid><ext>` in the configured bucket. The random name
 * guarantees no collision with any existing object, regardless of the
 * original filename. Returns `{ path, url }`.
 */
async function uploadImage(folder, file) {
  if (!isSupabaseConfigured) throw notConfiguredError();
  if (!file || !file.buffer) {
    throw Object.assign(new Error('No image file provided'), { status: 400 });
  }

  const ext = path.extname(file.originalname || '') || '';
  const objectPath = `${folder}/${crypto.randomUUID()}${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, file.buffer, {
    contentType: file.mimetype,
    upsert: false, // a collision here would mean a UUID repeated — treat it as a real error
  });
  if (error) throw storageError('upload', error);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return { path: objectPath, url: data.publicUrl };
}

/**
 * Deletes the object behind a URL previously returned by `uploadImage`.
 * Safe to call with any string: URLs that don't belong to our bucket (e.g.
 * an admin set `image` to some arbitrary external URL), or no URL at all,
 * are silently ignored rather than treated as an error — there's nothing
 * of ours to delete.
 */
async function deleteImageByUrl(url) {
  if (!isSupabaseConfigured || !url) return;
  const objectPath = extractPathFromUrl(url);
  if (!objectPath) return;

  const { error } = await supabase.storage.from(BUCKET).remove([objectPath]);
  if (error) throw storageError('delete', error);
}

module.exports = { isSupabaseConfigured, uploadImage, deleteImageByUrl };
