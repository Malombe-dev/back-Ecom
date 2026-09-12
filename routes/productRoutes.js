const express = require("express");
const { listProducts, getProductBySlug } = require("../controllers/productController");
const { listRatings, rateProduct } = require("../controllers/ratingController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/", listProducts);
router.get("/:slug", getProductBySlug);
router.get("/:productId/ratings", listRatings);
router.post("/:productId/ratings", protect, rateProduct);

module.exports = router;
