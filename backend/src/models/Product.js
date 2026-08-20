const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * A purchasable item within a category (e.g. "Tomato" under Vegetables —
 * SRS §3.2). Products are managed exclusively by admin users; regular
 * shoppers only ever read them while browsing (SRS §3.2/§3.5).
 */
const productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    image: {
      type: String,
      trim: true,
    },

    // Admin who created the product. Optional so the field never blocks a
    // write if it's ever missing; useful for auditing who manages the catalog.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Supports "browse by category" (SRS §3.2) and keeps that filter fast as the
// catalog grows.
productSchema.index({ category: 1 });
// Supports name search/sort for the browsing list.
productSchema.index({ name: 1 });

module.exports = mongoose.model('Product', productSchema);
