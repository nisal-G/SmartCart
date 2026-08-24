const Cart = require('../models/Cart');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');

// Fields populated for a cart item's product. `isActive` is included so
// buildCartResponse can actually prune items whose product was
// deactivated (see below) — it is deliberately never included in the DTO
// returned to clients, alongside category/createdBy/timestamps etc.
const PRODUCT_PREVIEW_FIELDS = 'name price image isActive';

/** Loads the request error the global handler renders with the given status. */
function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

/**
 * Money helper: converts a price to integer cents so quantities/sums never
 * accumulate binary-floating-point drift (e.g. 0.1 + 0.2 !== 0.3). All
 * cart math is done in cents and only converted back to decimal once, at
 * the end.
 */
function toCents(amount) {
  return Math.round(amount * 100);
}

/**
 * Finds the user's cart, creating an empty one on first use. Atomic
 * upsert — safe even if the user's first two cart requests race, thanks to
 * the unique index on `user` in the Cart schema.
 */
async function getOrCreateCart(userId) {
  return Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [], total: 0 } },
    { returnDocument: 'after', upsert: true }
  );
}

/**
 * Populates a cart's product refs, silently drops any line item whose
 * product was deleted (or, forward-compatibly, marked inactive) since it
 * was added, recomputes the total from *current* product prices, persists
 * that cleanup/recalculation when it actually changes anything, and
 * returns the plain-object DTO the API sends to clients.
 *
 * This is the single source of truth for cart totals — callers never pass
 * in or trust a total, here or anywhere else.
 */
async function buildCartResponse(cart) {
  await cart.populate({ path: 'items.product', select: PRODUCT_PREVIEW_FIELDS });

  const liveItems = cart.items.filter(
    (item) => item.product && item.product.isActive !== false
  );
  const wasPruned = liveItems.length !== cart.items.length;

  let totalCents = 0;
  const items = liveItems.map((item) => {
    const priceCents = toCents(item.product.price);
    const subtotalCents = priceCents * item.quantity;
    totalCents += subtotalCents;
    return {
      product: {
        id: item.product._id,
        name: item.product.name,
        price: item.product.price,
        image: item.product.image || null,
      },
      quantity: item.quantity,
      subtotal: subtotalCents / 100,
    };
  });
  const total = totalCents / 100;

  if (wasPruned || total !== cart.total) {
    // Re-point items at just the surviving (still-existing) products —
    // `item.product` is populated in memory but Mongoose casts it back to
    // its ObjectId on save.
    cart.items = liveItems;
    cart.total = total;
    await cart.save();
  }

  return {
    id: cart._id,
    user: cart.user,
    items,
    total,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
}

/** Throws 404 unless the product exists and is available for purchase. */
async function requireAvailableProduct(productId) {
  const product = await Product.findById(productId);
  if (!product) {
    throw requestError(404, 'Product not found');
  }
  // The Product model has no availability flag today; this check is
  // forward-compatible with one (e.g. `isActive`) being added later
  // without requiring changes here.
  if (product.isActive === false) {
    throw requestError(400, 'This product is currently unavailable');
  }
  return product;
}

// --- Handlers ----------------------------------------------------------

const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  res.status(200).json({ cart: await buildCartResponse(cart) });
});

const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;

  await requireAvailableProduct(productId);

  const cart = await getOrCreateCart(req.user._id);

  // Rule: adding a product already in the cart increments its quantity by
  // the requested amount (standard "add to cart" semantics), rather than
  // replacing it — replacing is what PUT /items/:productId is for.
  let updated = await Cart.findOneAndUpdate(
    { _id: cart._id, 'items.product': productId },
    { $inc: { 'items.$.quantity': quantity } },
    { returnDocument: 'after' }
  );

  if (!updated) {
    // No existing line item matched — atomically append a new one. Using
    // the cart's _id (not just user) keeps this scoped to the cart we
    // already resolved above.
    updated = await Cart.findOneAndUpdate(
      { _id: cart._id },
      { $push: { items: { product: productId, quantity } } },
      { returnDocument: 'after' }
    );
  }

  res.status(200).json({ cart: await buildCartResponse(updated) });
});

const updateItemQuantity = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  const cart = await getOrCreateCart(req.user._id);
  const existingItem = cart.items.find((item) => item.product.equals(productId));
  if (!existingItem) {
    throw requestError(404, 'Item not found in cart');
  }

  // PUT is a full replace of this item's quantity (not an increment — that
  // is POST /items' job). Quantity 0 is rejected by the validators rather
  // than treated as an implicit delete: DELETE /items/:productId already
  // exists for removal, so PUT stays a pure "set" with no side effects the
  // client didn't ask for.
  const updated = await Cart.findOneAndUpdate(
    { _id: cart._id, 'items.product': productId },
    { $set: { 'items.$.quantity': quantity } },
    { returnDocument: 'after' }
  );

  res.status(200).json({ cart: await buildCartResponse(updated) });
});

const removeItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const cart = await getOrCreateCart(req.user._id);
  const existingItem = cart.items.find((item) => item.product.equals(productId));
  if (!existingItem) {
    throw requestError(404, 'Item not found in cart');
  }

  const updated = await Cart.findOneAndUpdate(
    { _id: cart._id },
    { $pull: { items: { product: productId } } },
    { returnDocument: 'after' }
  );

  res.status(200).json({ cart: await buildCartResponse(updated) });
});

const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);

  const updated = await Cart.findOneAndUpdate(
    { _id: cart._id },
    { $set: { items: [], total: 0 } },
    { returnDocument: 'after' }
  );

  res.status(200).json({ cart: await buildCartResponse(updated) });
});

module.exports = {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
};
