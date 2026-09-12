const Rating = require("../models/Rating");
const Product = require("../models/Product");

async function recalculateProductRating(productId) {
  const stats = await Rating.aggregate([
    { $match: { product: productId } },
    { $group: { _id: "$product", avg: { $avg: "$value" }, count: { $sum: 1 } } },
  ]);
  const { avg = 0, count = 0 } = stats[0] || {};
  await Product.findByIdAndUpdate(productId, { avgRating: Math.round(avg * 10) / 10, numRatings: count });
}

// GET /api/products/:productId/ratings
async function listRatings(req, res) {
  const ratings = await Rating.find({ product: req.params.productId })
    .populate("user", "name")
    .sort("-createdAt");
  res.json(ratings);
}

// POST /api/products/:productId/ratings  { value, comment }
async function rateProduct(req, res) {
  const { value, comment } = req.body;
  const { productId } = req.params;

  const rating = await Rating.findOneAndUpdate(
    { product: productId, user: req.user._id },
    { value, comment },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await recalculateProductRating(productId);
  res.status(201).json(rating);
}

module.exports = { listRatings, rateProduct };
