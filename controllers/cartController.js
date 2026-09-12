const User = require("../models/User");
const Product = require("../models/Product");

async function getCart(req, res) {
  const user = await User.findById(req.user._id).populate("cart.product");
  res.json(user.cart.filter((item) => item.product)); // drop entries whose product was deleted
}

async function addToCart(req, res) {
  const { productId, quantity = 1 } = req.body;
  const product = await Product.findById(productId);
  if (!product || !product.isActive) return res.status(404).json({ message: "Product not found" });

  const user = await User.findById(req.user._id);
  const existing = user.cart.find((item) => item.product.toString() === productId);
  if (existing) {
    existing.quantity += Number(quantity);
  } else {
    user.cart.push({ product: productId, quantity });
  }
  await user.save();
  await user.populate("cart.product");
  res.json(user.cart);
}

async function updateCartItem(req, res) {
  const { quantity } = req.body;
  const user = await User.findById(req.user._id);
  const item = user.cart.find((i) => i.product.toString() === req.params.productId);
  if (!item) return res.status(404).json({ message: "Item not in cart" });

  if (quantity <= 0) {
    user.cart = user.cart.filter((i) => i.product.toString() !== req.params.productId);
  } else {
    item.quantity = quantity;
  }
  await user.save();
  await user.populate("cart.product");
  res.json(user.cart);
}

async function removeFromCart(req, res) {
  const user = await User.findById(req.user._id);
  user.cart = user.cart.filter((i) => i.product.toString() !== req.params.productId);
  await user.save();
  res.json(user.cart);
}

module.exports = { getCart, addToCart, updateCartItem, removeFromCart };
