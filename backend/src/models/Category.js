const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * A product category (e.g. Vegetables, Fruits, Cakes, Biscuits — SRS §1.1/§3.2).
 * Categories are managed exclusively by admin users; regular shoppers only
 * ever read them while browsing.
 */
const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    image: {
      type: String,
      trim: true,
    },

    // Admin who created the category. Optional so the field never blocks a
    // write if it's ever missing; useful for auditing who manages the catalog.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Case-insensitive uniqueness (e.g. "Fruits" and "fruits" collide) enforced
// at the DB level as a safety net alongside the controller's pre-check.
categorySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

module.exports = mongoose.model('Category', categorySchema);
