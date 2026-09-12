const express = require("express");
const { getCart, addToCart, updateCartItem, removeFromCart } = require("../controllers/cartController");
const { protect } = require("../middleware/auth");

const router = express.Router();
router.use(protect);
router.get("/", getCart);
router.post("/", addToCart);
router.patch("/:productId", updateCartItem);
router.delete("/:productId", removeFromCart);

module.exports = router;
