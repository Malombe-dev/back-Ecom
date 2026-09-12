const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const { sendEmail, orderStatusEmailTemplate } = require("../utils/sendEmail");

const CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

// POST /api/orders  { phone, landmark, latitude, longitude, deliveryNotes }
async function placeOrder(req, res) {
  const { phone, landmark, latitude, longitude, deliveryNotes } = req.body;
  if (!phone || !landmark) {
    return res.status(400).json({ message: "Phone number and nearest landmark are required" });
  }

  const user = await User.findById(req.user._id).populate("cart.product");
  const cartItems = user.cart.filter((i) => i.product && i.product.isActive);
  if (!cartItems.length) return res.status(400).json({ message: "Your cart is empty" });

  // validate stock and build snapshot items
  const items = [];
  let totalAmount = 0;
  for (const entry of cartItems) {
    if (entry.product.stock < entry.quantity) {
      return res.status(400).json({ message: `${entry.product.name} does not have enough stock` });
    }
    items.push({
      product: entry.product._id,
      name: entry.product.name,
      price: entry.product.price,
      quantity: entry.quantity,
    });
    totalAmount += entry.product.price * entry.quantity;
  }

  const order = await Order.create({
    user: user._id,
    items,
    totalAmount,
    phone,
    landmark,
    latitude,
    longitude,
    deliveryNotes,
    status: "pending",
    statusHistory: [{ status: "pending", changedBy: user._id, note: "Order placed by customer" }],
  });

  // decrement stock
  for (const entry of cartItems) {
    await Product.findByIdAndUpdate(entry.product._id, { $inc: { stock: -entry.quantity } });
  }

  // clear cart, remember address for next time
  user.cart = [];
  user.phone = phone;
  user.savedAddress = { phone, landmark, latitude, longitude, notes: deliveryNotes };
  await user.save();

  sendEmail({
    to: user.email,
    subject: "Order placed!",
    html: orderStatusEmailTemplate("pending", order._id),
  }).catch((e) => console.error("Email send failed:", e.message));

  res.status(201).json({
    message: "Order placed! We'll be in touch within 12 hours to confirm delivery details.",
    order,
  });
}

// GET /api/orders/mine
async function myOrders(req, res) {
  const orders = await Order.find({ user: req.user._id }).sort("-createdAt");
  res.json(orders);
}

// GET /api/orders/:id
async function getOrder(req, res) {
  const order = await Order.findById(req.params.id).populate("items.product", "name images slug");
  if (!order) return res.status(404).json({ message: "Order not found" });

  const isOwner = order.user.toString() === req.user._id.toString();
  const isStaff = ["admin", "superadmin"].includes(req.user.role);
  if (!isOwner && !isStaff) return res.status(403).json({ message: "Not allowed" });

  res.json(order);
}

// PATCH /api/orders/:id/cancel  (customer self-cancel within 2 hours)
async function cancelMyOrder(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Not allowed" });
  }
  if (order.status !== "pending" && order.status !== "approved") {
    return res.status(400).json({ message: "This order can no longer be canceled" });
  }

  const elapsed = Date.now() - new Date(order.createdAt).getTime();
  if (elapsed > CANCEL_WINDOW_MS) {
    return res.status(400).json({
      message: "The 2-hour self-cancellation window has passed. Please contact support to cancel this order.",
    });
  }

  order.status = "canceled";
  order.canceledBy = "customer";
  order.cancellationReason = req.body.reason || "Canceled by customer";
  order.statusHistory.push({ status: "canceled", changedBy: req.user._id, note: "Self-canceled within window" });
  await order.save();

  // restock items
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
  }

  res.json({ message: "Order canceled", order });
}

// ---- Admin ----

// GET /api/admin/orders?status=pending
async function adminListOrders(req, res) {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const orders = await Order.find(filter).populate("user", "name email phone").sort("-createdAt");
  res.json(orders);
}

// PATCH /api/admin/orders/:id/status  { status, note }
async function adminUpdateStatus(req, res) {
  const { status, note } = req.body;
  const allowed = ["pending", "approved", "shipped", "delivered", "canceled"];
  if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });

  const order = await Order.findById(req.params.id).populate("user", "email name");
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (status === "canceled" && order.status !== "canceled") {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }
    order.canceledBy = "admin";
    order.cancellationReason = note || "Canceled by admin";
  }

  order.status = status;
  order.statusHistory.push({ status, changedBy: req.user._id, note });
  await order.save();

  sendEmail({
    to: order.user.email,
    subject: "Your order status has been updated",
    html: orderStatusEmailTemplate(status, order._id),
  }).catch((e) => console.error("Email send failed:", e.message));

  res.json({ message: "Order updated", order });
}

module.exports = {
  placeOrder,
  myOrders,
  getOrder,
  cancelMyOrder,
  adminListOrders,
  adminUpdateStatus,
};
