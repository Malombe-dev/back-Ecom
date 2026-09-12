const User = require("../models/User");
const Product = require("../models/Product");

async function getWishlist(req, res) {
  const user = await User.findById(req.user._id).populate("wishlist");
  res.json(user.wishlist);
}

async function toggleWishlist(req, res) {
  const { productId } = req.body;
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const user = await User.findById(req.user._id);
  const idx = user.wishlist.findIndex((id) => id.toString() === productId);
  let added;
  if (idx > -1) {
    user.wishlist.splice(idx, 1);
    added = false;
  } else {
    user.wishlist.push(productId);
    added = true;
  }
  await user.save();
  res.json({ added, wishlist: user.wishlist });
}

module.exports = { getWishlist, toggleWishlist };
