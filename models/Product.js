const mongoose = require("mongoose");
const slugify = require("slugify");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    images: [{ type: String, required: true }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    stock: { type: Number, required: true, default: 0, min: 0 },
    sku: { type: String, unique: true, sparse: true },

    avgRating: { type: Number, default: 0 },
    numRatings: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    seoTitle: String,
    seoDescription: String,
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text" });

productSchema.pre("validate", function (next) {
  if (this.isModified("name") || this.isNew) {
    this.slug = slugify(this.name, { lower: true, strict: true }) + "-" + Math.random().toString(36).slice(2, 7);
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);
